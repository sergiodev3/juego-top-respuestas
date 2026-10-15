// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proyectarTablero, reducir, type Evento, type VistaTablero } from '@/engine';
import type { EstadoTablero } from '@/shared/sync';
import { configPrueba } from '@/test/fabricasPartida';

import { PantallaTablero } from './PantallaTablero';

const CONFIG = configPrueba();

const RONDA_1_GANADA: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
];
const RONDA_2: Evento[] = [...RONDA_1_GANADA, { tipo: 'SIGUIENTE_RONDA' }];

function vistaTras(eventos: Evento[]): VistaTablero {
  const estado = reducir(CONFIG, eventos);
  expect(estado.advertencias).toEqual([]);
  return proyectarTablero(CONFIG, estado);
}

const RONDA_FINAL: VistaTablero = {
  ...vistaTras(RONDA_2),
  fase: 'rondaFinal',
  ronda: null,
  rondaFinal: {
    equipo: 0,
    jugadorActual: 1,
    jugadores: [
      { jugador: 1, oculto: false, respuestas: [{ numero: 1, revelada: false }] },
      { jugador: 2, oculto: true, respuestas: [{ numero: 1, revelada: false }] },
    ],
    total: 0,
    meta: 200,
    resultado: null,
  },
};

let secuencia = 0;

function partida(vista: VistaTablero, partidaId = 'p1'): EstadoTablero {
  secuencia += 1;
  return { tipo: 'partida', partidaId, secuencia, vista, temporizador: null };
}

function tarjeta(): HTMLElement | null {
  return screen.queryByRole('region', { name: 'Presentación de la ronda' });
}

function enTarjeta() {
  const presentacion = tarjeta();
  if (presentacion === null) {
    throw new Error('The round title card is not on screen');
  }
  return within(presentacion);
}

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Let motion finish its entrance animations while the timers are still fake.
  avanzar(5000);
  vi.useRealTimers();
});

describe('round title card', () => {
  it('presents a new round for about 3 s, then shows its question', () => {
    const { rerender } = render(<PantallaTablero estado={partida(vistaTras(RONDA_1_GANADA))} />);

    rerender(<PantallaTablero estado={partida(vistaTras(RONDA_2))} />);
    expect(enTarjeta().getByText('Juego de prueba')).toBeInTheDocument();
    expect(enTarjeta().getByText('Ronda 2 de 2')).toBeInTheDocument();
    expect(enTarjeta().getByText('Puntos dobles')).toBeInTheDocument();

    avanzar(2999);
    expect(tarjeta()).not.toBeNull();
    avanzar(1);
    expect(tarjeta()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pregunta R2' })).toBeInTheDocument();
  });

  it('does not present the round on mount, on reconnect, or when undoing to an earlier round', () => {
    const { rerender } = render(<PantallaTablero estado={partida(vistaTras(RONDA_2))} />);
    expect(tarjeta()).toBeNull();

    rerender(<PantallaTablero estado={{ tipo: 'sinPartida', nombreJuego: 'Juego de prueba' }} />);
    rerender(<PantallaTablero estado={partida(vistaTras(RONDA_2))} />);
    expect(tarjeta()).toBeNull();

    rerender(<PantallaTablero estado={partida(vistaTras(RONDA_1_GANADA))} />);
    expect(tarjeta()).toBeNull();
  });

  it('leaves out the multiplier on a regular-points round', () => {
    const { rerender } = render(<PantallaTablero estado={partida(vistaTras([]))} />);
    // A round with the same number in another partida is not a round start.
    rerender(<PantallaTablero estado={partida(vistaTras(RONDA_1_GANADA), 'p2')} />);
    expect(tarjeta()).toBeNull();

    const vista = vistaTras(RONDA_2);
    const ronda = vista.ronda;
    if (ronda === null) {
      throw new Error('Round 2 has no view');
    }
    rerender(
      <PantallaTablero
        estado={partida({ ...vista, ronda: { ...ronda, multiplicador: 1 } }, 'p2')}
      />,
    );

    expect(enTarjeta().getByText('Ronda 2 de 2')).toBeInTheDocument();
    expect(enTarjeta().queryByText(/Puntos (dobles|triples)/)).not.toBeInTheDocument();
  });

  it('presents the final round when it starts', () => {
    const { rerender } = render(<PantallaTablero estado={partida(vistaTras(RONDA_2))} />);

    rerender(<PantallaTablero estado={partida(RONDA_FINAL)} />);
    expect(enTarjeta().getByText('Juego de prueba')).toBeInTheDocument();
    expect(enTarjeta().getByText('Ronda final')).toBeInTheDocument();

    avanzar(3000);
    expect(tarjeta()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ronda final: Equipo A' })).toBeInTheDocument();
  });
});
