import { cx } from '@/shared/utils/cx';

import { CLASE_HOJA } from './clasesHoja';
import type { Marcador } from './dominio';

interface HojaMarcadorProps {
  marcador: Marcador;
}

const CELDA = 'border-2 border-black px-2';

/**
 * Paper scoreboard: one row per team (or blank rows to fill in), one column per round and the
 * total, with tall empty cells to write the points by hand. Team names stay in text, so a
 * black-and-white print still works; the color swatch is only a hint.
 */
export function HojaMarcador({ marcador }: HojaMarcadorProps) {
  return (
    <section aria-label="Hoja de marcador" className={cx(CLASE_HOJA, 'flex flex-col gap-6')}>
      <p className="self-end text-lg">
        Fecha: <span aria-hidden="true" className="inline-block w-48 border-b-2 border-black" />
      </p>
      <table className="w-full table-fixed border-collapse text-lg">
        <caption className="pb-4 text-left text-3xl font-bold">{marcador.titulo}</caption>
        <thead>
          <tr>
            <th scope="col" className={cx(CELDA, 'w-1/4 py-2 text-left')}>
              Equipo
            </th>
            {marcador.columnas.map((columna) => (
              <th key={columna.etiqueta} scope="col" className={cx(CELDA, 'py-2 text-center')}>
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {marcador.equipos.map((equipo, indice) => (
            // Rows never reorder and team names may repeat, so the position is the key.
            <tr key={`fila-${String(indice)}`} className="h-24">
              <th scope="row" className={cx(CELDA, 'text-left font-semibold break-words')}>
                {equipo.nombre === null ? (
                  <span className="sr-only">Equipo {indice + 1}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    {equipo.color !== null && (
                      <span
                        aria-hidden="true"
                        className="size-4 shrink-0 rounded-sm border border-black [print-color-adjust:exact]"
                        style={{ backgroundColor: equipo.color }}
                      />
                    )}
                    {equipo.nombre}
                  </span>
                )}
              </th>
              {marcador.columnas.map((columna) => (
                <td key={columna.etiqueta} className={CELDA} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-slate-700 print:text-black">
        Anota los puntos de cada ronda y súmalos en «Total».
      </p>
    </section>
  );
}
