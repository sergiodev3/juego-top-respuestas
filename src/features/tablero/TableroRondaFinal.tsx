import { motion } from 'motion/react';
import { useId } from 'react';

import type { VistaJugadorRondaFinal, VistaRondaFinal, VistaTablero } from '@/engine';
import type { Temporizador } from '@/shared/sync';

import { NumeroAnimado } from './NumeroAnimado';
import { TextoAjustado } from './TextoAjustado';
import { DURACION_VOLTEO_S, VOLTEO } from './volteo';

interface TableroRondaFinalProps {
  vista: VistaTablero;
  rondaFinal: VistaRondaFinal;
  temporizador: Temporizador | null;
}

/** Typing is optional in the panel: an answer recorded blank (no match) reads "Sin respuesta". */
function textoRespuesta(texto: string | undefined): string {
  return texto === undefined || texto.trim() === '' ? 'Sin respuesta' : texto;
}

function ColumnaJugador({ jugador }: { jugador: VistaJugadorRondaFinal }) {
  const idTitulo = useId();
  return (
    <section
      aria-labelledby={idTitulo}
      className="flex min-h-0 flex-col gap-[clamp(0.3rem,1vh,0.75rem)] rounded-2xl border-4 border-blue-700 bg-blue-950 p-[clamp(0.5rem,1.5vh,1rem)]"
    >
      <h3 id={idTitulo} className="text-center text-tablero-md font-bold text-amber-300">
        Jugador {jugador.jugador}
      </h3>
      {jugador.oculto ? (
        <p className="py-[1em] text-center text-tablero-md font-semibold text-blue-200">
          Respuestas ocultas
        </p>
      ) : (
        <ol className="flex flex-col gap-[clamp(0.3rem,1vh,0.75rem)] perspective-distant">
          {jugador.respuestas.map((respuesta) => (
            <motion.li
              key={respuesta.numero}
              // Same reveal flip as the round slots; answers revealed on mount show at once.
              initial={false}
              animate={respuesta.revelada ? 'revelada' : 'oculta'}
              variants={VOLTEO}
              transition={{ duration: DURACION_VOLTEO_S, ease: 'easeOut' }}
              className="flex min-h-[1.6em] items-center gap-[0.5em] rounded-lg bg-blue-900 px-[0.5em] text-tablero-md leading-tight font-bold"
            >
              {respuesta.revelada && (
                <>
                  <TextoAjustado
                    texto={textoRespuesta(respuesta.texto)}
                    className="flex-1 uppercase"
                  />
                  <span className="tabular-nums text-amber-300">{respuesta.puntos}</span>
                </>
              )}
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Final round: both players' columns (player 1 hidden while player 2 plays), total vs goal. */
export function TableroRondaFinal({ vista, rondaFinal, temporizador }: TableroRondaFinalProps) {
  const equipo = vista.equipos[rondaFinal.equipo]?.nombre ?? '';
  const segundos = temporizador === null ? null : Math.ceil(temporizador.restante);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2vh,1.5rem)]">
      <div className="flex flex-wrap items-center justify-center gap-[clamp(1rem,3vw,3rem)]">
        <h2 className="text-tablero-lg font-extrabold">Ronda final: {equipo}</h2>
        {segundos !== null && (
          <p
            aria-label={`Tiempo restante: ${String(segundos)} segundos`}
            className="flex size-[1.8em] items-center justify-center rounded-full border-8 border-amber-300 text-tablero-xl leading-none font-black tabular-nums"
          >
            {segundos}
          </p>
        )}
      </div>
      <div className="grid min-h-0 grid-cols-2 gap-[clamp(0.75rem,2vw,1.5rem)]">
        {rondaFinal.jugadores.map((jugador) => (
          <ColumnaJugador key={jugador.jugador} jugador={jugador} />
        ))}
      </div>
      <p className="text-center text-tablero-lg font-extrabold text-amber-300">
        <span className="sr-only">
          {`Total: ${String(rondaFinal.total)} de ${String(rondaFinal.meta)}`}
        </span>
        <span aria-hidden="true">
          Total: <NumeroAnimado valor={rondaFinal.total} className="tabular-nums" /> de{' '}
          {rondaFinal.meta}
        </span>
      </p>
      {rondaFinal.resultado !== null && (
        <p role="status" className="text-center text-tablero-lg font-extrabold">
          {rondaFinal.resultado.superoMeta ? '¡Meta alcanzada!' : 'No alcanzaron la meta.'}
        </p>
      )}
    </div>
  );
}
