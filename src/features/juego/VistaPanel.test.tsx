// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Repositorios } from '@/db/repositorios';
import type { ConfigPartida, Evento } from '@/engine';
import type { Partida } from '@/shared/modelo';
import { RUTAS } from '@/shared/rutas';
import { crearCanal } from '@/shared/sync';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';
import { crearBusMemoria } from '@/test/transporteMemoria';

import {
  botonHabilitado,
  crearVentanasFalsas,
  renderizarPanel,
  ultimaVista,
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

const TRES_EQUIPOS = configPrueba({
  equipos: [
    { id: 'e1', nombre: 'Rojos', color: '#b91c1c' },
    { id: 'e2', nombre: 'Azules', color: '#1d4ed8' },
    { id: 'e3', nombre: 'Verdes', color: '#15803d' },
  ],
});

async function crearPartida(config: ConfigPartida = configPrueba(), eventos: Evento[] = []) {
  const partida = await entorno.repositorios.partidas.crear({ juegoId: 'juego-1', config });
  for (const evento of eventos) {
    await entorno.repositorios.partidas.agregarEvento(partida.id, evento);
  }
  return partida.id;
}

async function eventosGuardados(id: string): Promise<Evento[]> {
  return (await entorno.repositorios.partidas.obtener(id))?.eventos ?? [];
}

function guia() {
  return screen.getByRole('status', { name: 'Siguiente paso' });
}

/** Waits for the guidance after an action is saved. */
async function esperarGuia(texto: string) {
  await waitFor(() => {
    expect(guia()).toHaveTextContent(texto);
  });
}

function respuesta(numero: number) {
  const items = within(screen.getByRole('list', { name: 'Respuestas' })).getAllByRole('listitem');
  const item = items[numero - 1];
  if (item === undefined) {
    throw new Error(`No hay respuesta ${String(numero)}`);
  }
  return item;
}

async function pulsar(usuario: ReturnType<typeof renderizarPanel>['usuario'], nombre: string) {
  await usuario.click(await botonHabilitado(nombre));
}

describe('VistaPanel: loading and layout', () => {
  it('shows the current question with every answer, its points, synonyms and board marker', async () => {
    const id = await crearPartida();
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    expect(await screen.findByRole('heading', { name: 'Juego de prueba' })).toBeInTheDocument();
    expect(screen.getByText('Ronda 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Puntos x1')).toBeInTheDocument();
    expect(screen.getByText('Fase: Cara a cara')).toBeInTheDocument();
    expect(screen.getByText('Tablero desconectado')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pregunta R1' })).toBeInTheDocument();
    expect(respuesta(1)).toHaveTextContent('TXT_R1_0');
    expect(respuesta(1)).toHaveTextContent('40 pts');
    expect(respuesta(1)).toHaveTextContent('Sinónimos: SIN_R1_0');
    expect(respuesta(1)).toHaveTextContent('Oculta');
    expect(
      within(screen.getByRole('list', { name: 'Respuestas' })).getAllByRole('listitem'),
    ).toHaveLength(5);
    expect(guia()).toHaveTextContent(
      'Cara a cara: asigna el turno al equipo que presionó primero el botón.',
    );
  });

  it('enables each action only when the engine accepts it and explains why not', async () => {
    const id = await crearPartida();
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    const tache = await screen.findByRole('button', { name: 'Tache' });
    expect(tache).toHaveAttribute('aria-disabled', 'true');
    expect(tache).toHaveAccessibleDescription('Primero indica qué equipo presionó el botón.');
    expect(screen.getByRole('button', { name: 'Revelar la respuesta 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Turno: Equipo A' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    const deshacer = screen.getByRole('button', { name: 'Deshacer' });
    expect(deshacer).toHaveAccessibleDescription('No hay acciones para deshacer.');
  });

  it('plays a short round with clicks, saves every event and never leaks hidden answers', async () => {
    const id = await crearPartida();
    const { usuario, bus } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await pulsar(usuario, 'Turno: Equipo B');
    await esperarGuia('Responde Equipo B.');
    await pulsar(usuario, 'Revelar la respuesta 2');
    await pulsar(usuario, 'Turno: Equipo A');
    await pulsar(usuario, 'Revelar la respuesta 1');
    await esperarGuia('Equipo A gana el cara a cara. Pregúntale si juega o pasa.');
    await pulsar(usuario, 'Jugar');
    await pulsar(usuario, 'Revelar la respuesta 3');
    await pulsar(usuario, 'Tache');
    await pulsar(usuario, 'Tache');
    await pulsar(usuario, 'Tache');
    await esperarGuia('Equipo B intenta robar.');
    await pulsar(usuario, 'Revelar la respuesta 4');

    await screen.findByText(/Equipo B gana 92 puntos/u);
    expect(respuesta(4)).toHaveTextContent('Visible en el tablero');
    expect(respuesta(5)).toHaveTextContent('Oculta');
    expect(await eventosGuardados(id)).toEqual([
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
      { tipo: 'ROBO_EXITOSO', indice: 3 },
    ]);
    const marcador = screen.getByRole('list', { name: 'Marcador' });
    expect(within(marcador).getAllByRole('listitem')[1]).toHaveTextContent('92');

    const publicadas = vistasPublicadas(bus);
    expect(publicadas.length).toBeGreaterThan(5);
    expect(ultimaVista(bus)?.equipos.map((equipo) => equipo.puntaje)).toEqual([0, 92]);
    const cable = JSON.stringify(bus.enviados);
    expect(cable).not.toContain('TXT_R1_4');
    expect(cable).not.toContain('SIN_');
    expect(cable).not.toContain('TXT_R2_');
  });

  it('undoes the last action', async () => {
    const id = await crearPartida();
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await pulsar(usuario, 'Turno: Equipo A');
    await esperarGuia('Responde Equipo A.');
    await pulsar(usuario, 'Deshacer');

    await screen.findByText(
      'Cara a cara: asigna el turno al equipo que presionó primero el botón.',
    );
    expect(await eventosGuardados(id)).toEqual([]);
  });

  it('keeps the state and explains the problem when an action cannot be saved', async () => {
    const id = await crearPartida();
    const repositorios: Repositorios = {
      ...entorno.repositorios,
      partidas: {
        ...entorno.repositorios.partidas,
        agregarEvento: vi.fn(() => Promise.reject(new Error('disco lleno'))),
      },
    };
    const { usuario } = renderizarPanel({ repositorios, partidaId: id });

    await pulsar(usuario, 'Turno: Equipo A');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar la acción. El juego sigue como estaba; intenta de nuevo.',
    );
    expect(guia()).toHaveTextContent('Cara a cara: asigna el turno');
    expect(await eventosGuardados(id)).toEqual([]);
  });

  it('resumes the exact state after a reload', async () => {
    const id = await crearPartida();
    const primera = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });
    await pulsar(primera.usuario, 'Turno: Equipo A');
    await pulsar(primera.usuario, 'Revelar la respuesta 1');
    await pulsar(primera.usuario, 'Jugar');
    await pulsar(primera.usuario, 'Tache');
    primera.unmount();

    renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    expect(await screen.findByText(/Equipo A tiene el control/u)).toBeInTheDocument();
    expect(respuesta(1)).toHaveTextContent('Visible en el tablero');
    expect(screen.getByText('Tachas: 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Puntos en juego: 40')).toBeInTheDocument();
  });
});

describe('VistaPanel: rounds and teams', () => {
  it('confirms before moving on while answers are still hidden', async () => {
    const id = await crearPartida(configPrueba(), [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
      { tipo: 'ROBO_FALLIDO' },
    ]);
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await pulsar(usuario, 'Siguiente ronda');
    const dialogo = await screen.findByRole('dialog', {
      name: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
    });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(await eventosGuardados(id)).toHaveLength(7);

    await pulsar(usuario, 'Siguiente ronda');
    await usuario.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
        }),
      ).getByRole('button', { name: 'Siguiente ronda' }),
    );

    expect(await screen.findByText('Ronda 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('Puntos x2')).toBeInTheDocument();
    expect((await eventosGuardados(id)).at(-1)).toEqual({ tipo: 'SIGUIENTE_RONDA' });
  });

  it('passes the turn to a chosen team when there are 3 teams', async () => {
    const id = await crearPartida(TRES_EQUIPOS, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
    ]);
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    const propio = await screen.findByRole('button', { name: 'Pasar a Rojos' });
    expect(propio).toHaveAttribute('aria-disabled', 'true');
    expect(propio).toHaveAccessibleDescription(
      'Pasa el turno a un equipo distinto del que ganó el cara a cara.',
    );
    await pulsar(usuario, 'Pasar a Azules');

    expect(await screen.findByText(/Azules tiene el control/u)).toBeInTheDocument();
    expect((await eventosGuardados(id)).at(-1)).toEqual({ tipo: 'PASAR', equipo: 1 });
  });

  it('adjusts a team score from a dialog', async () => {
    const id = await crearPartida();
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await pulsar(usuario, 'Ajustar puntos');
    const dialogo = await screen.findByRole('dialog', { name: 'Ajustar puntos' });
    await usuario.selectOptions(within(dialogo).getByLabelText('Equipo'), 'Equipo B');
    const delta = within(dialogo).getByLabelText('Puntos a sumar o restar');
    await usuario.clear(delta);
    await usuario.type(delta, '-5');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar ajuste' }));

    await expect
      .poll(() => eventosGuardados(id))
      .toEqual([{ tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: -5 }]);
    const marcador = screen.getByRole('list', { name: 'Marcador' });
    await expect
      .poll(() => within(marcador).getAllByRole('listitem')[1]?.textContent)
      .toContain('-5');
  });

  it('ends the partida after confirmation and shows the final scores', async () => {
    const id = await crearPartida(configPrueba(), [
      { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 30 },
    ]);
    const { usuario } = renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    await pulsar(usuario, 'Terminar partida');
    const dialogo = await screen.findByRole('dialog', { name: '¿Terminar la partida?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Terminar partida' }));

    expect(await screen.findByRole('heading', { name: 'Juego terminado' })).toBeInTheDocument();
    expect(screen.getByText('¡Gana Equipo B!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument();
    await expect
      .poll(async () => (await entorno.repositorios.partidas.obtener(id))?.estado)
      .toBe('terminada');
  });
});

