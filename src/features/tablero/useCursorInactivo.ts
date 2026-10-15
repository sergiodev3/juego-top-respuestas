import { useEffect, useState } from 'react';

/** Scheduler seam: `programar` runs `accion` after `ms` and returns a function that cancels it. */
export interface Temporizadores {
  programar(accion: () => void, ms: number): () => void;
}

export const TEMPORIZADORES_NAVEGADOR: Temporizadores = {
  programar(accion, ms) {
    const id = setTimeout(accion, ms);
    return () => {
      clearTimeout(id);
    };
  },
};

/** How long the mouse must stay still before the board hides the cursor. */
export const RETRASO_CURSOR_INACTIVO_MS = 3000;

/**
 * `true` once the mouse has not moved for `retrasoMs` (counting from mount), `false` again on the
 * next `mousemove`. The board uses it to hide the cursor and its on-screen controls.
 */
export function useCursorInactivo(
  retrasoMs: number = RETRASO_CURSOR_INACTIVO_MS,
  temporizadores: Temporizadores = TEMPORIZADORES_NAVEGADOR,
): boolean {
  const [inactivo, setInactivo] = useState(false);

  useEffect(() => {
    let cancelar = temporizadores.programar(() => {
      setInactivo(true);
    }, retrasoMs);
    const alMover = () => {
      cancelar();
      setInactivo(false);
      cancelar = temporizadores.programar(() => {
        setInactivo(true);
      }, retrasoMs);
    };
    window.addEventListener('mousemove', alMover);
    return () => {
      window.removeEventListener('mousemove', alMover);
      cancelar();
    };
  }, [retrasoMs, temporizadores]);

  return inactivo;
}
