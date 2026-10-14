import { MotionConfig } from 'motion/react';

import type { VistaTablero } from '@/engine';
import type { EstadoTablero, Temporizador } from '@/shared/sync';

import { Marcador } from './Marcador';
import { TableroRonda } from './TableroRonda';
import { TableroRondaFinal } from './TableroRondaFinal';
import { TarjetaRonda } from './TarjetaRonda';
import { useTarjetaRonda } from './useTarjetaRonda';

interface PantallaTableroProps {
  estado: EstadoTablero;
}

function PantallaEspera({ nombre }: { nombre: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1.5rem,6vh,4rem)] text-center">
      <h1 className="text-tablero-2xl leading-tight font-black tracking-tight text-balance text-amber-300">
        {nombre}
      </h1>
      <p className="text-tablero-lg font-semibold text-slate-100">Esperando al conductor…</p>
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
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.5rem,2vh,1.5rem)] text-center">
        <p className="text-tablero-lg font-semibold text-slate-100">Juego terminado</p>
        <p className="text-tablero-2xl leading-tight font-black text-amber-300">
          {ganadores(vista)}
        </p>
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
  const tarjeta = useTarjetaRonda(estado);
  if (estado.tipo !== 'partida') {
    // After a partida ends the board keeps its name up while the host prepares the next one.
    const nombre = estado.tipo === 'sinPartida' ? estado.nombreJuego : null;
    return <PantallaEspera nombre={nombre ?? 'Top Respuestas'} />;
  }
  const { vista, temporizador } = estado;
  return (
    // "user": with reduced motion, transform animations (the flips) jump to their end state.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2vh,1.5rem)]">
        <h1 className="truncate text-center text-tablero-md font-extrabold tracking-tight text-amber-300">
          {vista.nombreJuego}
        </h1>
        <Contenido vista={vista} temporizador={temporizador} />
        <Marcador vista={vista} />
      </div>
      {/* Covers the board for ~3 s at a round start; the board stays mounted underneath. */}
      {tarjeta !== null && <TarjetaRonda tarjeta={tarjeta} />}
    </MotionConfig>
  );
}
