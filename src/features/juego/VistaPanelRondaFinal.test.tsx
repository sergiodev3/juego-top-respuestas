// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ConfigPartida, Evento } from '@/engine';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba, preguntaSnapshotPrueba } from '@/test/fabricasPartida';

import {
  botonHabilitado,
  crearRelojManual,
  renderizarPanel,
  vistasPublicadas,
} from './panel/pruebaPanel';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

/** One regular round plus a final round (20 s / 25 s, goal 200). */
const CONFIG: ConfigPartida = configPrueba({
  rondas: [{ pregunta: preguntaSnapshotPrueba('R1'), multiplicador: 1 }],
  rondaFinal: {
    preguntas: ['F1', 'F2', 'F3', 'F4', 'F5'].map((clave) => preguntaSnapshotPrueba(clave)),
    segundos: [20, 25],
    meta: 200,
  },
});

/** Team A clears round 1 (100 points) and the game moves to the final round. */
const HASTA_RONDA_FINAL: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
  { tipo: 'SIGUIENTE_RONDA' },
];

/** Player 1 answers question 1 with the top answer (40 points), then player 2 takes over. */
const TURNO_JUGADOR_1: Evento[] = [
  { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0, texto: 'gato' },
  { tipo: 'RF_REVELAR', jugador: 1, pregunta: 0 },
  { tipo: 'RF_SIGUIENTE_JUGADOR' },
];

/** Player 2 answers question 1 with the second answer (25 points). */
const TURNO_JUGADOR_2: Evento[] = [
  { tipo: 'RF_RESPUESTA', jugador: 2, pregunta: 0, indice: 1, texto: 'perro' },
  { tipo: 'RF_REVELAR', jugador: 2, pregunta: 0 },
];

/**
 * A partida already in the final round, plus `extra` events. Each test starts from the step
 * it checks: replaying the whole flow through the UI in one test made it the slowest in the
 * suite and pushed it past the timeout under full-suite load.
 */
async function crearPartidaFinal(extra: Evento[] = []) {
  const partida = await entorno.repositorios.partidas.crear({ juegoId: 'juego-1', config: CONFIG });
  for (const evento of [...HASTA_RONDA_FINAL, ...extra]) {
    await entorno.repositorios.partidas.agregarEvento(partida.id, evento);
  }
  return partida.id;
}

/** Events saved after `antes`, i.e. the ones the test produced through the panel. */
async function eventosNuevos(id: string, antes: Evento[]): Promise<Evento[]> {
  const eventos = (await entorno.repositorios.partidas.obtener(id))?.eventos ?? [];
  return eventos.slice(HASTA_RONDA_FINAL.length + antes.length);
}

type Usuario = ReturnType<typeof renderizarPanel>['usuario'];

async function registrar(
  usuario: Usuario,
  jugador: 1 | 2,
  pregunta: number,
  texto: string,
  opcion: string,
) {
  const campo = await screen.findByLabelText(
    `Respuesta del jugador ${String(jugador)} a la pregunta ${String(pregunta)}`,
  );
  await usuario.type(campo, texto);
  await usuario.selectOptions(
    screen.getByLabelText(
      `Coincidencia del jugador ${String(jugador)} en la pregunta ${String(pregunta)}`,
    ),
    opcion,
  );
}

