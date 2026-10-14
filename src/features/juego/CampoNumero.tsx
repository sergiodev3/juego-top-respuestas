import { useId } from 'react';

import { CLASE_CAMPO, CLASE_ETIQUETA } from '@/shared/ui/clases';

interface CampoNumeroProps {
  etiqueta: string;
  valor: number;
  minimo: number;
  maximo?: number;
  ayuda?: string;
  /** Receives `NaN` while the field is empty; the game schema reports it in Spanish. */
  onCambiar: (valor: number) => void;
}

/** Labelled integer input bound to a number (empty shows as blank, not 0). */
export function CampoNumero({
  etiqueta,
  valor,
  minimo,
  maximo,
  ayuda,
  onCambiar,
}: CampoNumeroProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={CLASE_ETIQUETA}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={minimo}
        max={maximo}
        value={Number.isNaN(valor) ? '' : valor}
        aria-describedby={ayuda === undefined ? undefined : `${id}-ayuda`}
        onChange={(evento) => {
          const texto = evento.target.value;
          onCambiar(texto === '' ? Number.NaN : Number(texto));
        }}
        className={`${CLASE_CAMPO} mt-1 w-32`}
      />
      {ayuda !== undefined && (
        <p id={`${id}-ayuda`} className="mt-1 text-sm text-slate-600">
          {ayuda}
        </p>
      )}
    </div>
  );
}
