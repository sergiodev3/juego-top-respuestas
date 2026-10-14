import { useId } from 'react';

import type { ConfigPartida, EstadoJuego, VistaTablero } from '@/engine';

import { BotonAccion } from './BotonAccion';
import { MarcaVisibilidad } from './MarcaVisibilidad';
import type { AccionesPanel } from './useAccionesPanel';

interface PreguntaActualProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  /** The board projection: the source of truth for what is visible on the projector. */
  vista: VistaTablero;
  acciones: AccionesPanel;
}

/** Current question with every answer (points, synonyms), its board status and "Revelar". */
export function PreguntaActual({ config, estado, vista, acciones }: PreguntaActualProps) {
  const id = useId();
  const ronda = estado.ronda;
  const pregunta = ronda === null ? undefined : config.rondas[ronda.indice]?.pregunta;
  if (ronda === null || pregunta === undefined) {
    return null;
  }
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-sm font-semibold text-slate-600">Tema: {pregunta.tema}</p>
        <h2 id={id} className="text-2xl font-bold text-slate-900">
          {pregunta.texto}
        </h2>
      </div>
      <ol aria-label="Respuestas" className="space-y-2">
        {pregunta.respuestas.map((respuesta, indice) => {
          const numero = indice + 1;
          const visible = vista.ronda?.respuestas[indice]?.revelada ?? false;
          return (
            <li
              key={numero}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                {numero}
              </span>
              <div className="min-w-40 flex-1">
                <p className="text-lg font-semibold text-slate-900">{respuesta.texto}</p>
                {respuesta.sinonimos.length > 0 && (
                  <p className="text-sm text-slate-700">
                    Sinónimos: {respuesta.sinonimos.join(', ')}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {respuesta.puntos} pts
              </span>
              <MarcaVisibilidad
                visible={visible}
                sinPuntos={ronda.respuestas[indice] === 'reveladaSinPuntos'}
              />
              <BotonAccion
                accion={acciones.revelar(indice)}
                etiqueta={`Revelar la respuesta ${String(numero)}`}
                variante="primario"
              >
                Revelar
              </BotonAccion>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