describe('VistaPanel: recovery', () => {
  it('offers to end a partida that cannot be rebuilt instead of crashing', async () => {
    const dañada = {
      id: 'dañada',
      juegoId: 'juego-1',
      config: { nombre: 'Roto' } as unknown as ConfigPartida,
      eventos: [],
      estado: 'enCurso',
      creadoEn: 1,
      actualizadoEn: 1,
      eliminadoEn: null,
    } satisfies Partida;
    await entorno.db.partidas.add(dañada);
    const { usuario } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: 'dañada',
    });

    expect(
      await screen.findByRole('heading', { name: 'No se puede abrir la partida' }),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Terminar partida' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Terminar esta partida?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Terminar partida' }));

    expect(await screen.findByText('La partida se dio por terminada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument();
    expect((await entorno.repositorios.partidas.obtener('dañada'))?.estado).toBe('terminada');
  });

  it('says when the partida does not exist', async () => {
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: 'no-existe' });

    expect(await screen.findByText('No se encontró la partida solicitada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminar partida' })).not.toBeInTheDocument();
  });

  it('mentions stored actions that were skipped because they were not valid', async () => {
    const id = await crearPartida();
    await entorno.db.partidas.update(id, { eventos: [{ tipo: 'TACHE' }] });
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: id });

    expect(
      await screen.findByText('Se omitió 1 acción guardada que no era válida.'),
    ).toBeInTheDocument();
  });
});

