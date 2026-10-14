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
        'flex min-h-20 items-center gap-4 rounded-xl border-4 px-4 py-2 text-4xl font-bold md:min-h-24 md:text-5xl',
        respuesta.revelada
          ? 'border-amber-300 bg-blue-800 text-white'
          : 'border-blue-700 bg-blue-950 text-blue-300',
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-950 text-3xl text-amber-300 md:size-16 md:text-4xl">
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
      className="flex justify-center gap-3"
    >
      {Array.from({ length: Math.max(maximas, tachas) }, (_, indice) => (
        <span
          key={indice}
          aria-hidden="true"
          className={cx(
            'flex size-16 items-center justify-center rounded-lg border-4 text-5xl font-black md:size-20 md:text-6xl',
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
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-center gap-6 text-3xl font-semibold text-slate-200 md:text-4xl">
        <span>
          Ronda {ronda.numero} de {ronda.total}
        </span>
        <span className="rounded-full bg-amber-300 px-4 py-1 font-extrabold text-slate-950">
          Puntos x{ronda.multiplicador}
        </span>
      </div>
      <h2 className="text-center text-5xl leading-tight font-extrabold md:text-6xl">
        {ronda.pregunta}
      </h2>
      <ol
        aria-label="Respuestas"
        className="grid grid-flow-col grid-rows-4 gap-4 perspective-distant"
      >
        {ronda.respuestas.map((respuesta) => (
          <Casilla key={respuesta.numero} respuesta={respuesta} />
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-center gap-10">
        <Tachas tachas={ronda.tachas} maximas={ronda.tachasMaximas} />
        <SobreposicionTachas tachas={ronda.tachas} maximas={ronda.tachasMaximas} />
        <p className="text-4xl font-bold text-amber-300 md:text-5xl">
          <span className="sr-only">{`Puntos en juego: ${String(ronda.bolsa)}`}</span>
          <span aria-hidden="true">
            Puntos en juego: <NumeroAnimado valor={ronda.bolsa} className="tabular-nums" />
          </span>
        </p>
      </div>
      {mensaje !== null && (
        <p role="status" className="text-center text-5xl font-extrabold text-amber-300 md:text-6xl">
          {mensaje}
        </p>
      )}
    </div>
  );
}
