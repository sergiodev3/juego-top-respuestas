import { useId, useState } from 'react';
import { Link } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { RUTAS } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';

import { ganadoresJuego } from '../dominio';
import { prepararConfigPartida, useIniciarPartida } from '../useIniciarPartida';
import type { PartidaCargada } from './usePartidaEnCurso';

/** "A", "A y B", "A, B y C". */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) {
    return nombres.join('');
  }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1) ?? ''}`;
}

/** End screen: winner(s), final scores, final-round result, and what to do next. */
export function FinDeJuego({ partida }: { partida: PartidaCargada }) {
  const id = useId();
  const repositorios = useRepositorios();
  const inicio = useIniciarPartida();
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config, estado } = partida;
  const { nombres } = ganadoresJuego(config, estado);
  const resultado = estado.rondaFinal?.resultado ?? null;
  const posiciones = config.equipos
    .map((equipo, indice) => ({ equipo, puntaje: estado.puntajes[indice] ?? 0 }))
    .toSorted((a, b) => b.puntaje - a.puntaje);

  /** Same game again: fresh questions from the bank when possible, else the same snapshot. */
  async function jugarDeNuevo() {
    setError(null);
    setPreparando(true);
    try {
      const juego = await repositorios.juegos.obtener(partida.juegoId);
      const preparada =
        juego === undefined ? null : await prepararConfigPartida(repositorios.preguntas, juego);
      await inicio.iniciar({
        juegoId: partida.juegoId,
        config: preparada?.ok === true ? preparada.config : config,
      });
    } catch {
      setError('No se pudo preparar la nueva partida. Intenta de nuevo.');
    } finally {
      setPreparando(false);
    }
  }

  return (
    <section
      aria-labelledby={id}
      className="space-y-5 rounded-xl border border-slate-300 bg-white p-6 shadow-sm"
    >
      <h2 id={id} className="text-3xl font-bold">
        Juego terminado
      </h2>
      {estado.fase !== 'juegoTerminado' && (
        <p className="text-slate-700">Esta partida se dio por terminada antes del final.</p>
      )}
      <p className="text-3xl font-extrabold text-slate-900">
        {nombres.length === 1
          ? `¡Gana ${enumerar(nombres)}!`
          : `¡Empate entre ${enumerar(nombres)}!`}
      </p>
      <ol aria-label="Puntajes finales" className="space-y-2">
        {posiciones.map(({ equipo, puntaje }) => (
          <li
            key={equipo.id}
            className="flex items-center gap-3 rounded-lg border border-slate-300 px-3 py-2"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: equipo.color }}
              className="size-5 shrink-0 rounded-full border border-slate-900"
            />
            <span className="flex-1 font-semibold">{equipo.nombre}</span>
            <span className="text-xl font-extrabold tabular-nums">{puntaje} puntos</span>
          </li>
        ))}
      </ol>
      {resultado !== null && (
        <p className="text-lg font-semibold">
          Ronda final: {resultado.total} de {resultado.meta} puntos.{' '}
          {resultado.superoMeta ? '¡Meta alcanzada!' : 'No alcanzaron la meta.'}
        </p>
      )}
      {error !== null && <AvisoError>{error}</AvisoError>}
      {inicio.error !== null && <AvisoError>{inicio.error}</AvisoError>}
      <div className="flex flex-wrap gap-3">
        <Link to={RUTAS.inicio} className={CLASE_BOTON_SECUNDARIO}>
          Volver al inicio
        </Link>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={preparando || inicio.ocupado}
          onClick={() => void jugarDeNuevo()}
        >
          Jugar de nuevo
        </button>
      </div>
      {inicio.dialogo}
    </section>
  );
}