describe('VistaPanel: final round', () => {
  it('records and reveals an answer, then switches player with hidden answers', async () => {
    const id = await crearPartidaFinal();
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    expect(await screen.findByRole('heading', { name: 'Ronda final' })).toBeInTheDocument();
    expect(screen.getByText('Juega:').textContent).toBe('Juega: Equipo A');
    expect(screen.getByRole('timer', { name: 'Tiempo restante' })).toHaveTextContent('20 s');

    await registrar(usuario, 1, 1, 'gato', '1. TXT_F1_0 (40 pts)');
    await usuario.click(await botonHabilitado('Registrar la respuesta de la pregunta 1'));
    await usuario.click(
      await botonHabilitado('Revelar la respuesta del jugador 1 en la pregunta 1'),
    );
    expect(await screen.findByText('Total: 40 de 200 puntos')).toBeInTheDocument();

    await usuario.click(await botonHabilitado('Siguiente jugador'));
    await waitFor(() => {
      expect(screen.getByRole('timer', { name: 'Tiempo restante' })).toHaveTextContent('25 s');
    });
    expect(
      screen.getByRole('list', { name: 'Respuestas registradas de la pregunta 1' }),
    ).toHaveTextContent('Oculta mientras juega el jugador 2');
    expect(await eventosNuevos(id, [])).toEqual(TURNO_JUGADOR_1);
  });

  it('warns about a repeated answer and blocks it until another match is chosen', async () => {
    const id = await crearPartidaFinal(TURNO_JUGADOR_1);
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await registrar(usuario, 2, 1, 'perro', '1. TXT_F1_0 (40 pts)');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Respuesta repetida: pide otra respuesta.',
    );
    const boton = screen.getByRole('button', { name: 'Registrar la respuesta de la pregunta 1' });
    expect(boton).toHaveAttribute('aria-disabled', 'true');

    await usuario.selectOptions(
      screen.getByLabelText('Coincidencia del jugador 2 en la pregunta 1'),
      '2. TXT_F1_1 (25 pts)',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await usuario.click(await botonHabilitado('Registrar la respuesta de la pregunta 1'));
    await usuario.click(
      await botonHabilitado('Revelar la respuesta del jugador 2 en la pregunta 1'),
    );
    expect(await screen.findByText('Total: 65 de 200 puntos')).toBeInTheDocument();
    expect(await eventosNuevos(id, TURNO_JUGADOR_1)).toEqual(TURNO_JUGADOR_2);
  });

  it('adds the final-round total to the playing team on finish, after confirming', async () => {
    const antes = [...TURNO_JUGADOR_1, ...TURNO_JUGADOR_2];
    const id = await crearPartidaFinal(antes);
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await usuario.click(await botonHabilitado('Terminar ronda final'));
    const dialogo = await screen.findByRole('dialog', { name: '¿Terminar la ronda final?' });
    expect(dialogo).toHaveAccessibleDescription(
      'Se sumarán 65 puntos a Equipo A y el juego terminará.',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Terminar ronda final' }));

    expect(await screen.findByRole('heading', { name: 'Juego terminado' })).toBeInTheDocument();
    expect(screen.getByText('¡Gana Equipo A!')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Puntajes finales' })).toHaveTextContent(
      'Equipo A165 puntos',
    );
    expect(screen.getByText(/Ronda final: 65 de 200 puntos\./u)).toHaveTextContent(
      'No alcanzaron la meta.',
    );
    expect(await eventosNuevos(id, antes)).toEqual([{ tipo: 'RF_TERMINAR' }]);
    expect((await entorno.repositorios.partidas.obtener(id))?.estado).toBe('terminada');
  });

  it('runs the timer and publishes it to the board', async () => {
    const id = await crearPartidaFinal();
    const reloj = crearRelojManual();
    const { usuario, bus } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      reloj,
    });
    const temporizador = await screen.findByRole('timer', { name: 'Tiempo restante' });

    await usuario.click(screen.getByRole('button', { name: 'Iniciar tiempo' }));
    reloj.avanzar(5_000);

    expect(temporizador).toHaveTextContent('15 s');
    expect(vistasPublicadas(bus).at(-1)?.temporizador).toEqual({
      restante: 15,
      total: 20,
      corriendo: true,
    });

    await usuario.click(screen.getByRole('button', { name: 'Pausar tiempo' }));
    reloj.avanzar(3_000);
    expect(temporizador).toHaveTextContent('15 s');
    expect(vistasPublicadas(bus).at(-1)?.temporizador).toEqual({
      restante: 15,
      total: 20,
      corriendo: false,
    });

    await usuario.click(screen.getByRole('button', { name: 'Iniciar tiempo' }));
    reloj.avanzar(20_000);
    expect(temporizador).toHaveTextContent('0 s');
    expect(vistasPublicadas(bus).at(-1)?.temporizador?.corriendo).toBe(false);

    await usuario.click(screen.getByRole('button', { name: 'Reiniciar tiempo' }));
    expect(temporizador).toHaveTextContent('20 s');
  });

  it('lets the host change the playing team before the first answer, and starts over', async () => {
    const id = await crearPartidaFinal();
    const { usuario, router } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });

    await usuario.click(await botonHabilitado('Turno: Equipo B'));
    await waitFor(() => {
      expect(screen.getByText('Juega:').textContent).toBe('Juega: Equipo B');
    });

    await usuario.click(await botonHabilitado('Terminar partida'));
    await usuario.click(
      within(await screen.findByRole('dialog', { name: '¿Terminar la partida?' })).getByRole(
        'button',
        { name: 'Terminar partida' },
      ),
    );
    await usuario.click(await screen.findByRole('button', { name: 'Jugar de nuevo' }));

    await waitFor(() => {
      expect(router.state.location.pathname).not.toContain(id);
    });
    expect(await screen.findByText('Ronda 1 de 1')).toBeInTheDocument();
    const nueva = await entorno.repositorios.partidas.obtenerEnCurso();
    expect(nueva?.id).not.toBe(id);
    expect(nueva?.config).toEqual(CONFIG);
    expect(nueva?.eventos).toEqual([]);
  });
});
