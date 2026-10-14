// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCursorInactivo, type Temporizadores } from './useCursorInactivo';

/** Manual scheduler: nothing runs until `avanzar` moves its clock past a task's deadline. */
function crearTemporizadoresManuales() {
  let ahora = 0;
  let siguienteId = 0;
  const pendientes = new Map<number, { vence: number; accion: () => void }>();
  const temporizadores: Temporizadores = {
    programar(accion, ms) {
      const id = siguienteId++;
      pendientes.set(id, { vence: ahora + ms, accion });
      return () => {
        pendientes.delete(id);
      };
    },
  };
  return {
    temporizadores,
    pendientes: () => pendientes.size,
    avanzar(ms: number) {
      ahora += ms;
      for (const [id, tarea] of [...pendientes]) {
        if (tarea.vence <= ahora) {
          pendientes.delete(id);
          act(tarea.accion);
        }
      }
    },
  };
}

function moverRaton() {
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove'));
  });
}

describe('useCursorInactivo', () => {
  it('reports the cursor as idle after 3 s without mouse movement', () => {
    const reloj = crearTemporizadoresManuales();
    const { result } = renderHook(() => useCursorInactivo(3000, reloj.temporizadores));

    expect(result.current).toBe(false);
    reloj.avanzar(2999);
    expect(result.current).toBe(false);
    reloj.avanzar(1);
    expect(result.current).toBe(true);
  });

  it('shows the cursor again on movement and restarts the 3 s count', () => {
    const reloj = crearTemporizadoresManuales();
    const { result } = renderHook(() => useCursorInactivo(3000, reloj.temporizadores));
    reloj.avanzar(3000);

    moverRaton();
    expect(result.current).toBe(false);
    reloj.avanzar(2000);
    moverRaton();
    reloj.avanzar(2000);
    expect(result.current).toBe(false);
    reloj.avanzar(1000);
    expect(result.current).toBe(true);
  });

  it('stops listening and cancels its timer on unmount', () => {
    const reloj = crearTemporizadoresManuales();
    const { unmount } = renderHook(() => useCursorInactivo(3000, reloj.temporizadores));

    unmount();
    moverRaton();

    expect(reloj.pendientes()).toBe(0);
  });
});
