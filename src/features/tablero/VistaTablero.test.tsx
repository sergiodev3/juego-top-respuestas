// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proyectarTablero, reducir, type Evento, type VistaTablero } from '@/engine';
import { CanalSyncProvider, crearCanal, type Canal, type MensajeSync } from '@/shared/sync';
import { configPrueba, preguntaSnapshotPrueba } from '@/test/fabricasPartida';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { VistaTablero as VistaTableroRuta } from './VistaTablero';

const CONFIG = configPrueba();

function vistaTras(eventos: Evento[]): VistaTablero {
  const estado = reducir(CONFIG, eventos);
  expect(estado.advertencias).toEqual([]);
  return proyectarTablero(CONFIG, estado);
}

let bus: ReturnType<typeof crearBusMemoria>;
let panel: Canal;

beforeEach(() => {
  bus = crearBusMemoria();
  panel = crearCanal(bus.crearTransporte());
});

function renderizar() {
  render(
    <CanalSyncProvider canal={crearCanal(bus.crearTransporte())}>
      <VistaTableroRuta />
    </CanalSyncProvider>,
  );
}

function enviar(mensaje: MensajeSync | Record<string, unknown>) {
  const transporte = bus.crearTransporte();
  act(() => {
    transporte.enviar(mensaje);
  });
}

function estado(
  vista: VistaTablero,
  secuencia = 1,
  temporizador: { restante: number; total: number; corriendo: boolean } | null = null,
): MensajeSync {
  return { v: 1, tipo: 'ESTADO_TABLERO', partidaId: 'p1', secuencia, vista, temporizador };
}

const EN_JUEGO: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
  { tipo: 'TACHE' },
  { tipo: 'TACHE' },
  { tipo: 'REVELAR', indice: 2 },
];

