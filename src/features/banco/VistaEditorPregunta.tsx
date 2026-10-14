import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { DatosPregunta } from '@/shared/modelo';
import { RUTAS, rutaSetBanco } from '@/shared/rutas';

import { EditorPregunta } from './EditorPregunta';

/** Container for creating (`/preguntas/nueva`) or editing (`/preguntas/:preguntaId`) a question. */
export function VistaEditorPregunta() {
  const { setId = '', preguntaId } = useParams();
  const repositorios = useRepositorios();
  const navigate = useNavigate();
  const esNueva = preguntaId === undefined;

  // For each query: `null` = not found, `undefined` = still loading.
  const set = useLiveQuery(
    async () => (await repositorios.sets.obtener(setId)) ?? null,
    [repositorios, setId],
  );
  const pregunta = useLiveQuery(
    async () =>
      preguntaId === undefined
        ? null
        : ((await repositorios.preguntas.obtener(preguntaId)) ?? null),
    [repositorios, preguntaId],
  );
  const temas = useLiveQuery(
    () => repositorios.preguntas.listarTemas(setId),
    [repositorios, setId],
  );

  const volverAlSet = () => {
    void navigate(rutaSetBanco(setId));
  };

  async function guardar(datos: DatosPregunta) {
    if (preguntaId === undefined) {
      await repositorios.preguntas.crear(setId, datos);
    } else {
      await repositorios.preguntas.actualizar(preguntaId, datos);
    }
    volverAlSet();
  }

  if (set === undefined || pregunta === undefined || temas === undefined) {
    return <p className="mx-auto max-w-4xl text-slate-700">Cargando…</p>;
  }

  const preguntaValida = pregunta?.setId === setId ? pregunta : null;
  if (set === null || (!esNueva && preguntaValida === null)) {
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {set === null ? 'Set no encontrado' : 'Pregunta no encontrada'}
        </h1>
        <p className="text-slate-700">Es posible que se haya eliminado.</p>
        <Link
          to={set === null ? RUTAS.banco : rutaSetBanco(set.id)}
          className="font-semibold text-slate-900 underline"
        >
          {set === null ? 'Volver al banco de preguntas' : 'Volver al set'}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-editor" className="mx-auto max-w-4xl space-y-6">
      <Link
        to={rutaSetBanco(set.id)}
        className="inline-block font-semibold text-slate-800 underline"
      >
        <span aria-hidden="true">← </span>
        {set.nombre}
      </Link>
      <h1 id="titulo-editor" className="text-3xl font-bold tracking-tight">
        {esNueva ? 'Nueva pregunta' : 'Editar pregunta'}
      </h1>
      <EditorPregunta
        // Remount per question so the form starts from fresh data; later live updates
        // never overwrite what the user is typing.
        key={preguntaId ?? 'nueva'}
        inicial={preguntaValida ?? undefined}
        temas={temas}
        onGuardar={guardar}
        onCancelar={volverAlSet}
      />
    </section>
  );
}
