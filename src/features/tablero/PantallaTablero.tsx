import { MotionConfig } from 'motion/react';

import type { VistaTablero } from '@/engine';
import type { EstadoTablero, Temporizador } from '@/shared/sync';

import { Marcador } from './Marcador';
import { TableroRonda } from './TableroRonda';
import { TableroRondaFinal } from './TableroRondaFinal';

interface PantallaTableroProps {
  estado: EstadoTablero;
}

function PantallaEspera({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <h1 className="text-6xl font-extrabold tracking-tight text-amber-300 md:text-8xl">
        {nombre}
      </h1>
      <p className="text-3xl font-semibold md:text-5xl">Esperando al conductor…</p>
    </div>
  );
}

function ganadores(vista: VistaTablero): string {
  const maximo = Math.max(...vista.equipos.map((equipo) => equipo.puntaje));
  const primeros = vista.equipos.filter((equipo) => equipo.puntaje === maximo);
  const [unico] = primeros;
  return primeros.length === 1 && unico !== undefined ? `¡Gana ${unico.nombre}!` : '¡Empate!';
}

function Contenido({
  vista,
  temporizador,
}: {
  vista: VistaTablero;
  temporizador: Temporizador | null;
}) {
  if (vista.fase === 'juegoTerminado') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-4xl font-semibold text-slate-200 md:text-5xl">Juego terminado</p>
        <p className="text-6xl font-extrabold text-amber-300 md:text-8xl">{ganadores(vista)}</p>
        {vista.rondaFinal !== null && (
          <TableroRondaFinal vista={vista} rondaFinal={vista.rondaFinal} temporizador={null} />
        )}
      </div>
    );
  }
  if (vista.fase === 'rondaFinal' && vista.rondaFinal !== null) {
    return (
      <TableroRondaFinal vista={vista} rondaFinal={vista.rondaFinal} temporizador={temporizador} />
    );
  }
  if (vista.ronda !== null) {
    // A new round (or undoing back into an earlier one) mounts fresh, so its revealed answers
    // and strikes show as they are instead of animating.
    return <TableroRonda key={vista.ronda.numero} vista={vista} ronda={vista.ronda} />;
  }
  return <PantallaEspera nombre={vista.nombreJuego} />;
}

/**
 * Presentational board: renders only what the projection carries. Animations (reveal flips,
 * strike overlay, count-ups) honor `prefers-reduced-motion`.
 */
export function PantallaTablero({ estado }: PantallaTableroProps) {
  if (estado.tipo !== 'partida') {
    return <PantallaEspera nombre="Top Respuestas" />;
  }
  const { vista, temporizador } = estado;
  return (
    // "user": with reduced motion, transform animations (the flips) jump to their end state.
    <MotionConfig reducedMotion="user">
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-center text-4xl font-extrabold tracking-tight text-amber-300 md:text-5xl">
          {vista.nombreJuego}
        </h1>
        <Contenido vista={vista} temporizador={temporizador} />
        <Marcador vista={vista} />
      </div>
    </MotionConfig>
  );
}
