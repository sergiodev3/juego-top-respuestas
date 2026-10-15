import { cx } from '@/shared/utils/cx';

import { CLASE_HOJA } from './clasesHoja';
import { agruparEnHojas, type Marcador, type Tarjeta, type TarjetasPorHoja } from './dominio';
import { HojaMarcador } from './HojaMarcador';
import { TarjetaImpresion } from './TarjetaImpresion';

interface HojasImpresionProps {
  tarjetas: readonly Tarjeta[];
  porHoja: TarjetasPorHoja;
  /** Optional paper scoreboard, printed as one extra sheet after the cards. */
  marcador?: Marcador | null;
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
 * Portrait letter sheets as they print (see `CLASE_HOJA`), then the optional scoreboard sheet.
 * Every sheet is a child of the same container, so only the very last one skips the page break.
 */
export function HojasImpresion({ tarjetas, porHoja, marcador = null }: HojasImpresionProps) {
  const hojas = agruparEnHojas(tarjetas, porHoja);
  return (
    <div className="flex flex-col items-center gap-8 print:block">
      {hojas.map((hoja, indiceHoja) => (
        <section
          key={hoja[0]?.clave ?? indiceHoja}
          aria-label={`Hoja ${String(indiceHoja + 1)} de ${String(hojas.length)}`}
          className={cx(CLASE_HOJA, 'grid grid-rows-2', porHoja === 4 && 'grid-cols-2')}
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
      {marcador !== null && <HojaMarcador marcador={marcador} />}
    </div>
  );
}
