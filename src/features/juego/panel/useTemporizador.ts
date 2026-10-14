import { useEffect, useState } from 'react';

import type { Temporizador } from '@/shared/sync';

/** Clock and scheduler for the final-round timer (tests inject a manual one). */
export interface RelojTemporizador {
  ahora(): number;
  /** Runs `tarea` every `ms` milliseconds until the returned function is called. */
  programar(tarea: () => void, ms: number): () => void;
}

export const relojTemporizadorSistema: RelojTemporizador = {
  ahora: () => Date.now(),
  programar(tarea, ms) {
    const intervalo = setInterval(tarea, ms);
    return () => {
      clearInterval(intervalo);
    };
  },
};

const INTERVALO_MS = 200;

interface EstadoTemporizador {
  /** Seconds this countdown started from; a new value resets it. */
  totalSegundos: number;
  /** Milliseconds left when it was last started or paused. */
  restanteMs: number;
  /** Clock time of the last start, or `null` while paused. */
  inicio: number | null;
}

function estadoInicial(totalSegundos: number): EstadoTemporizador {
  return { totalSegundos, restanteMs: totalSegundos * 1000, inicio: null };
}

export interface ControlTemporizador {
  /** What the panel shows and publishes to the board: whole seconds left. */
  temporizador: Temporizador;
  iniciar: () => void;
  pausar: () => void;
  reiniciar: () => void;
}

/**
 * UI-only countdown for the final round (the engine stores nothing time-based). Changing
 * `totalSegundos` (for example when player 2 starts) resets it, stopped.
 */
export function useTemporizador(
  totalSegundos: number,
  reloj: RelojTemporizador = relojTemporizadorSistema,
): ControlTemporizador {
  const [estado, setEstado] = useState(() => estadoInicial(totalSegundos));
  const [ahora, setAhora] = useState(() => reloj.ahora());

  if (estado.totalSegundos !== totalSegundos) {
    setEstado(estadoInicial(totalSegundos));
  }

  const { inicio, restanteMs } = estado;
  useEffect(() => {
    if (inicio === null) {
      return undefined;
    }
    return reloj.programar(() => {
      const momento = reloj.ahora();
      if (momento - inicio >= restanteMs) {
        setEstado((actual) => ({ ...actual, restanteMs: 0, inicio: null }));
      }
      setAhora(momento);
    }, INTERVALO_MS);
  }, [inicio, restanteMs, reloj]);

  const restante = inicio === null ? restanteMs : Math.max(0, restanteMs - (ahora - inicio));

  return {
    temporizador: {
      restante: Math.ceil(restante / 1000),
      total: totalSegundos,
      corriendo: inicio !== null,
    },
    iniciar: () => {
      if (inicio !== null || restanteMs <= 0) {
        return;
      }
      const momento = reloj.ahora();
      setAhora(momento);
      setEstado((actual) => ({ ...actual, inicio: momento }));
    },
    pausar: () => {
      if (inicio === null) {
        return;
      }
      const momento = reloj.ahora();
      setAhora(momento);
      setEstado((actual) => ({
        ...actual,
        restanteMs: Math.max(0, actual.restanteMs - (momento - (actual.inicio ?? momento))),
        inicio: null,
      }));
    },
    reiniciar: () => {
      setEstado(estadoInicial(totalSegundos));
    },
  };
}
