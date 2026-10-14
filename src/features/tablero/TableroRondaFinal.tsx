import { useId } from 'react';

import type { VistaJugadorRondaFinal, VistaRondaFinal, VistaTablero } from '@/engine';
import type { Temporizador } from '@/shared/sync';

interface TableroRondaFinalProps {
  vista: VistaTablero;
  rondaFinal: VistaRondaFinal;
  temporizador: Temporizador | null;
}

function ColumnaJugador({ jugador }: { jugador: VistaJugadorRondaFinal }) {
  const idTitulo = useId();
  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-3 rounded-2xl border-4 border-blue-700 bg-blue-950 p-4"
    >
      <h3 id={idTitulo} className="text-center text-4xl font-bold text-amber-300">
        Jugador {jugador.jugador}
      </h3>
      {jugador.oculto ? (
        <p className="py-8 text-center text-4xl font-semibold text-blue-300">Respuestas ocultas</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {jugador.respuestas.map((respuesta) => (
            <li
              key={respuesta.numero}
              className="flex min-h-16 items-center gap-4 rounded-lg bg-blue-900 px-4 text-4xl font-bold"
            >
              {respuesta.revelada && (
                <>
                  <span className="flex-1 uppercase">{respuesta.texto}</span>
                  <span className="tabular-nums text-amber-300">{respuesta.puntos}</span>
                </>
              )}
            </li>
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
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-center gap-8">
        <h2 className="text-5xl font-extrabold md:text-6xl">Ronda final: {equipo}</h2>
        {segundos !== null && (
          <p
            aria-label={`Tiempo restante: ${String(segundos)} segundos`}
            className="flex size-28 items-center justify-center rounded-full border-8 border-amber-300 text-6xl font-black tabular-nums"
          >
            {segundos}
          </p>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {rondaFinal.jugadores.map((jugador) => (
          <ColumnaJugador key={jugador.jugador} jugador={jugador} />
        ))}
      </div>
      <p className="text-center text-5xl font-extrabold text-amber-300 md:text-6xl">
        {`Total: ${String(rondaFinal.total)} de ${String(rondaFinal.meta)}`}
      </p>
      {rondaFinal.resultado !== null && (
        <p role="status" className="text-center text-5xl font-extrabold md:text-6xl">
          {rondaFinal.resultado.superoMeta ? '¡Meta alcanzada!' : 'No alcanzaron la meta.'}
        </p>
      )}
    </div>
  );
}
