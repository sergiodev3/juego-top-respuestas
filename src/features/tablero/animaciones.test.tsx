// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proyectarTablero, reducir, type Evento, type VistaTablero } from '@/engine';
import type { EstadoTablero } from '@/shared/sync';
import { configPrueba } from '@/test/fabricasPartida';

import { PantallaTablero } from './PantallaTablero';

const CONFIG = configPrueba();

const EN_JUEGO: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
];

function vistaTras(eventos: Evento[]): VistaTablero {
  const estado = reducir(CONFIG, eventos);
  expect(estado.advertencias).toEqual([]);
  return proyectarTablero(CONFIG, estado);
}

function partida(vista: VistaTablero): EstadoTablero {
  return { tipo: 'partida', partidaId: 'p1', secuencia: 1, vista, temporizador: null };
}

function montar(eventos: Evento[]) {
  const resultado = render(<PantallaTablero estado={partida(vistaTras(eventos))} />);
  return {
    actualizar(siguientes: Evento[]) {
      resultado.rerender(<PantallaTablero estado={partida(vistaTras(siguientes))} />);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Let every running animation finish while the timers are still fake: motion's frame loop
  // would otherwise wait forever on a fake animation frame that `useRealTimers` drops.
  avanzar(5000);
  vi.useRealTimers();
});

const RONDA_GANADA: Evento[] = [
  ...EN_JUEGO,
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
];

function equipo(nombre: string): HTMLElement {
  const fila = within(screen.getByRole('list', { name: 'Marcador' }))
    .getAllByRole('listitem')
    .find((item) => within(item).queryByText(nombre) !== null);
  if (fila === undefined) {
    throw new Error(`No scoreboard row for ${nombre}`);
  }
  return fila;
}

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function casillas(): (string | null)[] {
  return within(screen.getByRole('list', { name: 'Respuestas' }))
    .getAllByRole('listitem')
    .map((casilla) => casilla.textContent);
}

describe('answer flip', () => {
  it('renders the answers already revealed on mount right away', () => {
    montar([...EN_JUEGO, { tipo: 'REVELAR', indice: 2 }]);

    expect(casillas()).toEqual(['1TXT_R1_040', '2', '3TXT_R1_215', '4', '5']);
  });

  it('ends a newly revealed slot showing its text and points', () => {
    const tablero = montar(EN_JUEGO);

    tablero.actualizar([...EN_JUEGO, { tipo: 'REVELAR', indice: 2 }]);
    avanzar(1000);

    expect(casillas()).toEqual(['1TXT_R1_040', '2', '3TXT_R1_215', '4', '5']);
  });
});

describe('score animation', () => {
  it('shows the stored scores on mount without counting', () => {
    montar(RONDA_GANADA);

    expect(within(equipo('Equipo A')).getByText('100')).toBeInTheDocument();
    expect(within(equipo('Equipo A')).getByText('100 puntos')).toBeInTheDocument();
    expect(within(equipo('Equipo B')).getByText('0')).toBeInTheDocument();
  });

  it('exposes the new score to assistive tech at once and counts the visible number up to it', () => {
    const tablero = montar(RONDA_GANADA.slice(0, -1));
    expect(within(equipo('Equipo A')).getByText('0 puntos')).toBeInTheDocument();

    tablero.actualizar(RONDA_GANADA);
    expect(within(equipo('Equipo A')).getByText('100 puntos')).toBeInTheDocument();
    expect(within(equipo('Equipo A')).queryByText('100')).not.toBeInTheDocument();

    avanzar(1500);
    expect(within(equipo('Equipo A')).getByText('100')).toHaveAttribute('aria-hidden', 'true');
  });

  it('counts the round pot to its new value and announces only the final one', () => {
    const tablero = montar(EN_JUEGO);
    const antes = vistaTras(EN_JUEGO).ronda?.bolsa;
    const despues = vistaTras([...EN_JUEGO, { tipo: 'REVELAR', indice: 1 }]).ronda?.bolsa;
    expect(screen.getByText(`Puntos en juego: ${String(antes)}`)).toBeInTheDocument();

    tablero.actualizar([...EN_JUEGO, { tipo: 'REVELAR', indice: 1 }]);
    const anuncio = screen.getByText(`Puntos en juego: ${String(despues)}`);
    const bolsa = within(anuncio.parentElement ?? document.body);
    expect(bolsa.getByText(String(antes))).toHaveAttribute('aria-hidden', 'true');

    avanzar(1500);
    expect(bolsa.getByText(String(despues))).toHaveAttribute('aria-hidden', 'true');
  });
});

function vistaRondaFinal(revelada: boolean, total: number): VistaTablero {
  return {
    nombreJuego: 'Gran final',
    fase: 'rondaFinal',
    equipos: [
      { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 300 },
      { nombre: 'Equipo B', color: '#b91c1c', puntaje: 120 },
    ],
    ronda: null,
    rondaFinal: {
      equipo: 0,
      jugadorActual: 1,
      jugadores: [
        {
          jugador: 1,
          oculto: false,
          respuestas: [
            { numero: 1, revelada: true, texto: 'Perro', puntos: 30 },
            revelada
              ? { numero: 2, revelada: true, texto: 'Rojo', puntos: 45 }
              : { numero: 2, revelada: false },
          ],
        },
        { jugador: 2, oculto: false, respuestas: [] },
      ],
      total,
      meta: 200,
      resultado: null,
    },
  };
}

describe('final round animation', () => {
  it('shows revealed answers and the total on mount without animating', () => {
    render(<PantallaTablero estado={partida(vistaRondaFinal(true, 75))} />);

    const jugador1 = within(screen.getByRole('region', { name: 'Jugador 1' }));
    expect(jugador1.getByText('Perro')).toBeInTheDocument();
    expect(jugador1.getByText('Rojo')).toBeInTheDocument();
    const anuncio = screen.getByText('Total: 75 de 200');
    expect(within(anuncio.parentElement ?? document.body).getByText('75')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('reveals the new answer and counts the total up, announcing only the final total', () => {
    const { rerender } = render(<PantallaTablero estado={partida(vistaRondaFinal(false, 30))} />);

    rerender(<PantallaTablero estado={partida(vistaRondaFinal(true, 75))} />);
    const anuncio = screen.getByText('Total: 75 de 200');
    const total = within(anuncio.parentElement ?? document.body);
    expect(total.getByText('30')).toHaveAttribute('aria-hidden', 'true');

    avanzar(1500);
    const jugador1 = within(screen.getByRole('region', { name: 'Jugador 1' }));
    expect(jugador1.getByText('Rojo')).toBeInTheDocument();
    expect(jugador1.getByText('45')).toBeInTheDocument();
    expect(total.getByText('75')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('strike overlay', () => {
  it('shows one big X per current strike for a moment each time a strike is added', () => {
    const tablero = montar(EN_JUEGO);
    expect(screen.queryByRole('img', { name: /tacha/ })).not.toBeInTheDocument();

    tablero.actualizar([...EN_JUEGO, { tipo: 'TACHE' }]);
    const primera = screen.getByRole('img', { name: '1 tacha' });
    expect(within(primera).getAllByText('X')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    tablero.actualizar([...EN_JUEGO, { tipo: 'TACHE' }, { tipo: 'TACHE' }]);
    const segunda = screen.getByRole('img', { name: '2 tachas' });
    expect(within(segunda).getAllByText('X')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole('img', { name: /tacha/ })).not.toBeInTheDocument();
  });

  it('does not replay strikes the board already had when it mounted', () => {
    montar([...EN_JUEGO, { tipo: 'TACHE' }, { tipo: 'TACHE' }]);

    expect(screen.queryByRole('img', { name: /tacha/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tachas: 2 de 3')).toBeInTheDocument();
  });

  it('does not show the overlay when a strike is undone', () => {
    const tablero = montar([...EN_JUEGO, { tipo: 'TACHE' }, { tipo: 'TACHE' }]);

    tablero.actualizar([...EN_JUEGO, { tipo: 'TACHE' }]);

    expect(screen.queryByRole('img', { name: /tacha/ })).not.toBeInTheDocument();
  });
});
