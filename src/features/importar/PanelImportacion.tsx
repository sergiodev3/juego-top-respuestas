import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ZodError } from 'zod';

import { useRepositorios } from '@/db/contextoRepositorios';
import { ErrorRegistroNoEncontrado, type DestinoImportacion } from '@/db/repositorios';
import { MAX_NOMBRE_SET, type SetPreguntas } from '@/shared/modelo';
import { rutaConfigurarJuego, rutaSetBanco } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';

import { marcarDuplicadosEnSet, type FilaValidada } from './dominio';
import { TablaVistaPrevia } from './TablaVistaPrevia';
import {
  DESCRIPCION_CANCELAR,
  TEXTO_CANCELAR,
  TEXTO_IMPORTAR_OTRO,
  textoPreguntas,
} from './textos';

interface PanelImportacionProps {
  /** Original file name; the default name of a new set is derived from it. */
  nombreArchivo: string;
  filas: readonly FilaValidada[];
  /**
   * Discards this file and lets the user start over with another one: "Cancelar" in the preview
   * and "Importar otro archivo" after a successful import.
   */
  onReiniciar?: () => void;
}

type TipoDestino = DestinoImportacion['tipo'];

interface Exito {
  set: SetPreguntas;
  cantidad: number;
}

const NOMBRE_SET_RESPALDO = 'Preguntas importadas';

/** "repaso-2b.xlsx" -> "repaso-2b", kept within the set name limit. */
function nombreSetDesdeArchivo(nombreArchivo: string): string {
  const base = nombreArchivo
    .replace(/\.[^.]+$/u, '')
    .trim()
    .slice(0, MAX_NOMBRE_SET)
    .trim();
  return base === '' ? NOMBRE_SET_RESPALDO : base;
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Revisa los datos del set.';
  }
  if (error instanceof ErrorRegistroNoEncontrado) {
    return 'El set elegido ya no existe. Elige otro o crea un set nuevo.';
  }
  return 'No se pudieron guardar las preguntas. La vista previa sigue aquí; intenta de nuevo.';
}

interface BotonCancelarArchivoProps {
  onCancelar: () => void;
  disabled?: boolean;
}

/** "Cancelar": discards the current file so the user can choose another one. */
export function BotonCancelarArchivo({ onCancelar, disabled = false }: BotonCancelarArchivoProps) {
  const idDescripcion = useId();
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={CLASE_BOTON_SECUNDARIO}
        disabled={disabled}
        aria-describedby={idDescripcion}
        onClick={onCancelar}
      >
        {TEXTO_CANCELAR}
      </button>
      <p id={idDescripcion} className="max-w-sm text-sm text-slate-600">
        {DESCRIPCION_CANCELAR}
      </p>
    </div>
  );
}

