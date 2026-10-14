import { useId, type ReactNode } from 'react';

import {
  CLASE_BOTON_PELIGRO,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
} from '@/shared/ui/clases';
import { cx } from '@/shared/utils/cx';

import type { AccionPanel } from './useAccionesPanel';

const VARIANTES = {
  primario: CLASE_BOTON_PRIMARIO,
  secundario: CLASE_BOTON_SECUNDARIO,
  peligro: CLASE_BOTON_PELIGRO,
} as const;

interface BotonAccionProps {
  accion: Pick<AccionPanel, 'habilitada' | 'motivo' | 'ejecutar'>;
  children: ReactNode;
  /** Accessible name when the visible text is not enough (e.g. "Revelar la respuesta 3"). */
  etiqueta?: string;
  variante?: keyof typeof VARIANTES;
  className?: string;
}

/**
 * Panel action button. An unavailable action stays focusable (`aria-disabled`) and exposes the
 * reason as its accessible description and tooltip, so the host can always see why.
 */
export function BotonAccion({
  accion,
  children,
  etiqueta,
  variante = 'secundario',
  className,
}: BotonAccionProps) {
  const idMotivo = useId();
  const motivo = accion.habilitada ? null : accion.motivo;
  return (
    <>
      <button
        type="button"
        aria-label={etiqueta}
        aria-disabled={!accion.habilitada}
        aria-describedby={motivo === null ? undefined : idMotivo}
        title={motivo ?? undefined}
        onClick={() => {
          if (accion.habilitada) {
            void accion.ejecutar();
          }
        }}
        className={cx(
          VARIANTES[variante],
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
          className,
        )}
      >
        {children}
      </button>
      {motivo !== null && (
        <span id={idMotivo} hidden>
          {motivo}
        </span>
      )}
    </>
  );
}
