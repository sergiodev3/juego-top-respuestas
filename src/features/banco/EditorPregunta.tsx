import { useId, useState, type SubmitEvent } from 'react';
import type { ZodError } from 'zod';

import {
  esquemaDatosPregunta,
  esRespuestaVacia,
  MAX_RESPUESTAS,
  MAX_TEXTO_RESPUESTA,
  type DatosPregunta,
} from '@/shared/modelo';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_ACCION_PELIGRO,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ERROR_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';

const FILAS_INICIALES = 4;

interface FilaRespuesta {
  /** Stable React key; never sent to storage. */
  clave: number;
  texto: string;
  puntos: string;
  sinonimos: string;
}

interface ErroresFila {
  texto?: string;
  puntos?: string;
  sinonimos?: string;
}

interface Errores {
  texto?: string;
  tema?: string;
  respuestas?: string;
  filas: Record<number, ErroresFila>;
}

const SIN_ERRORES: Errores = { filas: {} };

let siguienteClave = 0;

function filaNueva(texto = '', puntos = '', sinonimos = ''): FilaRespuesta {
  siguienteClave += 1;
  return { clave: siguienteClave, texto, puntos, sinonimos };
}

function filasDesde(inicial: DatosPregunta | undefined): FilaRespuesta[] {
  if (!inicial) {
    return Array.from({ length: FILAS_INICIALES }, () => filaNueva());
  }
  return inicial.respuestas.map((r) =>
    filaNueva(r.texto, String(r.puntos), r.sinonimos.join(', ')),
  );
}

function aPuntos(valor: string): number {
  return valor.trim() === '' ? Number.NaN : Number(valor);
}

function aEntrada(fila: FilaRespuesta) {
  return {
    texto: fila.texto,
    puntos: aPuntos(fila.puntos),
    sinonimos: fila.sinonimos.split(','),
  };
}

/** Maps schema issues to form fields. `indices[i]` is the row index of validated answer `i`. */
function erroresDesde(error: ZodError, indices: number[]): Errores {
  const errores: Errores = { filas: {} };
  for (const issue of error.issues) {
    const [campo, posicion, subcampo] = issue.path;
    if (campo === 'texto' || campo === 'tema') {
      errores[campo] ??= issue.message;
    } else if (campo === 'respuestas' && typeof posicion === 'number') {
      const fila = indices[posicion];
      if (
        fila !== undefined &&
        (subcampo === 'texto' || subcampo === 'puntos' || subcampo === 'sinonimos')
      ) {
        const erroresFila = (errores.filas[fila] ??= {});
        erroresFila[subcampo] ??= issue.message;
      }
    } else if (campo === 'respuestas') {
      errores.respuestas ??= issue.message;
    }
  }
  return errores;
}

function tieneErrores(errores: Errores): boolean {
  return (
    errores.texto !== undefined ||
    errores.tema !== undefined ||
    errores.respuestas !== undefined ||
    Object.keys(errores.filas).length > 0
  );
}

interface EditorPreguntaProps {
  /** Question being edited; omit to create a new one. */
  inicial?: DatosPregunta | undefined;
  /** Existing topics offered as suggestions. */
  temas: string[];
  /** Persists the normalized question (answers already sorted by points). */
  onGuardar: (datos: DatosPregunta) => Promise<void>;
  onCancelar: () => void;
}

