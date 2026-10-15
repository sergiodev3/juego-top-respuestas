import { useId } from 'react';

import {
  esquemaMultiplicador,
  PREGUNTAS_RONDA_FINAL,
  type DatosJuego,
  type Pregunta,
  type Reglas,
} from '@/shared/modelo';
import { CLASE_BOTON_ACCION, CLASE_BOTON_ACCION_PELIGRO, CLASE_CAMPO } from '@/shared/ui/clases';

import { CampoNumero } from './CampoNumero';
import { moverRonda } from './dominio';

const DESHABILITADO = 'disabled:cursor-not-allowed disabled:opacity-50';
const MULTIPLICADORES = [1, 2, 3] as const;

interface SeccionProps {
  datos: DatosJuego;
  /** Null while the bank is still loading. */
  preguntasPorId: ReadonlyMap<string, Pregunta> | null;
  onCambiar: (datos: DatosJuego) => void;
}

function textoPregunta(preguntasPorId: ReadonlyMap<string, Pregunta> | null, id: string): string {
  if (preguntasPorId === null) {
    return 'Cargando pregunta…';
  }
  return preguntasPorId.get(id)?.texto ?? 'Pregunta no disponible en el banco';
}

/** Ordered rounds: question, multiplier, move up/down and remove. */
export function SeccionRondas({ datos, preguntasPorId, onCambiar }: SeccionProps) {
  const id = useId();
  const { rondas } = datos;

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      <h3 id={`${id}-titulo`} className="text-xl font-semibold">
        Rondas
      </h3>
      {rondas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          Todavía no hay rondas. Agrega preguntas desde «Selección de preguntas».
        </p>
      ) : (
        <ol aria-label="Rondas" className="space-y-2">
          {rondas.map((ronda, indice) => {
            const numero = indice + 1;
            const idMultiplicador = `${id}-multiplicador-${String(indice)}`;
            return (
              <li
                key={`${ronda.preguntaId}-${String(indice)}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <span className="text-sm font-semibold text-slate-600">Ronda {numero}</span>
                <p className="min-w-48 flex-1 font-medium text-slate-900">
                  {textoPregunta(preguntasPorId, ronda.preguntaId)}
                </p>
                <label htmlFor={idMultiplicador} className="sr-only">
                  Multiplicador de la ronda {numero}
                </label>
                <select
                  id={idMultiplicador}
                  value={ronda.multiplicador}
                  onChange={(evento) => {
                    const multiplicador = esquemaMultiplicador.parse(Number(evento.target.value));
                    onCambiar({
                      ...datos,
                      rondas: rondas.map((r, i) => (i === indice ? { ...r, multiplicador } : r)),
                    });
                  }}
                  className={`${CLASE_CAMPO} w-20`}
                >
                  {MULTIPLICADORES.map((valor) => (
                    <option key={valor} value={valor}>
                      x{valor}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`${CLASE_BOTON_ACCION} ${DESHABILITADO}`}
                    aria-label={`Subir la ronda ${String(numero)}`}
                    disabled={indice === 0}
                    onClick={() => {
                      onCambiar(moverRonda(datos, indice, -1));
                    }}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    className={`${CLASE_BOTON_ACCION} ${DESHABILITADO}`}
                    aria-label={`Bajar la ronda ${String(numero)}`}
                    disabled={indice === rondas.length - 1}
                    onClick={() => {
                      onCambiar(moverRonda(datos, indice, 1));
                    }}
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    className={CLASE_BOTON_ACCION_PELIGRO}
                    aria-label={`Quitar la ronda ${String(numero)}`}
                    onClick={() => {
                      onCambiar({ ...datos, rondas: rondas.filter((_, i) => i !== indice) });
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Optional final round: on/off, its 5 questions, both players' seconds and the goal. */
export function SeccionRondaFinal({ datos, preguntasPorId, onCambiar }: SeccionProps) {
  const id = useId();
  const { rondaFinal } = datos.reglas;

  function cambiar(cambios: Partial<Reglas['rondaFinal']>) {
    onCambiar({
      ...datos,
      reglas: { ...datos.reglas, rondaFinal: { ...rondaFinal, ...cambios } },
    });
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      <h3 id={`${id}-titulo`} className="text-xl font-semibold">
        Ronda final
      </h3>
      <label className="flex items-center gap-2 font-medium text-slate-900">
        <input
          type="checkbox"
          checked={rondaFinal.activa}
          onChange={(evento) => {
            // Turning it off drops its questions so they are neither saved nor hidden elsewhere.
            const activa = evento.target.checked;
            cambiar(activa ? { activa } : { activa, preguntaIds: [] });
          }}
          className="size-5"
        />
        Incluir ronda final
      </label>
      {rondaFinal.activa && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            {rondaFinal.preguntaIds.length} de {PREGUNTAS_RONDA_FINAL} preguntas. Agrégalas desde
            «Selección de preguntas».
          </p>
          {rondaFinal.preguntaIds.length > 0 && (
            <ol aria-label="Preguntas de la ronda final" className="space-y-2">
              {rondaFinal.preguntaIds.map((preguntaId, indice) => (
                <li
                  key={`${preguntaId}-${String(indice)}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2"
                >
                  <span className="text-sm font-semibold text-slate-600">{indice + 1}.</span>
                  <p className="flex-1 font-medium text-slate-900">
                    {textoPregunta(preguntasPorId, preguntaId)}
                  </p>
                  <button
                    type="button"
                    className={CLASE_BOTON_ACCION_PELIGRO}
                    aria-label={`Quitar la pregunta ${String(indice + 1)} de la ronda final`}
                    onClick={() => {
                      cambiar({
                        preguntaIds: rondaFinal.preguntaIds.filter((_, i) => i !== indice),
                      });
                    }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap gap-4">
            <CampoNumero
              etiqueta="Segundos del jugador 1"
              valor={rondaFinal.segundos[0]}
              minimo={1}
              onCambiar={(valor) => {
                cambiar({ segundos: [valor, rondaFinal.segundos[1]] });
              }}
            />
            <CampoNumero
              etiqueta="Segundos del jugador 2"
              valor={rondaFinal.segundos[1]}
              minimo={1}
              onCambiar={(valor) => {
                cambiar({ segundos: [rondaFinal.segundos[0], valor] });
              }}
            />
            <CampoNumero
              etiqueta="Meta de puntos"
              valor={rondaFinal.meta}
              minimo={1}
              onCambiar={(valor) => {
                cambiar({ meta: valor });
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
