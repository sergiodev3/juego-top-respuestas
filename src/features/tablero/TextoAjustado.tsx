import { useLayoutEffect, useRef, useState } from 'react';

import { cx } from '@/shared/utils/cx';

/** Below this the text is unreadable from the back of a classroom; it is clipped instead. */
export const ESCALA_MINIMA = 0.4;

interface TextoAjustadoProps {
  texto: string;
  className?: string;
}

/**
 * One line of text that shrinks to fit the width it is given, so a long answer never wraps
 * into the fixed-height slot of the board. The natural width is measured on the unscaled text
 * (a `transform` does not change layout), so one measurement is exact and cannot loop.
 */
export function TextoAjustado({ texto, className }: TextoAjustadoProps) {
  const caja = useRef<HTMLSpanElement>(null);
  const interior = useRef<HTMLSpanElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const cajaActual = caja.current;
    const interiorActual = interior.current;
    if (!cajaActual || !interiorActual) {
      return;
    }
    const medir = () => {
      const natural = interiorActual.offsetWidth;
      const disponible = cajaActual.clientWidth;
      // No layout (e.g. jsdom, hidden tab): keep the natural size.
      setEscala(
        natural > 0 && disponible > 0
          ? Math.max(Math.min(1, disponible / natural), ESCALA_MINIMA)
          : 1,
      );
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    // The box changes with the window; the text with a late font load.
    const observador = new ResizeObserver(medir);
    observador.observe(cajaActual);
    observador.observe(interiorActual);
    return () => {
      observador.disconnect();
    };
  }, [texto]);

  return (
    <span ref={caja} data-ajuste="caja" className={cx('block min-w-0 overflow-hidden', className)}>
      <span
        ref={interior}
        data-ajuste="texto"
        className="inline-block whitespace-nowrap"
        style={{ transform: `scale(${String(escala)})`, transformOrigin: 'left center' }}
      >
        {texto}
      </span>
    </span>
  );
}
