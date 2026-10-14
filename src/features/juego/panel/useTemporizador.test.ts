// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RelojTemporizador } from './useTemporizador';
import { useTemporizador } from './useTemporizador';

function crearRelojManual() {
  let momento = 0;
  const tareas = new Set<() => void>();
  const reloj: RelojTemporizador = {
    ahora: () => momento,
    programar(tarea) {
      tareas.add(tarea);
      return () => {
        tareas.delete(tarea);
      };
    },
  };
  return {
    reloj,
    avanzar(ms: number) {
      momento += ms;
      act(() => {
        for (const tarea of [...tareas]) {
          tarea();
        }
      });
    },
  };
}

describe('useTemporizador', () => {
  it('resets, stopped, when the player changes even if both players have the same seconds', () => {
    const { reloj, avanzar } = crearRelojManual();
    const { result, rerender } = renderHook(
      ({ jugador }: { jugador: number }) => useTemporizador(20, reloj, jugador),
      { initialProps: { jugador: 1 } },
    );

    act(() => {
      result.current.iniciar();
    });
    avanzar(5_000);
    expect(result.current.temporizador).toEqual({ restante: 15, total: 20, corriendo: true });

    rerender({ jugador: 2 });

    expect(result.current.temporizador).toEqual({ restante: 20, total: 20, corriendo: false });
  });

  it('resets when the configured seconds change', () => {
    const { reloj, avanzar } = crearRelojManual();
    const { result, rerender } = renderHook(
      ({ segundos }: { segundos: number }) => useTemporizador(segundos, reloj, 1),
      { initialProps: { segundos: 20 } },
    );

    act(() => {
      result.current.iniciar();
    });
    avanzar(3_000);
    rerender({ segundos: 25 });

    expect(result.current.temporizador).toEqual({ restante: 25, total: 25, corriendo: false });
  });
});
