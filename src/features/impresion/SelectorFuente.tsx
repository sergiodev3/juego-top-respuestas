import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { rutaImpresion } from '@/shared/rutas';

import type { TarjetasPorHoja } from './dominio';

interface SelectorFuenteProps {
  /** Layout kept in the links, so a chosen layout survives picking another source. */
  porHoja: TarjetasPorHoja;
}

function textoCantidad(cantidad: number, singular: string, plural: string): string {
  return `${String(cantidad)} ${cantidad === 1 ? singular : plural}`;
}

const CLASE_OPCION =
  'block rounded-lg border border-slate-300 bg-white p-3 hover:border-slate-900 hover:bg-slate-100';

/** Picks what to print: a whole set (with its question count) or a saved game. */
export function SelectorFuente({ porHoja }: SelectorFuenteProps) {
  const repositorios = useRepositorios();
  const sets = useLiveQuery(() => repositorios.sets.listar(), [repositorios]);
  const conteo = useLiveQuery(() => repositorios.preguntas.contarPorSet(), [repositorios]);
  const juegos = useLiveQuery(() => repositorios.juegos.listar(), [repositorios]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby="titulo-imprimir-sets" className="space-y-2">
        <h2 id="titulo-imprimir-sets" className="text-lg font-semibold">
          Un set completo
        </h2>
        {sets === undefined || conteo === undefined ? (
          <p className="text-slate-700">Cargando sets…</p>
        ) : sets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
            Todavía no hay sets. Crea uno en el banco de preguntas o importa un archivo.
          </p>
        ) : (
          <ul className="space-y-2">
            {sets.map((set) => {
              const total = conteo[set.id] ?? 0;
              return (
                <li key={set.id}>
                  {total === 0 ? (
                    <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
                      <span className="block font-semibold text-slate-700">{set.nombre}</span>
                      <span className="block text-sm text-slate-600">
                        Este set no tiene preguntas.
                      </span>
                    </div>
                  ) : (
                    <Link to={rutaImpresion({ set: set.id, porHoja })} className={CLASE_OPCION}>
                      <span className="block font-semibold text-slate-900">{set.nombre}</span>
                      <span className="block text-sm text-slate-600">
                        {textoCantidad(total, 'pregunta', 'preguntas')}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-imprimir-juegos" className="space-y-2">
        <h2 id="titulo-imprimir-juegos" className="text-lg font-semibold">
          Las preguntas de un juego guardado
        </h2>
        {juegos === undefined ? (
          <p className="text-slate-700">Cargando juegos…</p>
        ) : juegos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
            Todavía no hay juegos guardados. Configura uno en «Configurar juego».
          </p>
        ) : (
          <ul className="space-y-2">
            {juegos.map((juego) => (
              <li key={juego.id}>
                <Link to={rutaImpresion({ juego: juego.id, porHoja })} className={CLASE_OPCION}>
                  <span className="block font-semibold text-slate-900">{juego.nombre}</span>
                  <span className="block text-sm text-slate-600">
                    {textoCantidad(juego.rondas.length, 'ronda', 'rondas')}
                    {juego.reglas.rondaFinal.activa && ' y ronda final'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
