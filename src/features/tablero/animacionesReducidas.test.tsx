// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

function partida(eventos: Evento[]): EstadoTablero {
  const vista: VistaTablero = proyectarTablero(CONFIG, reducir(CONFIG, eventos));
  return { tipo: 'partida', partidaId: 'p1', secuencia: 1, vista, temporizador: null };
}

beforeAll(() => {
  // motion reads `prefers-reduced-motion` once per module load, so stub it for the whole file.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion'),
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  vi.useRealTimers();
});

describe('board with prefers-reduced-motion: reduce', () => {
  it('shows new scores, pot and revealed answers in their final state at once', () => {
    const ganada: Evento[] = [
      ...EN_JUEGO,
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'REVELAR', indice: 3 },
    ];
    const { rerender } = render(<PantallaTablero estado={partida(ganada)} />);
    const bolsa = partida([...ganada, { tipo: 'REVELAR', indice: 4 }]);

    rerender(<PantallaTablero estado={bolsa} />);

    const marcador = within(screen.getByRole('list', { name: 'Marcador' }));
    expect(marcador.getByText('100 puntos')).toBeInTheDocument();
    expect(marcador.getByText('100')).toHaveAttribute('aria-hidden', 'true');
    const respuestas = within(screen.getByRole('list', { name: 'Respuestas' }));
    expect(respuestas.getAllByRole('listitem').at(4)?.textContent).toMatch(/^5TXT_R1_4/);
  });

  it('counts the pot without animation', () => {
    const { rerender } = render(<PantallaTablero estado={partida(EN_JUEGO)} />);
    const siguiente = partida([...EN_JUEGO, { tipo: 'REVELAR', indice: 1 }]);
    const bolsa = siguiente.tipo === 'partida' ? siguiente.vista.ronda?.bolsa : undefined;

    rerender(<PantallaTablero estado={siguiente} />);

    const anuncio = screen.getByText(`Puntos en juego: ${String(bolsa)}`);
    expect(within(anuncio.parentElement ?? document.body).getByText(String(bolsa))).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('still shows the strike overlay, without motion, and removes it', () => {
    const { rerender } = render(<PantallaTablero estado={partida(EN_JUEGO)} />);

    rerender(<PantallaTablero estado={partida([...EN_JUEGO, { tipo: 'TACHE' }])} />);
    expect(screen.getByRole('img', { name: '1 tacha' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole('img', { name: /tacha/ })).not.toBeInTheDocument();
  });

  it('shows and hides the round title card without motion', () => {
    const ganada: Evento[] = [
      ...EN_JUEGO,
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'REVELAR', indice: 4 },
    ];
    const { rerender } = render(<PantallaTablero estado={partida(ganada)} />);

    rerender(<PantallaTablero estado={partida([...ganada, { tipo: 'SIGUIENTE_RONDA' }])} />);
    const tarjeta = screen.getByRole('region', { name: 'Presentación de la ronda' });
    expect(within(tarjeta).getByText('Ronda 2 de 2')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      screen.queryByRole('region', { name: 'Presentación de la ronda' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pregunta R2' })).toBeInTheDocument();
  });

  it('still shows the single face-off miss X, without motion', () => {
    const { rerender } = render(<PantallaTablero estado={partida([])} />);

    rerender(
      <PantallaTablero
        estado={partida([{ tipo: 'ASIGNAR_TURNO', equipo: 0 }, { tipo: 'TACHE' }])}
      />,
    );
    const aviso = screen.getByRole('img', { name: '1 tacha' });
    expect(within(aviso).getAllByText('X')).toHaveLength(1);
  });
});
