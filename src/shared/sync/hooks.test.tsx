// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VistaTablero } from '@/engine';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { crearCanal, type Canal } from './canal';
import { CanalSyncProvider } from './CanalSyncProvider';
import { usePublicadorTablero, useSuscriptorTablero, type DatosTablero } from './hooks';
import type { MensajeSync } from './mensajes';

const VISTA: VistaTablero = {
  nombreJuego: 'Repaso',
  fase: 'caraACara',
  equipos: [
    { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 0 },
    { nombre: 'Equipo B', color: '#b91c1c', puntaje: 10 },
  ],
  ronda: null,
  rondaFinal: null,
};

function envoltorio(canal: Canal) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <CanalSyncProvider canal={canal}>{children}</CanalSyncProvider>;
  };
}

let bus: ReturnType<typeof crearBusMemoria>;

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  bus = crearBusMemoria();
});

afterEach(() => {
  vi.useRealTimers();
});

function tipos(): string[] {
  return bus.enviados.map((mensaje) => (mensaje as MensajeSync).tipo);
}

function renderPanel(datos: DatosTablero | null) {
  return renderHook((props: { datos: DatosTablero | null }) => usePublicadorTablero(props.datos), {
    initialProps: { datos },
    wrapper: envoltorio(crearCanal(bus.crearTransporte())),
  });
}

function renderTablero() {
  return renderHook(() => useSuscriptorTablero(), {
    wrapper: envoltorio(crearCanal(bus.crearTransporte())),
  });
}

describe('panel <-> board hooks', () => {
  it('a board that opens after the panel asks for the state and shows it', () => {
    renderPanel({ partidaId: 'p1', vista: VISTA, temporizador: null });

    const tablero = renderTablero();

    expect(tablero.result.current).toMatchObject({
      tipo: 'partida',
      partidaId: 'p1',
      vista: VISTA,
      temporizador: null,
    });
    expect(tipos()).toEqual(['ESTADO_TABLERO', 'SOLICITAR_ESTADO', 'ESTADO_TABLERO']);
  });

  it('publishes every change, skips identical data, and sends SIN_PARTIDA without a partida', () => {
    const tablero = renderTablero();
    const panel = renderPanel({ partidaId: 'p1', vista: VISTA, temporizador: null });
    const temporizador = { restante: 20, total: 20, corriendo: true };

    panel.rerender({ datos: { partidaId: 'p1', vista: { ...VISTA }, temporizador: null } });
    panel.rerender({ datos: { partidaId: 'p1', vista: VISTA, temporizador } });

    expect(tablero.result.current).toMatchObject({ tipo: 'partida', temporizador });

    panel.rerender({ datos: null });

    expect(tablero.result.current).toEqual({ tipo: 'sinPartida' });
    expect(tipos()).toEqual([
      'SOLICITAR_ESTADO',
      'ESTADO_TABLERO',
      'ESTADO_TABLERO',
      'SIN_PARTIDA',
    ]);
  });

  it('tells the board there is no partida when the panel goes away', () => {
    const tablero = renderTablero();
    const panel = renderPanel({ partidaId: 'p1', vista: VISTA, temporizador: null });

    panel.unmount();

    expect(tablero.result.current).toEqual({ tipo: 'sinPartida' });
  });

  it('shows the board as connected while heartbeats arrive every 2 s', () => {
    const panel = renderPanel({ partidaId: 'p1', vista: VISTA, temporizador: null });
    expect(panel.result.current.tableroConectado).toBe(false);

    const tablero = renderTablero();
    expect(panel.result.current.tableroConectado).toBe(true);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(panel.result.current.tableroConectado).toBe(true);
    expect(tipos().filter((tipo) => tipo === 'TABLERO_PRESENTE')).toHaveLength(5);

    tablero.unmount();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(panel.result.current.tableroConectado).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(panel.result.current.tableroConectado).toBe(false);
  });

  it('the board asks again when it becomes visible or regains focus', () => {
    renderTablero();

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(tipos()).toEqual(['SOLICITAR_ESTADO', 'SOLICITAR_ESTADO', 'SOLICITAR_ESTADO']);
  });

  it('the board keeps the newest view when an older message arrives late', () => {
    const tablero = renderTablero();
    const panel = crearCanal(bus.crearTransporte());
    const mensaje = (secuencia: number, nombreJuego: string): MensajeSync => ({
      v: 1,
      tipo: 'ESTADO_TABLERO',
      partidaId: 'p1',
      secuencia,
      vista: { ...VISTA, nombreJuego },
      temporizador: null,
    });

    act(() => {
      panel.publicar(mensaje(10, 'Nuevo'));
      panel.publicar(mensaje(9, 'Viejo'));
    });

    expect(tablero.result.current).toMatchObject({ vista: { nombreJuego: 'Nuevo' } });
  });
});
