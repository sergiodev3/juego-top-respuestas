import { cx } from '@/shared/utils/cx';

import { agruparEnHojas, type Tarjeta, type TarjetasPorHoja } from './dominio';
import { TarjetaImpresion } from './TarjetaImpresion';

interface HojasImpresionProps {
  tarjetas: readonly Tarjeta[];
  porHoja: TarjetasPorHoja;
}

const CORTE = 'border-dashed border-slate-500';

/** Dashed cut lines between the cards of a sheet: one horizontal for 2, a cross for 4. */
function claseCorte(indice: number, porHoja: TarjetasPorHoja): string {
  if (porHoja === 2) {
    return indice === 0 ? cx('border-b-2', CORTE) : '';
  }
  return cx(indice % 2 === 0 && 'border-r-2', indice < 2 && 'border-b-2', CORTE);
}

/**
 * Portrait letter sheets as they print. On screen each sheet keeps the letter proportions with
 * padding standing in for the 10 mm page margin; in print the `@page` rule sets the margin and
 * each sheet fills one page (`break-after: page`) without splitting a card.
 */
export function HojasImpresion({ tarjetas, porHoja }: HojasImpresionProps) {
  const hojas = agruparEnHojas(tarjetas, porHoja);
  return (
    <div className="flex flex-col items-center gap-8 print:block">
      {hojas.map((hoja, indiceHoja) => (
        <section
          key={hoja[0]?.clave ?? indiceHoja}
          aria-label={`Hoja ${String(indiceHoja + 1)} de ${String(hojas.length)}`}
          className={cx(
            'grid aspect-[8.5/11] w-full max-w-[8.5in] grid-rows-2 bg-white p-[0.4in] text-slate-950 shadow-md ring-1 ring-slate-300',
            porHoja === 4 && 'grid-cols-2',
            'print:aspect-auto print:h-[257mm] print:max-w-none print:break-inside-avoid print:break-after-page print:p-0 print:text-black print:shadow-none print:ring-0 print:last:break-after-auto',
          )}
        >
          {hoja.map((tarjeta, indice) => (
            <TarjetaImpresion
              key={tarjeta.clave}
              tarjeta={tarjeta}
              porHoja={porHoja}
              className={claseCorte(indice, porHoja)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
