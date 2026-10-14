import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { Pregunta } from '@/shared/modelo';
import { RUTAS, rutaEditarPregunta, rutaPreguntaNueva } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_ACCION,
  CLASE_BOTON_ACCION_PELIGRO,
  CLASE_BOTON_PRIMARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import { textoCantidadPreguntas, textoCantidadRespuestas } from './textos';

const TODOS_LOS_TEMAS = '';

/** Set detail: its questions with text search, topic filter, duplicate and delete. */
export function VistaSetBanco() {
  const { setId = '' } = useParams();
  const repositorios = useRepositorios();
  const [busqueda, setBusqueda] = useState('');
  const [temaElegido, setTemaElegido] = useState(TODOS_LOS_TEMAS);
  const [porEliminar, setPorEliminar] = useState<Pregunta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `null` = not found (or deleted); `undefined` = still loading.
  const set = useLiveQuery(
    async () => (await repositorios.sets.obtener(setId)) ?? null,
    [repositorios, setId],
  );
  const temas = useLiveQuery(
    () => repositorios.preguntas.listarTemas(setId),
    [repositorios, setId],
  );
  // A topic can disappear (its last question was deleted); fall back to all topics then.
  const tema = temas?.includes(temaElegido) ? temaElegido : TODOS_LOS_TEMAS;
  const preguntas = useLiveQuery(
    () =>
      repositorios.preguntas.buscar({
        setId,
        texto: busqueda,
        tema: tema === TODOS_LOS_TEMAS ? undefined : tema,
      }),
    [repositorios, setId, busqueda, tema],
  );
  const total = useLiveQuery(
    async () => (await repositorios.preguntas.listarPorSet(setId)).length,
    [repositorios, setId],
  );

  async function duplicar(pregunta: Pregunta) {
    setError(null);
    try {
      await repositorios.preguntas.duplicar(pregunta.id);
    } catch {
      setError('No se pudo duplicar la pregunta. Intenta de nuevo.');
    }
  }

  async function confirmarEliminacion() {
    if (!porEliminar) {
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      await repositorios.preguntas.eliminar(porEliminar.id);
    } catch {
      setError('No se pudo eliminar la pregunta. Intenta de nuevo.');
    } finally {
      setOcupado(false);
      setPorEliminar(null);
    }
  }

  if (set === undefined) {
    return <p className="mx-auto max-w-5xl text-slate-700">Cargando set…</p>;
  }

  if (set === null) {
    return (
      <section className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Set no encontrado</h1>
        <p className="text-slate-700">Es posible que se haya eliminado.</p>
        <Link to={RUTAS.banco} className="font-semibold text-slate-900 underline">
          Volver al banco de preguntas
        </Link>
      </section>
    );
  }

  const detalles = [set.materia, set.grupo && `Grupo ${set.grupo}`].filter(Boolean).join(' · ');
  const hayFiltros = busqueda.trim() !== '' || tema !== TODOS_LOS_TEMAS;

  return (
    <section aria-labelledby="titulo-set" className="mx-auto max-w-5xl space-y-6">
      <Link to={RUTAS.banco} className="inline-block font-semibold text-slate-800 underline">
        <span aria-hidden="true">← </span>Banco de preguntas
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 id="titulo-set" className="text-3xl font-bold tracking-tight">
            {set.nombre}
          </h1>
          {detalles && <p className="text-slate-700">{detalles}</p>}
          {total !== undefined && (
            <p className="text-sm text-slate-600">{textoCantidadPreguntas(total)}</p>
          )}
        </div>
        <Link to={rutaPreguntaNueva(set.id)} className={CLASE_BOTON_PRIMARIO}>
          Nueva pregunta
        </Link>
      </header>

      {error && <AvisoError>{error}</AvisoError>}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="buscar-preguntas" className={CLASE_ETIQUETA}>
            Buscar preguntas
          </label>
          <input
            id="buscar-preguntas"
            type="search"
            value={busqueda}
            placeholder="Texto de la pregunta"
            onChange={(evento) => {
              setBusqueda(evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="filtro-tema" className={CLASE_ETIQUETA}>
            Tema
          </label>
          <select
            id="filtro-tema"
            value={tema}
            onChange={(evento) => {
              setTemaElegido(evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          >
            <option value={TODOS_LOS_TEMAS}>Todos los temas</option>
            {temas?.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {preguntas === undefined ? (
        <p className="text-slate-700">Cargando preguntas…</p>
      ) : preguntas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          {hayFiltros
            ? 'Ninguna pregunta coincide con la búsqueda o el tema elegido.'
            : 'Este set todavía no tiene preguntas. Agrega una con «Nueva pregunta».'}
        </p>
      ) : (
        <ol className="space-y-3">
          {preguntas.map((pregunta) => (
            <li
              key={pregunta.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-lg font-semibold">{pregunta.texto}</p>
                <p className="flex flex-wrap gap-2 text-sm text-slate-700">
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-900">
                    {pregunta.tema || 'Sin tema'}
                  </span>
                  <span>{textoCantidadRespuestas(pregunta.respuestas.length)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Link
                  to={rutaEditarPregunta(set.id, pregunta.id)}
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Editar la pregunta ${pregunta.texto}`}
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Duplicar la pregunta ${pregunta.texto}`}
                  onClick={() => void duplicar(pregunta)}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  className={CLASE_BOTON_ACCION_PELIGRO}
                  aria-label={`Eliminar la pregunta ${pregunta.texto}`}
                  onClick={() => {
                    setPorEliminar(pregunta);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <DialogoConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar esta pregunta?"
        descripcion={
          <>
            <span className="font-semibold">«{porEliminar?.texto}»</span> se eliminará del set. Esta
            acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar pregunta"
        ocupado={ocupado}
        onConfirmar={() => void confirmarEliminacion()}
        onCancelar={() => {
          setPorEliminar(null);
        }}
      />
    </section>
  );
}
