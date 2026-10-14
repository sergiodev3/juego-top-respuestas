import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { DatosSet, SetPreguntas } from '@/shared/modelo';
import { RUTAS, rutaSetBanco } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_ACCION,
  CLASE_BOTON_ACCION_PELIGRO,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import { FormularioSet } from './FormularioSet';
import { textoCantidadPreguntas } from './textos';

type Edicion = { modo: 'crear' } | { modo: 'editar'; set: SetPreguntas } | null;

/** Question bank home: list, search, create, edit, duplicate and delete sets. */
export function VistaBanco() {
  const repositorios = useRepositorios();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [porEliminar, setPorEliminar] = useState<SetPreguntas | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sets = useLiveQuery(() => repositorios.sets.buscar(busqueda), [repositorios, busqueda]);
  const conteo = useLiveQuery(() => repositorios.preguntas.contarPorSet(), [repositorios]);

  async function guardarSet(datos: DatosSet) {
    if (edicion?.modo === 'editar') {
      await repositorios.sets.actualizar(edicion.set.id, datos);
      setEdicion(null);
    } else {
      const creado = await repositorios.sets.crear(datos);
      setEdicion(null);
      void navigate(rutaSetBanco(creado.id));
    }
  }

  async function duplicar(set: SetPreguntas) {
    setError(null);
    try {
      await repositorios.sets.duplicar(set.id);
    } catch {
      setError(`No se pudo duplicar el set «${set.nombre}». Intenta de nuevo.`);
    }
  }

  async function confirmarEliminacion() {
    if (!porEliminar) {
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      await repositorios.sets.eliminar(porEliminar.id);
    } catch {
      setError(`No se pudo eliminar el set «${porEliminar.nombre}». Intenta de nuevo.`);
    } finally {
      setOcupado(false);
      setPorEliminar(null);
    }
  }

  const preguntasPorEliminar = porEliminar ? (conteo?.[porEliminar.id] ?? 0) : 0;

  return (
    <section aria-labelledby="titulo-banco" className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 id="titulo-banco" className="text-3xl font-bold tracking-tight">
            Banco de preguntas
          </h1>
          <p className="text-slate-700">Organiza tus preguntas en sets por materia o grupo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={RUTAS.importar} className={CLASE_BOTON_SECUNDARIO}>
            Importar preguntas
          </Link>
          <button
            type="button"
            className={CLASE_BOTON_PRIMARIO}
            onClick={() => {
              setEdicion({ modo: 'crear' });
            }}
          >
            Nuevo set
          </button>
        </div>
      </header>

      {error && <AvisoError>{error}</AvisoError>}

      {edicion && (
        <FormularioSet
          key={edicion.modo === 'editar' ? edicion.set.id : 'nuevo'}
          titulo={edicion.modo === 'editar' ? 'Editar set' : 'Nuevo set'}
          inicial={
            edicion.modo === 'editar'
              ? {
                  nombre: edicion.set.nombre,
                  materia: edicion.set.materia,
                  grupo: edicion.set.grupo,
                }
              : undefined
          }
          onGuardar={guardarSet}
          onCancelar={() => {
            setEdicion(null);
          }}
        />
      )}

      <div className="max-w-md">
        <label htmlFor="buscar-sets" className={CLASE_ETIQUETA}>
          Buscar sets
        </label>
        <input
          id="buscar-sets"
          type="search"
          value={busqueda}
          placeholder="Nombre, materia o grupo"
          onChange={(evento) => {
            setBusqueda(evento.target.value);
          }}
          className={`${CLASE_CAMPO} mt-1`}
        />
      </div>

      {sets === undefined ? (
        <p className="text-slate-700">Cargando sets…</p>
      ) : sets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          {busqueda.trim() === ''
            ? 'Todavía no hay sets. Crea uno con el botón «Nuevo set».'
            : `No se encontraron sets que coincidan con «${busqueda.trim()}».`}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sets.map((set) => {
            const detalles = [set.materia, set.grupo && `Grupo ${set.grupo}`]
              .filter(Boolean)
              .join(' · ');
            return (
              <li
                key={set.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">
                    <Link
                      to={rutaSetBanco(set.id)}
                      className="text-slate-900 underline-offset-2 hover:underline"
                    >
                      {set.nombre}
                    </Link>
                  </h2>
                  {detalles && <p className="text-slate-700">{detalles}</p>}
                  <p className="text-sm text-slate-600">
                    {textoCantidadPreguntas(conteo?.[set.id] ?? 0)}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={CLASE_BOTON_ACCION}
                    aria-label={`Editar el set ${set.nombre}`}
                    onClick={() => {
                      setEdicion({ modo: 'editar', set });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={CLASE_BOTON_ACCION}
                    aria-label={`Duplicar el set ${set.nombre}`}
                    onClick={() => void duplicar(set)}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className={CLASE_BOTON_ACCION_PELIGRO}
                    aria-label={`Eliminar el set ${set.nombre}`}
                    onClick={() => {
                      setPorEliminar(set);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DialogoConfirmacion
        abierto={porEliminar !== null}
        titulo={`¿Eliminar el set «${porEliminar?.nombre ?? ''}»?`}
        descripcion={
          preguntasPorEliminar > 0
            ? `También se eliminarán sus ${textoCantidadPreguntas(preguntasPorEliminar)}. Esta acción no se puede deshacer.`
            : 'Esta acción no se puede deshacer.'
        }
        textoConfirmar="Eliminar set"
        ocupado={ocupado}
        onConfirmar={() => void confirmarEliminacion()}
        onCancelar={() => {
          setPorEliminar(null);
        }}
      />
    </section>
  );
}
