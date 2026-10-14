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
    <ul aria-label="Marcador" className="grid auto-cols-fr grid-flow-col gap-4">
      {vista.equipos.map((equipo, indice) => {
        const etiqueta = etiquetaEquipo(vista, indice);
        return (
          <li
            // Teams never reorder during a partida, so the index is a stable key.
            key={indice}
            style={{ backgroundColor: equipo.color }}
            className={cx(
              'flex flex-col items-center rounded-2xl px-4 py-3 text-white',
              etiqueta !== null && 'ring-8 ring-amber-300',
            )}
          >
            <span className="text-3xl font-bold md:text-4xl">{equipo.nombre}</span>
            <span className="sr-only">{`${String(equipo.puntaje)} puntos`}</span>
            <NumeroAnimado
              valor={equipo.puntaje}
              className="text-5xl font-extrabold tabular-nums md:text-7xl"
            />
            {etiqueta !== null && (
              <span className="mt-1 rounded-full bg-amber-300 px-4 py-1 text-xl font-bold text-slate-950 md:text-2xl">
                {etiqueta}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
