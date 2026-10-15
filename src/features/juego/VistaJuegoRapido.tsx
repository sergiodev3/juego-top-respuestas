import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { Juego } from '@/shared/modelo';
import { RUTAS } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_PRIMARIO } from '@/shared/ui/clases';

import { crearConfigPartida, crearJuegoRapido } from './dominio';
import { textoPreguntas } from './textos';
import { useIniciarPartida } from './useIniciarPartida';

interface VistaJuegoRapidoProps {
  /** Random source in [0, 1) used to pick the questions; injected in tests. */
  aleatorio?: () => number;
}

/**
 * "Nuevo juego rápido": choose a set (click 1) and press "Jugar" (click 2). Builds a default game
 * with up to 4 random questions of the set, saves it, and starts the partida.
 */
export function VistaJuegoRapido({ aleatorio = Math.random }: VistaJuegoRapidoProps) {
  const repositorios = useRepositorios();
  const id = useId();
  const sets = useLiveQuery(() => repositorios.sets.listar(), [repositorios]);
  const conteo = useLiveQuery(() => repositorios.preguntas.contarPorSet(), [repositorios]);
  const [setId, setSetId] = useState<string | null>(null);
  const [errores, setErrores] = useState<readonly string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  // Reused when "Jugar" is pressed again for the same set (e.g. after cancelling the dialog).
  const [creado, setCreado] = useState<{ setId: string; juego: Juego } | null>(null);
  const inicio = useIniciarPartida();

  async function jugar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores([]);
    const set = sets?.find((s) => s.id === setId);
    if (set === undefined) {
      setErrores(['Elige un set para jugar.']);
      return;
    }
    setOcupado(true);
    try {
      const preguntas = await repositorios.preguntas.listarPorSet(set.id);
      const juego =
        creado?.setId === set.id
          ? creado.juego
          : await repositorios.juegos.crear(crearJuegoRapido(set, preguntas, aleatorio));
      setCreado({ setId: set.id, juego });
      const resultado = crearConfigPartida(
        juego,
        new Map(preguntas.map((pregunta) => [pregunta.id, pregunta])),
      );
      if (!resultado.ok) {
        setErrores(resultado.errores);
        return;
      }
      await inicio.iniciar({ juegoId: juego.id, config: resultado.config });
    } catch {
      setErrores(['No se pudo iniciar la partida. Intenta de nuevo.']);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="titulo-rapido" className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-rapido" className="text-3xl font-bold tracking-tight">
          Nuevo juego rápido
        </h1>
        <p className="text-slate-700">
          Elige un set y presiona «Jugar»: 2 equipos, hasta 4 rondas con preguntas al azar del set y
          sin ronda final.
        </p>
      </header>

      <form noValidate onSubmit={(evento) => void jugar(evento)} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-lg font-semibold">Set de preguntas</legend>
          {sets === undefined || conteo === undefined ? (
            <p className="text-slate-700">Cargando sets…</p>
          ) : sets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
              Todavía no hay sets. Crea uno en el banco de preguntas o importa un archivo.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sets.map((set) => {
                const total = conteo[set.id] ?? 0;
                const idMotivo = `${id}-motivo-${set.id}`;
                return (
                  <li key={set.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-3 has-checked:border-slate-900 has-checked:ring-2 has-checked:ring-slate-900 has-disabled:cursor-not-allowed has-disabled:bg-slate-100">
                      <input
                        type="radio"
                        name={`${id}-set`}
                        value={set.id}
                        checked={setId === set.id}
                        disabled={total === 0}
                        aria-describedby={total === 0 ? idMotivo : undefined}
                        onChange={() => {
                          setSetId(set.id);
                          setErrores([]);
                        }}
                        className="mt-1 size-4"
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">{set.nombre}</span>
                        <span className="block text-sm text-slate-600">
                          {textoPreguntas(total)}
                        </span>
                      </span>
                    </label>
                    {total === 0 && (
                      <p id={idMotivo} className="mt-1 text-sm text-slate-600">
                        Este set no tiene preguntas.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        {errores.length > 0 && (
          <AvisoError>
            {errores.length === 1 ? (
              errores[0]
            ) : (
              <ul className="list-disc pl-6">
                {errores.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </AvisoError>
        )}
        {inicio.error !== null && <AvisoError>{inicio.error}</AvisoError>}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className={CLASE_BOTON_PRIMARIO}
            disabled={ocupado || inicio.ocupado}
          >
            Jugar
          </button>
          <Link to={RUTAS.configurarJuego} className="font-medium underline underline-offset-2">
            Configurar juego
          </Link>
        </div>
      </form>
      {inicio.dialogo}
    </section>
  );
}
