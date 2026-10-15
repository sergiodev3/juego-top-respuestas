import { useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { cx } from '@/shared/utils/cx';

import { useConteo } from './useConteo';

/** Count-up length when a number changes. */
const DURACION_CONTEO_MS = 800;

interface NumeroAnimadoProps {
  valor: number;
  className?: string;
}

/**
 * A number that counts up/down to its new value with a brief highlight. It starts at its value
 * on mount (no counting on load or reconnect) and jumps straight to it with reduced motion.
 * Visual only: it is `aria-hidden`, so the caller must render the final value for assistive
 * tech (e.g. in an `sr-only` span) and screen readers never hear intermediate numbers.
 */
export function NumeroAnimado({ valor, className }: NumeroAnimadoProps) {
  const reducido = useReducedMotion() ?? false;
  const mostrado = useConteo(valor, DURACION_CONTEO_MS, reducido);
  const [alcance, animar] = useAnimate<HTMLSpanElement>();
  const previo = useRef(valor);

  useEffect(() => {
    if (previo.current === valor) {
      return;
    }
    previo.current = valor;
    if (reducido) {
      return;
    }
    const realce = animar(
      alcance.current,
      { scale: [1, 1.2, 1] },
      { duration: DURACION_CONTEO_MS / 1000 },
    );
    return () => {
      realce.stop();
    };
  }, [valor, reducido, alcance, animar]);

  return (
    <span ref={alcance} aria-hidden="true" className={cx('inline-block', className)}>
      {mostrado}
    </span>
  );
}