/** Presentational question form: validates with the domain schema and reports errors inline. */
export function EditorPregunta({ inicial, temas, onGuardar, onCancelar }: EditorPreguntaProps) {
  const id = useId();
  const [texto, setTexto] = useState(inicial?.texto ?? '');
  const [tema, setTema] = useState(inicial?.tema ?? '');
  const [filas, setFilas] = useState(() => filasDesde(inicial));
  const [errores, setErrores] = useState<Errores>(SIN_ERRORES);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const lleno = filas.length >= MAX_RESPUESTAS;
  const idError = (campo: string) => `${id}-error-${campo}`;

  function actualizarFila(clave: number, cambios: Partial<Omit<FilaRespuesta, 'clave'>>) {
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  async function guardar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorGuardado(null);

    // Blank rows are skipped; remember which row each validated answer came from.
    const indices: number[] = [];
    const respuestas: ReturnType<typeof aEntrada>[] = [];
    for (const [indice, fila] of filas.entries()) {
      const entrada = aEntrada(fila);
      if (!esRespuestaVacia(entrada)) {
        indices.push(indice);
        respuestas.push(entrada);
      }
    }

    const resultado = esquemaDatosPregunta.safeParse({ texto, tema, respuestas });
    if (!resultado.success) {
      setErrores(erroresDesde(resultado.error, indices));
      return;
    }

    setErrores(SIN_ERRORES);
    setGuardando(true);
    try {
      await onGuardar(resultado.data);
    } catch {
      setErrorGuardado('No se pudo guardar la pregunta. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form noValidate onSubmit={(evento) => void guardar(evento)} className="space-y-6">
      {tieneErrores(errores) && <AvisoError>Revisa los campos marcados.</AvisoError>}
      {errorGuardado && <AvisoError>{errorGuardado}</AvisoError>}

      <div>
        <label htmlFor={`${id}-texto`} className={CLASE_ETIQUETA}>
          Pregunta
        </label>
        <textarea
          id={`${id}-texto`}
          value={texto}
          rows={2}
          required
          aria-invalid={errores.texto !== undefined}
          aria-describedby={errores.texto ? idError('texto') : undefined}
          onChange={(evento) => {
            setTexto(evento.target.value);
          }}
          className={`${CLASE_CAMPO} mt-1`}
        />
        {errores.texto && (
          <p id={idError('texto')} className={CLASE_ERROR_CAMPO}>
            {errores.texto}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-tema`} className={CLASE_ETIQUETA}>
          Tema
        </label>
        <input
          id={`${id}-tema`}
          value={tema}
          list={`${id}-temas`}
          autoComplete="off"
          aria-invalid={errores.tema !== undefined}
          aria-describedby={errores.tema ? idError('tema') : undefined}
          onChange={(evento) => {
            setTema(evento.target.value);
          }}
          className={`${CLASE_CAMPO} mt-1 max-w-md`}
        />
        <datalist id={`${id}-temas`}>
          {temas.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {errores.tema && (
          <p id={idError('tema')} className={CLASE_ERROR_CAMPO}>
            {errores.tema}
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-lg font-bold">Respuestas</legend>
        <p className="text-sm text-slate-700">
          Al guardar se ordenan por puntos, de mayor a menor. Escribe los sinónimos separados por
          comas. Las filas vacías se ignoran.
        </p>
        {errores.respuestas && (
          <p id={idError('respuestas')} className={CLASE_ERROR_CAMPO}>
            {errores.respuestas}
          </p>
        )}

        <ol className="space-y-3">
          {filas.map((fila, indice) => {
            const numero = indice + 1;
            const erroresFila = errores.filas[indice] ?? {};
            const base = `${id}-fila-${String(fila.clave)}`;
            return (
              <li
                key={fila.clave}
                className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 sm:grid-cols-[1fr_7rem_1fr_auto] sm:items-start"
              >
                <div>
                  <label htmlFor={`${base}-texto`} className={CLASE_ETIQUETA}>
                    Respuesta {numero}
                  </label>
                  <input
                    id={`${base}-texto`}
                    value={fila.texto}
                    maxLength={MAX_TEXTO_RESPUESTA}
                    aria-invalid={erroresFila.texto !== undefined}
                    aria-describedby={erroresFila.texto ? `${base}-error-texto` : undefined}
                    onChange={(evento) => {
                      actualizarFila(fila.clave, { texto: evento.target.value });
                    }}
                    className={`${CLASE_CAMPO} mt-1`}
                  />
                  {erroresFila.texto && (
                    <p id={`${base}-error-texto`} className={CLASE_ERROR_CAMPO}>
                      {erroresFila.texto}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${base}-puntos`} className={CLASE_ETIQUETA}>
                    Puntos
                  </label>
                  <input
                    id={`${base}-puntos`}
                    aria-label={`Puntos de la respuesta ${String(numero)}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={fila.puntos}
                    aria-invalid={erroresFila.puntos !== undefined}
                    aria-describedby={erroresFila.puntos ? `${base}-error-puntos` : undefined}
                    onChange={(evento) => {
                      actualizarFila(fila.clave, { puntos: evento.target.value });
                    }}
                    className={`${CLASE_CAMPO} mt-1`}
                  />
                  {erroresFila.puntos && (
                    <p id={`${base}-error-puntos`} className={CLASE_ERROR_CAMPO}>
                      {erroresFila.puntos}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${base}-sinonimos`} className={CLASE_ETIQUETA}>
                    Sinónimos
                  </label>
                  <input
                    id={`${base}-sinonimos`}
                    aria-label={`Sinónimos de la respuesta ${String(numero)}`}
                    value={fila.sinonimos}
                    placeholder="Ej.: auto, coche"
                    aria-invalid={erroresFila.sinonimos !== undefined}
                    aria-describedby={erroresFila.sinonimos ? `${base}-error-sinonimos` : undefined}
                    onChange={(evento) => {
                      actualizarFila(fila.clave, { sinonimos: evento.target.value });
                    }}
                    className={`${CLASE_CAMPO} mt-1`}
                  />
                  {erroresFila.sinonimos && (
                    <p id={`${base}-error-sinonimos`} className={CLASE_ERROR_CAMPO}>
                      {erroresFila.sinonimos}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${CLASE_BOTON_ACCION_PELIGRO} sm:mt-6`}
                  aria-label={`Quitar respuesta ${String(numero)}`}
                  onClick={() => {
                    setFilas((actuales) => actuales.filter((f) => f.clave !== fila.clave));
                    setErrores(SIN_ERRORES);
                  }}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={CLASE_BOTON_SECUNDARIO}
            disabled={lleno}
            onClick={() => {
              setFilas((actuales) => [...actuales, filaNueva()]);
            }}
          >
            Agregar respuesta
          </button>
          {lleno && (
            <p className="text-sm text-slate-700">
              Máximo {MAX_RESPUESTAS} respuestas por pregunta.
            </p>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button type="submit" className={CLASE_BOTON_PRIMARIO} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar pregunta'}
        </button>
        <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