describe('VistaPanel: projector board', () => {
  it('opens the board with instructions and shows when it is connected', async () => {
    const id = await crearPartida();
    const bus = crearBusMemoria();
    const { usuario, ventanas } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      bus,
    });

    await usuario.click(
      await screen.findByRole('button', { name: 'Abrir tablero en el proyector' }),
    );

    expect(ventanas.open).toHaveBeenCalledWith('/tablero', 'top-respuestas-tablero');
    const dialogo = await screen.findByRole('dialog', {
      name: 'Coloca el tablero en el proyector',
    });
    expect(dialogo).toHaveTextContent('Pantalla completa');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendido' }));

    const tablero = crearCanal(bus.crearTransporte());
    act(() => {
      tablero.publicar({ v: 1, tipo: 'SOLICITAR_ESTADO' });
    });
    expect(await screen.findByText('Tablero conectado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconectar tablero' })).toBeInTheDocument();
    expect(ultimaVista(bus)?.ronda?.pregunta).toBe('Pregunta R1');
  });

  it('asks to allow pop-ups when the browser blocks the board window', async () => {
    const id = await crearPartida();
    const { usuario } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      ventanas: crearVentanasFalsas(true),
    });

    await usuario.click(
      await screen.findByRole('button', { name: 'Abrir tablero en el proyector' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El navegador bloqueó la ventana del tablero.',
    );
  });
});

describe('VistaPanel: without a partida id', () => {
  it('opens the partida in progress', async () => {
    await crearPartida();
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: '', ruta: RUTAS.panel });

    expect(await screen.findByRole('heading', { name: 'Juego de prueba' })).toBeInTheDocument();
  });

  it('explains how to start a game when none is in progress', async () => {
    renderizarPanel({ repositorios: entorno.repositorios, partidaId: '', ruta: RUTAS.panel });

    expect(await screen.findByText('No hay una partida en curso.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo juego rápido' })).toHaveAttribute(
      'href',
      RUTAS.juegoRapido,
    );
  });
});
