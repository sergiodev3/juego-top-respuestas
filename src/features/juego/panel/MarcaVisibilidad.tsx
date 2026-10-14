import { cx } from '@/shared/utils/cx';

interface MarcaVisibilidadProps {
  visible: boolean;
  /** Shown by "Revelar todas" (no points). */
  sinPuntos?: boolean;
  /** Text when hidden (defaults to "Oculta"). */
  textoOculta?: string;
}

/** Whether the students see an answer on the board: icon, border and text, not color alone. */
export function MarcaVisibilidad({
  visible,
  sinPuntos = false,
  textoOculta = 'Oculta',
}: MarcaVisibilidadProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold whitespace-nowrap',
        visible
          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
          : 'border-dashed border-slate-500 bg-white text-slate-700',
      )}
    >
      <span aria-hidden="true">{visible ? '●' : '○'}</span>
      {visible ? `Visible en el tablero${sinPuntos ? ' (sin puntos)' : ''}` : textoOculta}
    </span>
  );
}
