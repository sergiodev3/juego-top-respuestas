// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ConfigPartida, Evento } from '@/engine';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba, preguntaSnapshotPrueba } from '@/test/fabricasPartida';

import { botonHabilitado, crearRelojManual, renderizarPanel } from './pruebaPanel';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

const CARA_A_CARA_GANADO: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
];
const EN_JUEGO: Evento[] = [...CARA_A_CARA_GANADO, { tipo: 'JUGAR' }];
const FIN_DE_RONDA: Evento[] = [
  ...EN_JUEGO,
  { tipo: 'TACHE' },
  { tipo: 'TACHE' },
  { tipo: 'TACHE' },
  { tipo: 'ASIGNAR_TURNO', equipo: 1 },
  { tipo: 'ROBO_FALLIDO' },
];

/** One regular round plus a final round (20 s / 25 s, goal 200). */
const CONFIG_FINAL: ConfigPartida = configPrueba({
  rondas: [{ pregunta: preguntaSnapshotPrueba('R1'), multiplicador: 1 }],
  rondaFinal: {
    preguntas: ['F1', 'F2', 'F3', 'F4', 'F5'].map((clave) => preguntaSnapshotPrueba(clave)),
    segundos: [20, 25],
    meta: 200,
  },
});
const HASTA_RONDA_FINAL: Evento[] = [
  ...EN_JUEGO,
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
  { tipo: 'SIGUIENTE_RONDA' },
];

async function crearPartida(eventos: Evento[] = [], config: ConfigPartida = configPrueba()) {
  const partida = await entorno.repositorios.partidas.crear({ juegoId: 'juego-1', config });
  for (const evento of eventos) {
    await entorno.repositorios.partidas.agregarEvento(partida.id, evento);
  }
  return partida.id;
}

async function eventosGuardados(id: string): Promise<Evento[]> {
  return (await entorno.repositorios.partidas.obtener(id))?.eventos ?? [];
}

/** Renders the panel for a new partida and waits until it is ready for actions. */
async function abrirPanel(eventos: Evento[] = [], config: ConfigPartida = configPrueba()) {
  const id = await crearPartida(eventos, config);
  const panel = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });
  await screen.findByRole('heading', { name: 'Juego de prueba' });
  return { id, ...panel };
}

/** Waits until the saved log ends with `ultimo`, `cantidad` events long. */
async function esperarEventos(id: string, cantidad: number, ultimo?: Evento) {
  await waitFor(async () => {
    const eventos = await eventosGuardados(id);
    expect(eventos).toHaveLength(cantidad);
    if (ultimo !== undefined) {
      expect(eventos.at(-1)).toEqual(ultimo);
    }
  });
}

function avisoTeclado() {
  return screen.getByRole('status', { name: 'Aviso del teclado' });
}

