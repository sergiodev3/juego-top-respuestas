import { motion } from 'motion/react';

import type { VistaRespuesta, VistaRonda, VistaTablero } from '@/engine';
import { cx } from '@/shared/utils/cx';

import { NumeroAnimado } from './NumeroAnimado';
import { SobreposicionTachas } from './SobreposicionTachas';
import { DURACION_VOLTEO_S, VOLTEO } from './volteo';

interface TableroRondaProps {
  vista: VistaTablero;
  ronda: VistaRonda;
}

function Casilla({ respuesta }: { respuesta: VistaRespuesta }) {
  return (
    <motion.li
      // `initial={false}` starts at the current state: slots already revealed when the board
      // mounts (load, reconnect, new round) show at once; only a later reveal flips.
      initial={false}
      animate={respuesta.revelada ? 'revelada' : 'oculta'}
      variants={VOLTEO}
      transition={{ duration: DURACION_VOLTEO_S, ease: 'easeOut' }}
      className={cx(
        'flex min-h-0 items-center gap-[0.5em] rounded-xl border-4 px-[0.5em] text-tablero-md leading-tight font-bold',
        respuesta.revelada
          ? 'border-amber-300 bg-blue-800 text-white'
          : 'border-blue-700 bg-blue-950 text-blue-300',
      )}
    >
      <span className="flex size-[1.6em] shrink-0 items-center justify-center rounded-full bg-slate-950 text-[0.9em] text-amber-300">
        {respuesta.numero}
      </span>
      {respuesta.revelada && (
        <>
          <span className="flex-1 text-left uppercase">{respuesta.texto}</span>
          <span className="tabular-nums text-amber-300">{respuesta.puntos}</span>
        </>
      )}
    </motion.li>
  );
}

function Tachas({ tachas, maximas }: { tachas: number; maximas: number }) {
  return (
    <div
      aria-label={`Tachas: ${String(tachas)} de ${String(maximas)}`}
      className="flex justify-center gap-[clamp(0.5rem,1vw,1rem)]"
    >
      {Array.from({ length: Math.max(maximas, tachas) }, (_, indice) => (
        <span
          key={indice}
          aria-hidden="true"
          className={cx(
            'flex size-[1.4em] items-center justify-center rounded-lg border-4 text-tablero-lg leading-none font-black',
            indice < tachas
              ? 'border-red-500 bg-red-700 text-white'
              : 'border-slate-700 text-transparent',
          )}
        >
          X
        </span>
      ))}
    </div>
  );
}

function nombreEquipo(vista: VistaTablero, indice: number | null): string | null {
  return indice === null ? null : (vista.equipos[indice]?.nombre ?? null);
}

/** Status line for the round: face-off winner, steal chance, or the round winner. */
function aviso(vista: VistaTablero, ronda: VistaRonda): string | null {
  const ganadorRonda = nombreEquipo(vista, ronda.ganadorRonda);
  if (vista.fase === 'finDeRonda' && ganadorRonda !== null) {
    return `¡${ganadorRonda} gana ${String(ronda.puntosOtorgados ?? 0)} puntos!`;
  }
  const robo = nombreEquipo(vista, ronda.equipoRobo);
  if (vista.fase === 'robo' && robo !== null) {
    return `¡${robo} puede robar!`;
  }
  const caraACara = nombreEquipo(vista, ronda.ganadorCaraACara);
  if (vista.fase === 'caraACara' && caraACara !== null) {
    return `${caraACara} gana el cara a cara`;
  }
  return null;
}

/** A regular round: question, numbered answer slots (text only once revealed), strikes, pot. */
export function TableroRonda({ vista, ronda }: TableroRondaProps) {
  const mensaje = aviso(vista, ronda);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2vh,1.5rem)]">
      <div className="flex flex-wrap items-center justify-center gap-[1em] text-tablero-sm font-semibold text-slate-100">
        <span>
          Ronda {ronda.numero} de {ronda.total}
        </span>
        <span className="rounded-full bg-amber-300 px-4 py-1 font-extrabold text-slate-950">
          Puntos x{ronda.multiplicador}
        </span>
      </div>
      <h2 className="text-center text-tablero-lg leading-tight font-extrabold text-balance">
        {ronda.pregunta}
      </h2>
      {/* Four equal rows filling the free height: up to 4 answers in one column, 5 to 8 in two
          (1-4 left, 5-8 right), as on TV. */}
      <ol
        aria-label="Respuestas"
        className="grid min-h-0 flex-1 auto-cols-fr grid-flow-col grid-rows-4 gap-[clamp(0.4rem,1.5vh,1rem)] perspective-distant"
      >
        {ronda.respuestas.map((respuesta) => (
          <Casilla key={respuesta.numero} respuesta={respuesta} />
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-center gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-2">
        <Tachas tachas={ronda.tachas} maximas={ronda.tachasMaximas} />
        <SobreposicionTachas tachas={ronda.tachas} maximas={ronda.tachasMaximas} />
        {/* A face-off miss is not a strike: it flashes a single X, like on TV. */}
        <SobreposicionTachas tachas={ronda.fallosCaraACara} maximas={1} />
        <p className="text-tablero-lg font-bold text-amber-300">
          <span className="sr-only">{`Puntos en juego: ${String(ronda.bolsa)}`}</span>
          <span aria-hidden="true">
            Puntos en juego: <NumeroAnimado valor={ronda.bolsa} className="tabular-nums" />
          </span>
        </p>
      </div>
      {mensaje !== null && (
        <p role="status" className="text-center text-tablero-lg font-extrabold text-amber-300">
          {mensaje}
        </p>
      )}
    </div>
  );
}