describe('VistaTablero', () => {
  it('shows the waiting screen until the panel sends a state, and after SIN_PARTIDA', () => {
    renderizar();

    expect(screen.getByRole('heading', { name: 'Top Respuestas' })).toBeInTheDocument();
    expect(screen.getByText('Esperando al conductor…')).toBeInTheDocument();

    act(() => {
      panel.publicar(estado(vistaTras(EN_JUEGO)));
    });
    expect(screen.queryByText('Esperando al conductor…')).not.toBeInTheDocument();

    act(() => {
      panel.publicar({ v: 1, tipo: 'SIN_PARTIDA' });
    });
    expect(screen.getByText('Esperando al conductor…')).toBeInTheDocument();
  });

  it('keeps showing the last game name on the waiting screen after SIN_PARTIDA', () => {
    renderizar();
    act(() => {
      panel.publicar(estado(vistaTras(EN_JUEGO)));
    });

    act(() => {
      panel.publicar({ v: 1, tipo: 'SIN_PARTIDA' });
    });

    expect(screen.getByRole('heading', { name: 'Juego de prueba' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Top Respuestas' })).not.toBeInTheDocument();
    expect(screen.getByText('Esperando al conductor…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pregunta R1' })).not.toBeInTheDocument();
  });

  it('asks the panel for the state as soon as it opens', () => {
    renderizar();

    expect(bus.enviados).toContainEqual({ v: 1, tipo: 'SOLICITAR_ESTADO' });
  });

  it('renders the round: question, numbered slots, revealed answers, strikes, pot and scores', () => {
    renderizar();
    const vista = vistaTras(EN_JUEGO);

    act(() => {
      panel.publicar(estado(vista));
    });

    expect(screen.getByRole('heading', { name: 'Juego de prueba' })).toBeInTheDocument();
    expect(screen.getByText('Ronda 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pregunta R1' })).toBeInTheDocument();
    const casillas = within(screen.getByRole('list', { name: 'Respuestas' })).getAllByRole(
      'listitem',
    );
    expect(casillas.map((casilla) => casilla.textContent)).toEqual([
      '1TXT_R1_040',
      '2',
      '3TXT_R1_215',
      '4',
      '5',
    ]);
    expect(screen.getByLabelText('Tachas: 2 de 3')).toBeInTheDocument();
    expect(screen.getByText(`Puntos en juego: ${String(vista.ronda?.bolsa)}`)).toBeInTheDocument();
    const marcador = screen.getByRole('list', { name: 'Marcador' });
    expect(within(marcador).getByText('Equipo A')).toBeInTheDocument();
    expect(within(marcador).getByText('Equipo B')).toBeInTheDocument();
    expect(within(marcador).getByText('En turno')).toBeInTheDocument();
  });

  it('shows answer points and the pot already multiplied in an x2 round', () => {
    renderizar();
    const doble = configPrueba({
      rondas: [{ pregunta: preguntaSnapshotPrueba('R1', [30, 20, 10]), multiplicador: 2 }],
    });
    const vista = proyectarTablero(
      doble,
      reducir(doble, [
        { tipo: 'ASIGNAR_TURNO', equipo: 0 },
        { tipo: 'REVELAR', indice: 0 },
        { tipo: 'JUGAR' },
        { tipo: 'REVELAR', indice: 2 },
      ]),
    );

    act(() => {
      panel.publicar(estado(vista));
    });

    expect(screen.getByText('Puntos x2')).toBeInTheDocument();
    const casillas = within(screen.getByRole('list', { name: 'Respuestas' })).getAllByRole(
      'listitem',
    );
    expect(casillas.map((casilla) => casilla.textContent)).toEqual([
      '1TXT_R1_060',
      '2',
      '3TXT_R1_220',
    ]);
    expect(screen.getByText('Puntos en juego: 80')).toBeInTheDocument();
  });

  it('never shows hidden answers, synonyms or data outside the projection', () => {
    renderizar();
    const vista = vistaTras(EN_JUEGO);

    enviar({ ...estado(vista), vista: { ...vista, secreto: 'SECRETO_PANEL' }, extra: 'SECRETO' });

    const texto = document.body.textContent;
    expect(texto).toContain('TXT_R1_0');
    for (const oculto of ['TXT_R1_1', 'TXT_R1_3', 'TXT_R1_4', 'SIN_R1', 'SECRETO', 'Pregunta R2']) {
      expect(texto).not.toContain(oculto);
    }
  });

  it('ignores invalid and stale messages', () => {
    renderizar();
    act(() => {
      panel.publicar(estado(vistaTras(EN_JUEGO), 10));
    });

    enviar({ v: 1, tipo: 'ESTADO_TABLERO', partidaId: 'p1', secuencia: 11, vista: {} });
    act(() => {
      panel.publicar(estado({ ...vistaTras([]), nombreJuego: 'Viejo' }, 9));
    });

    expect(screen.getByRole('heading', { name: 'Juego de prueba' })).toBeInTheDocument();
    expect(screen.queryByText('Viejo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tachas: 2 de 3')).toBeInTheDocument();
  });

  it('announces the round winner with the awarded points', () => {
    renderizar();
    const vista = vistaTras([
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'REVELAR', indice: 4 },
    ]);

    act(() => {
      panel.publicar(estado(vista));
    });

    expect(screen.getByText('¡Equipo A gana 100 puntos!')).toBeInTheDocument();
  });

  it('renders the final round: hidden player 1, revealed answers, total vs goal and timer', () => {
    renderizar();
    const vista: VistaTablero = {
      nombreJuego: 'Gran final',
      fase: 'rondaFinal',
      equipos: [
        { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 300 },
        { nombre: 'Equipo B', color: '#b91c1c', puntaje: 120 },
      ],
      ronda: null,
      rondaFinal: {
        equipo: 0,
        jugadorActual: 2,
        jugadores: [
          { jugador: 1, oculto: true, respuestas: [{ numero: 1, revelada: false }] },
          {
            jugador: 2,
            oculto: false,
            respuestas: [
              { numero: 1, revelada: true, texto: 'Perro', puntos: 30 },
              { numero: 2, revelada: true, texto: '', puntos: 0 },
              { numero: 3, revelada: false },
            ],
          },
        ],
        total: 75,
        meta: 200,
        resultado: null,
      },
    };

    act(() => {
      panel.publicar(estado(vista, 1, { restante: 12.4, total: 25, corriendo: true }));
    });

    expect(screen.getByRole('heading', { name: 'Ronda final: Equipo A' })).toBeInTheDocument();
    const jugador1 = screen.getByRole('region', { name: 'Jugador 1' });
    expect(within(jugador1).getByText('Respuestas ocultas')).toBeInTheDocument();
    const jugador2 = screen.getByRole('region', { name: 'Jugador 2' });
    expect(within(jugador2).getByText('Perro')).toBeInTheDocument();
    expect(within(jugador2).getByText('30')).toBeInTheDocument();
    // An answer recorded without text and without a match.
    expect(within(jugador2).getByText('Sin respuesta')).toBeInTheDocument();
    expect(screen.getByText('Total: 75 de 200')).toBeInTheDocument();
    expect(screen.getByLabelText('Tiempo restante: 13 segundos')).toHaveTextContent('13');
  });

  it('shows the final-round result and the winner when the game is over', () => {
    renderizar();
    const vista: VistaTablero = {
      nombreJuego: 'Gran final',
      fase: 'juegoTerminado',
      equipos: [
        { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 300 },
        { nombre: 'Equipo B', color: '#b91c1c', puntaje: 120 },
      ],
      ronda: null,
      rondaFinal: {
        equipo: 0,
        jugadorActual: 2,
        jugadores: [
          { jugador: 1, oculto: false, respuestas: [] },
          { jugador: 2, oculto: false, respuestas: [] },
        ],
        total: 210,
        meta: 200,
        resultado: { total: 210, meta: 200, superoMeta: true },
      },
    };

    act(() => {
      panel.publicar(estado(vista));
    });

    expect(screen.getByText('Juego terminado')).toBeInTheDocument();
    expect(screen.getByText('¡Gana Equipo A!')).toBeInTheDocument();
    expect(screen.getByText('¡Meta alcanzada!')).toBeInTheDocument();
  });

  it('announces a tie when the game ends with equal top scores', () => {
    renderizar();
    const vista = { ...vistaTras([{ tipo: 'TERMINAR_JUEGO' }]) };

    act(() => {
      panel.publicar(estado(vista));
    });

    expect(screen.getByText('¡Empate!')).toBeInTheDocument();
  });
});

describe('VistaTablero fullscreen button', () => {
  afterEach(() => {
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    Reflect.deleteProperty(document, 'fullscreenElement');
  });

  it('requests fullscreen on click and hides while fullscreen', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).not.toBeInTheDocument();
  });

  it('is not offered when the browser cannot go fullscreen', () => {
    renderizar();

    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).not.toBeInTheDocument();
  });
});

describe('VistaTablero idle cursor', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  });

  it('hides the cursor and the fullscreen button after 3 s still, and shows them on movement', () => {
    vi.useFakeTimers();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    renderizar();
    expect(screen.getByRole('main')).not.toHaveClass('cursor-none');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('main')).toHaveClass('cursor-none');
    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(screen.getByRole('main')).not.toHaveClass('cursor-none');
    expect(screen.getByRole('button', { name: 'Pantalla completa' })).toBeInTheDocument();
  });
});