describe('Panel keyboard shortcuts', () => {
  it('reveals the answer with its number', async () => {
    const { id, usuario } = await abrirPanel(EN_JUEGO);

    await usuario.keyboard('2');
    await esperarEventos(id, 4, { tipo: 'REVELAR', indice: 1 });
  });

  it('marks a strike with X', async () => {
    const { id, usuario } = await abrirPanel(EN_JUEGO);

    await usuario.keyboard('x');
    await esperarEventos(id, 4, { tipo: 'TACHE' });
  });

  it('assigns the face-off turn with A and B', async () => {
    const { id, usuario } = await abrirPanel();

    await usuario.keyboard('b');
    await esperarEventos(id, 1, { tipo: 'ASIGNAR_TURNO', equipo: 1 });
  });

  it('takes "Jugar" with the space bar once the face-off is won', async () => {
    const { id, usuario } = await abrirPanel(CARA_A_CARA_GANADO);

    await usuario.keyboard(' ');
    await esperarEventos(id, 3, { tipo: 'JUGAR' });
  });

  it('undoes the last action with Z', async () => {
    const { id, usuario } = await abrirPanel(EN_JUEGO);

    await usuario.keyboard('z');
    await esperarEventos(id, 2);
  });

  it('reveals every answer with R at the end of the round', async () => {
    const { id, usuario } = await abrirPanel(FIN_DE_RONDA);

    await usuario.keyboard('r');
    await esperarEventos(id, FIN_DE_RONDA.length + 1, { tipo: 'REVELAR_TODAS' });
  });

  it('moves to the next round with the space bar, confirming while answers are hidden', async () => {
    const { id, usuario } = await abrirPanel(FIN_DE_RONDA);

    await usuario.keyboard(' ');
    const dialogo = await screen.findByRole('dialog', {
      name: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
    });
    expect(await eventosGuardados(id)).toHaveLength(FIN_DE_RONDA.length);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Siguiente ronda' }));
    await esperarEventos(id, FIN_DE_RONDA.length + 1, { tipo: 'SIGUIENTE_RONDA' });
  });

  it('runs the shortcut, not the focused button, when the space bar is pressed', async () => {
    const { id, usuario } = await abrirPanel(FIN_DE_RONDA);
    (await botonHabilitado('Revelar todas')).focus();

    await usuario.keyboard(' ');
    expect(
      await screen.findByRole('dialog', {
        name: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
      }),
    ).toBeInTheDocument();
    expect(await eventosGuardados(id)).toHaveLength(FIN_DE_RONDA.length);
  });

  it('toggles the sound with M', async () => {
    const { usuario } = await abrirPanel(EN_JUEGO);
    const silenciar = screen.getByRole('button', { name: 'Silenciar sonido' });

    await usuario.keyboard('m');
    expect(silenciar).toHaveAttribute('aria-pressed', 'true');
    await usuario.keyboard('M');
    expect(silenciar).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the shortcut sheet with ? and from the header', async () => {
    const { usuario } = await abrirPanel(EN_JUEGO);

    await usuario.keyboard('?');
    const hoja = await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    expect(within(hoja).getByText('Deshacer la última acción.')).toBeInTheDocument();
    expect(hoja.querySelectorAll('kbd').length).toBeGreaterThan(8);

    await usuario.keyboard('?');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Atajos de teclado' }));
    const otraVez = await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    await usuario.click(within(otraVez).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).not.toBeInTheDocument();
  });

  it('announces why a shortcut is not available right now', async () => {
    const { id, usuario } = await abrirPanel();
    const motivo = screen.getByRole('button', { name: 'Revelar la respuesta 1' }).title;
    expect(motivo).not.toBe('');

    await usuario.keyboard('1');
    expect(avisoTeclado()).toHaveTextContent(motivo);
    expect(await eventosGuardados(id)).toHaveLength(0);
  });

  it('announces that the previous move is still saving and drops the shortcut', async () => {
    const id = await crearPartida(EN_JUEGO);
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    const { partidas } = entorno.repositorios;
    const { usuario } = renderizarPanel({
      repositorios: {
        ...entorno.repositorios,
        partidas: {
          ...partidas,
          agregarEvento: async (partidaId: string, evento: Evento) => {
            await retenido;
            return partidas.agregarEvento(partidaId, evento);
          },
        },
      },
      partidaId: id,
    });
    await screen.findByRole('heading', { name: 'Juego de prueba' });

    await usuario.keyboard('2');
    await usuario.keyboard('3');
    expect(avisoTeclado()).toHaveTextContent(
      'Espere un momento: se está guardando la jugada anterior.',
    );
    expect(fireEvent.keyDown(document.body, { key: ' ' })).toBe(false);
    // Mute and help never touch the saved log, so they keep working during a save.
    await usuario.keyboard('m');
    expect(screen.getByRole('button', { name: 'Silenciar sonido' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    soltar();
    await esperarEventos(id, EN_JUEGO.length + 1, { tipo: 'REVELAR', indice: 1 });
    await waitFor(() => {
      expect(avisoTeclado()).toBeEmptyDOMElement();
    });
    expect(await eventosGuardados(id)).toHaveLength(EN_JUEGO.length + 1);
  });

  it('ignores shortcuts with Ctrl, Alt or Meta and repeated key presses', async () => {
    const { id, usuario } = await abrirPanel(EN_JUEGO);

    await usuario.keyboard('{Control>}z{/Control}{Alt>}x{/Alt}{Meta>}2{/Meta}');
    fireEvent.keyDown(document.body, { key: 'x', repeat: true });
    expect(await eventosGuardados(id)).toHaveLength(EN_JUEGO.length);
    expect(avisoTeclado()).toBeEmptyDOMElement();
  });

  it('ignores shortcuts while a dialog is open', async () => {
    const { id, usuario } = await abrirPanel(EN_JUEGO);

    await usuario.click(await botonHabilitado('Terminar partida'));
    const dialogo = await screen.findByRole('dialog', { name: '¿Terminar la partida?' });
    await usuario.keyboard('xz2m?');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silenciar sonido' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(await eventosGuardados(id)).toHaveLength(EN_JUEGO.length);
  });

  it('ignores shortcuts while the host types an answer', async () => {
    const { id, usuario } = await abrirPanel(HASTA_RONDA_FINAL, CONFIG_FINAL);
    const campo = screen.getByLabelText('Respuesta del jugador 1 a la pregunta 1');

    await usuario.type(campo, 'zm ?');
    expect(campo).toHaveValue('zm ?');
    expect(screen.getByRole('timer', { name: 'Tiempo restante' })).toHaveTextContent('20 s');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silenciar sonido' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await eventosGuardados(id)).toHaveLength(HASTA_RONDA_FINAL.length);
  });

  it('starts and pauses the final-round timer with the space bar', async () => {
    const id = await crearPartida(HASTA_RONDA_FINAL, CONFIG_FINAL);
    const reloj = crearRelojManual();
    const { usuario } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      reloj,
    });
    const tiempo = await screen.findByRole('timer', { name: 'Tiempo restante' });

    await usuario.keyboard(' ');
    reloj.avanzar(3_000);
    expect(tiempo).toHaveTextContent('17 s');
    await usuario.keyboard(' ');
    reloj.avanzar(3_000);
    expect(tiempo).toHaveTextContent('17 s');
  });

  it('plays tache once each time the typed final-round answer becomes a repeat', async () => {
    const id = await crearPartida(
      [
        ...HASTA_RONDA_FINAL,
        { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0, texto: 'gato' },
        { tipo: 'RF_SIGUIENTE_JUGADOR' },
      ],
      CONFIG_FINAL,
    );
    const { usuario, sonidos } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });
    const campo = await screen.findByLabelText('Respuesta del jugador 2 a la pregunta 1');
    const coincidencia = screen.getByLabelText('Coincidencia del jugador 2 en la pregunta 1');

    await usuario.type(campo, 'perro');
    await usuario.selectOptions(coincidencia, '1. TXT_F1_0 (40 pts)');
    expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta repetida');
    expect(sonidos.reproducidos).toEqual(['tache']);

    await usuario.type(campo, 's');
    expect(sonidos.reproducidos).toEqual(['tache']);

    await usuario.selectOptions(coincidencia, '2. TXT_F1_1 (25 pts)');
    await usuario.selectOptions(coincidencia, '1. TXT_F1_0 (40 pts)');
    expect(sonidos.reproducidos).toEqual(['tache', 'tache']);
  });

  it('does not replay the repeat buzzer when the sound setup changes', async () => {
    const id = await crearPartida(
      [
        ...HASTA_RONDA_FINAL,
        { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0, texto: 'gato' },
        { tipo: 'RF_SIGUIENTE_JUGADOR' },
      ],
      CONFIG_FINAL,
    );
    const { usuario, sonidos, renovarReproductor } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });
    const campo = await screen.findByLabelText('Respuesta del jugador 2 a la pregunta 1');
    const coincidencia = screen.getByLabelText('Coincidencia del jugador 2 en la pregunta 1');
    await usuario.type(campo, 'perro');
    await usuario.selectOptions(coincidencia, '1. TXT_F1_0 (40 pts)');
    expect(sonidos.reproducidos).toEqual(['tache']);

    const silenciar = screen.getByRole('button', { name: 'Silenciar sonido' });
    await usuario.click(silenciar);
    await usuario.click(silenciar);
    renovarReproductor();
    expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta repetida');
    expect(sonidos.reproducidos).toEqual(['tache']);

    await usuario.selectOptions(coincidencia, '2. TXT_F1_1 (25 pts)');
    await usuario.selectOptions(coincidencia, '1. TXT_F1_0 (40 pts)');
    expect(sonidos.reproducidos).toEqual(['tache', 'tache']);
  });
});
