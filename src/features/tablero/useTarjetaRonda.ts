import { useEffect, useState } from 'react';

import type { VistaTablero } from '@/engine';
import type { EstadoTablero } from '@/shared/sync';

/** How long the round title card covers the board; the question shows right after it. */
export const DURACION_TARJETA_RONDA_MS = 3000;

export type Tarjeta =
  | {
      readonly tipo: 'ronda';
      readonly nombreJuego: string;
      readonly numero: number;
      readonly total: number;
      readonly multiplicador: number;
    }
  | { readonly tipo: 'final'; readonly nombreJuego: string };

/** Where the game is: which partida and how far into it (the final round comes last). */
interface Marca {
  readonly partidaId: string;
  readonly orden: number;
}

function marcaDe(estado: EstadoTablero): Marca | null {
  if (estado.tipo !== 'partida') {
    return null;
  }
  const { vista, partidaId } = estado;
  if (vista.fase === 'rondaFinal') {
    return { partidaId, orden: Number.MAX_SAFE_INTEGER };
  }
  if (vista.fase === 'juegoTerminado' || vista.ronda === null) {
    return null;
  }
  return { partidaId, orden: vista.ronda.numero };
}

function tarjetaDe(vista: VistaTablero): Tarjeta | null {
  if (vista.fase === 'rondaFinal') {
    return { tipo: 'final', nombreJuego: vista.nombreJuego };
  }
  return vista.ronda === null
    ? null
    : {
        tipo: 'ronda',
        nombreJuego: vista.nombreJuego,
        numero: vista.ronda.numero,
        total: vista.ronda.total,
        multiplicador: vista.ronda.multiplicador,
      };
}

function mismaMarca(a: Marca | null, b: Marca | null): boolean {
  return a?.partidaId === b?.partidaId && a?.orden === b?.orden;
}

/**
 * The title card to show right now, if any: when the same partida moves on to a later round (or
 * into the final round) while the board is open. Nothing on mount, on reconnect (the board was
 * waiting), in another partida, or when undoing back to an earlier round. Gone after ~3 s.
 */
export function useTarjetaRonda(estado: EstadoTablero): Tarjeta | null {
  const marca = marcaDe(estado);
  const [previa, setPrevia] = useState(marca);
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);

  // Adjust state while rendering when the round changes (no extra effect pass).
  if (!mismaMarca(marca, previa)) {
    setPrevia(marca);
    const avanza =
      marca !== null &&
      previa !== null &&
      marca.partidaId === previa.partidaId &&
      marca.orden > previa.orden;
    setTarjeta(avanza && estado.tipo === 'partida' ? tarjetaDe(estado.vista) : null);
  }

  useEffect(() => {
    if (tarjeta === null) {
      return;
    }
    const temporizador = setTimeout(() => {
      setTarjeta(null);
    }, DURACION_TARJETA_RONDA_MS);
    return () => {
      clearTimeout(temporizador);
    };
  }, [tarjeta]);

  return tarjeta;
}
