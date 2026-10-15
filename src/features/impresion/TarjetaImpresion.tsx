import { useId } from 'react';

import { cx } from '@/shared/utils/cx';

import type { Tarjeta, TarjetasPorHoja } from './dominio';

interface TarjetaImpresionProps {
  tarjeta: Tarjeta;
  porHoja: TarjetasPorHoja;
  /** Extra classes for the cell (the dashed cut lines). */
  className?: string;
}

/** One printed host card: label, short id, tema, the question in large type and its answers. */
export function TarjetaImpresion({ tarjeta, porHoja, className }: TarjetaImpresionProps) {
  const idEtiqueta = useId();
  const grande = porHoja === 2;

  if (tarjeta.tipo === 'aviso') {
    return (
      <article
        aria-labelledby={idEtiqueta}
        className={cx('flex min-h-0 flex-col gap-2 break-inside-avoid p-4', className)}
      >
        <span id={idEtiqueta} className="text-sm font-bold tracking-wide uppercase">
          {tarjeta.etiqueta}
        </span>
        <p className="rounded border-2 border-dashed border-slate-500 p-3 font-semibold">
          {tarjeta.mensaje}
        </p>
      </article>
    );
  }

  return (
    <article
      aria-labelledby={idEtiqueta}
      className={cx(
        'flex min-h-0 flex-col break-inside-avoid',
        grande ? 'gap-3 p-5' : 'gap-2 p-3',
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-slate-900 pb-1 text-sm">
        <span id={idEtiqueta} className="font-bold tracking-wide uppercase">
          {tarjeta.etiqueta}
        </span>
        {tarjeta.etiquetaPuntos !== null && (
          <span className="rounded border-2 border-slate-900 px-1.5 font-bold">
            {tarjeta.etiquetaPuntos}
          </span>
        )}
        <span className="ml-auto font-mono text-slate-700">ID {tarjeta.idCorto}</span>
      </header>
      {tarjeta.tema !== '' && (
        <p className="text-sm font-semibold text-slate-700">Tema: {tarjeta.tema}</p>
      )}
      <h3 className={cx('leading-tight font-bold', grande ? 'text-2xl' : 'text-lg')}>
        {tarjeta.texto}
      </h3>
      <ol className={cx('divide-y divide-slate-300', grande ? 'text-lg' : 'text-sm')}>
        {tarjeta.respuestas.map((respuesta, indice) => (
          <li key={indice} className="flex items-baseline gap-2 py-0.5">
            <span className="w-6 shrink-0 font-bold tabular-nums">{indice + 1}.</span>
            <span className="min-w-0 flex-1">
              {respuesta.texto}
              {respuesta.sinonimos.length > 0 && (
                <span className={cx('text-slate-600', grande ? 'text-sm' : 'text-xs')}>
                  {' '}
                  ({respuesta.sinonimos.join(', ')})
                </span>
              )}
            </span>
            <span className="shrink-0 text-right font-bold tabular-nums">{respuesta.puntos}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
