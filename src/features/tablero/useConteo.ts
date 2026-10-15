import { useEffect, useRef, useState } from 'react';

function suavizarSalida(progreso: number): number {
  return 1 - (1 - progreso) ** 3;
}

/**
 * Whole number that counts from the previous `valor` to the new one over `duracionMs`, starting
 * at `valor` on mount (nothing counts on load or reconnect). With `inmediato` it returns
 * `valor` right away. Driven by `requestAnimationFrame` looked up on each call (not captured at
 * import), so fake timers in tests control it.
 */
export function useConteo(valor: number, duracionMs: number, inmediato: boolean): number {
  const [mostrado, setMostrado] = useState(valor);
  // Exact (unrounded) value on screen, so a newer target continues from where the count is.
  const actual = useRef(valor);

  useEffect(() => {
    const desde = actual.current;
    if (desde === valor) {
      return;
    }
    const duracion = inmediato ? 0 : duracionMs;
    let inicio: number | null = null;
    let solicitud = requestAnimationFrame(function paso(ahora) {
      inicio ??= ahora;
      const progreso = duracion <= 0 ? 1 : Math.min(1, (ahora - inicio) / duracion);
      actual.current = desde + (valor - desde) * suavizarSalida(progreso);
      setMostrado(Math.round(actual.current));
      if (progreso < 1) {
        solicitud = requestAnimationFrame(paso);
      }
    });
    return () => {
      cancelAnimationFrame(solicitud);
    };
  }, [valor, duracionMs, inmediato]);

  return inmediato ? valor : mostrado;
}