/** Target set choice, import actions and the preview of a parsed file. */
export function PanelImportacion({ nombreArchivo, filas, onReiniciar }: PanelImportacionProps) {
  const repositorios = useRepositorios();
  const navigate = useNavigate();
  const idNombreSet = useId();
  const idSetExistente = useId();
  const idDescripcionJugar = useId();

  const [tipoDestino, setTipoDestino] = useState<TipoDestino>('nuevo');
  const [nombreSetNuevo, setNombreSetNuevo] = useState(() => nombreSetDesdeArchivo(nombreArchivo));
  const [setExistenteId, setSetExistenteId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);

  const sets = useLiveQuery(() => repositorios.sets.listar(), [repositorios]);
  const setElegidoId = setExistenteId || sets?.[0]?.id || '';
  const textosExistentes = useLiveQuery(async () => {
    if (tipoDestino !== 'existente' || setElegidoId === '') {
      return [];
    }
    const preguntas = await repositorios.preguntas.listarPorSet(setElegidoId);
    return preguntas.map((pregunta) => pregunta.texto);
  }, [repositorios, tipoDestino, setElegidoId]);

  const filasMostradas = useMemo(
    () =>
      textosExistentes && textosExistentes.length > 0
        ? marcarDuplicadosEnSet(filas, textosExistentes)
        : filas,
    [filas, textosExistentes],
  );
  const preguntasValidas = filas.flatMap((fila) =>
    fila.estado === 'valida' ? [fila.pregunta] : [],
  );
  const cantidadValidas = preguntasValidas.length;
  const nombreParaJugar =
    tipoDestino === 'nuevo' ? nombreSetNuevo.trim() : nombreSetDesdeArchivo(nombreArchivo);
  const haySets = sets !== undefined && sets.length > 0;

  async function importar() {
    setError(null);
    setOcupado(true);
    const destino: DestinoImportacion =
      tipoDestino === 'nuevo'
        ? { tipo: 'nuevo', datos: { nombre: nombreSetNuevo, materia: '', grupo: '' } }
        : { tipo: 'existente', setId: setElegidoId };
    try {
      const resultado = await repositorios.importacion.importarPreguntas(destino, preguntasValidas);
      setExito({ set: resultado.set, cantidad: resultado.preguntas.length });
    } catch (causa) {
      setError(mensajeDeError(causa));
    } finally {
      setOcupado(false);
    }
  }

  async function importarYJugar() {
    setError(null);
    setOcupado(true);
    try {
      const { juego } = await repositorios.importacion.importarYJugar(
        { nombre: nombreParaJugar, materia: '', grupo: '' },
        preguntasValidas,
      );
      // Waiting for the navigation keeps the buttons disabled until it settles, so a second
      // click cannot create a duplicate game. React 19 ignores the reset if this unmounted.
      await navigate(rutaConfigurarJuego(juego.id));
    } catch (causa) {
      setError(mensajeDeError(causa));
    } finally {
      setOcupado(false);
    }
  }

  if (exito) {
    return (
      <div
        role="status"
        className="space-y-3 rounded-xl border border-green-300 bg-green-50 p-4 text-green-950"
      >
        <p className="font-semibold">
          Se importaron {textoPreguntas(exito.cantidad)} al set «{exito.set.nombre}».
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={rutaSetBanco(exito.set.id)} className={CLASE_BOTON_PRIMARIO}>
            Ver el set «{exito.set.nombre}»
          </Link>
          {onReiniciar && (
            <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={onReiniciar}>
              {TEXTO_IMPORTAR_OTRO}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="titulo-destino"
        className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="titulo-destino" className="text-xl font-semibold">
          Importar «{nombreArchivo}»
        </h2>

        <fieldset className="space-y-3">
          <legend className={CLASE_ETIQUETA}>¿Dónde quieres guardar las preguntas?</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="destino"
                value="nuevo"
                checked={tipoDestino === 'nuevo'}
                onChange={() => {
                  setTipoDestino('nuevo');
                }}
                className="size-4"
              />
              Set nuevo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="destino"
                value="existente"
                checked={tipoDestino === 'existente'}
                disabled={!haySets}
                onChange={() => {
                  setTipoDestino('existente');
                }}
                className="size-4"
              />
              Set existente
            </label>
          </div>

          {tipoDestino === 'nuevo' ? (
            <div className="max-w-md">
              <label htmlFor={idNombreSet} className={CLASE_ETIQUETA}>
                Nombre del set nuevo
              </label>
              <input
                id={idNombreSet}
                type="text"
                value={nombreSetNuevo}
                maxLength={MAX_NOMBRE_SET}
                onChange={(evento) => {
                  setNombreSetNuevo(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1`}
              />
            </div>
          ) : (
            <div className="max-w-md">
              <label htmlFor={idSetExistente} className={CLASE_ETIQUETA}>
                Elige el set
              </label>
              <select
                id={idSetExistente}
                value={setElegidoId}
                onChange={(evento) => {
                  setSetExistenteId(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1`}
              >
                {sets?.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        {error && <AvisoError>{error}</AvisoError>}

        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            className={CLASE_BOTON_PRIMARIO}
            disabled={
              cantidadValidas === 0 || ocupado || (tipoDestino === 'existente' && !setElegidoId)
            }
            onClick={() => void importar()}
          >
            Importar {textoPreguntas(cantidadValidas)}
          </button>
          <div className="space-y-1">
            <button
              type="button"
              className={CLASE_BOTON_SECUNDARIO}
              disabled={cantidadValidas === 0 || ocupado}
              aria-describedby={idDescripcionJugar}
              onClick={() => void importarYJugar()}
            >
              Importar y jugar
            </button>
            <p id={idDescripcionJugar} className="max-w-sm text-sm text-slate-600">
              Crea el set nuevo «{nombreParaJugar || NOMBRE_SET_RESPALDO}» y un juego con 2 equipos
              y hasta 4 rondas.
            </p>
          </div>
          {onReiniciar && <BotonCancelarArchivo disabled={ocupado} onCancelar={onReiniciar} />}
        </div>
        {cantidadValidas < filas.length && cantidadValidas > 0 && (
          <p className="text-sm text-slate-700">
            Solo se importan las filas válidas; corrige las demás en tu archivo y vuelve a cargarlo.
          </p>
        )}
      </section>

      <TablaVistaPrevia filas={filasMostradas} />
    </div>
  );
}
