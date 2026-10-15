import type { VistaTablero } from '@/engine';
import { cx } from '@/shared/utils/cx';

import { NumeroAnimado } from './NumeroAnimado';

interface MarcadorProps {
  vista: VistaTablero;
}

function etiquetaEquipo(vista: VistaTablero, indice: number): string | null {
  const ronda = vista.ronda;
  if (ronda === null) {
    return null;
  }
  if (vista.fase === 'enJuego' && ronda.equipoControl === indice) {
    return 'En turno';
  }
  if (vista.fase === 'robo' && ronda.equipoRobo === indice) {
    return 'Roba';
  }
  return null;
}

/** Team scores in team colors (all AA with white text), with the team in control marked. */
export function Marcador({ vista }: MarcadorProps) {
  return (
    <ul
      aria-label="Marcador"
      className="grid shrink-0 auto-cols-fr grid-flow-col gap-[clamp(0.5rem,1.5vw,1.5rem)]"
    >
      {vista.equipos.map((equipo, indice) => {
        const etiqueta = etiquetaEquipo(vista, indice);
        return (
          <li
            // Teams never reorder during a partida, so the index is a stable key.
            key={indice}
            style={{ backgroundColor: equipo.color }}
            className={cx(
              'flex min-w-0 flex-col items-center rounded-2xl px-[clamp(0.5rem,1.5vw,1.5rem)] py-[clamp(0.25rem,1vh,0.75rem)] text-white',
              etiqueta !== null && 'ring-8 ring-amber-300',
            )}
          >
            <span className="max-w-full truncate text-tablero-sm font-bold">{equipo.nombre}</span>
            <span className="sr-only">{`${String(equipo.puntaje)} puntos`}</span>
            <NumeroAnimado
              valor={equipo.puntaje}
              className="text-tablero-xl leading-none font-black tabular-nums"
            />
            {etiqueta !== null && (
              <span className="mt-1 rounded-full bg-amber-300 px-[0.75em] py-[0.1em] text-tablero-xs font-bold text-slate-950">
                {etiqueta}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
