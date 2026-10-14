import type { VistaTablero } from '@/engine';

import type { MensajeSync, Temporizador } from './mensajes';

/** The board sends `TABLERO_PRESENTE` this often. */
export const INTERVALO_LATIDO_MS = 2000;
/** The panel shows "Tablero conectado" while a heartbeat is at most this old. */
export const VENTANA_PRESENCIA_MS = 5000;

/** What the board displays. */
export type EstadoTablero =
  | { readonly tipo: 'esperando' }
  /** `nombreJuego`: the last game the board showed, so the waiting screen can keep it. */
  | { readonly tipo: 'sinPartida'; readonly nombreJuego: string | null }
  | {
      readonly tipo: 'partida';
      readonly partidaId: string;
      readonly secuencia: number;
      readonly vista: VistaTablero;
      readonly temporizador: Temporizador | null;
    };

export const ESTADO_TABLERO_INICIAL: EstadoTablero = { tipo: 'esperando' };

function ultimoNombreJuego(actual: EstadoTablero): string | null {
  switch (actual.tipo) {
    case 'partida':
      return actual.vista.nombreJuego;
    case 'sinPartida':
      return actual.nombreJuego;
    default:
      return null;
  }
}

/**
 * Board-side reducer. Keeps the latest view: within one partida a message whose `secuencia` is
 * not greater than the current one is stale and ignored (the same object is returned).
 * `SIN_PARTIDA` keeps the last known game name for the waiting screen.
 */
export function reducirEstadoTablero(actual: EstadoTablero, mensaje: MensajeSync): EstadoTablero {
  switch (mensaje.tipo) {
    case 'ESTADO_TABLERO':
      if (
        actual.tipo === 'partida' &&
        actual.partidaId === mensaje.partidaId &&
        mensaje.secuencia <= actual.secuencia
      ) {
        return actual;
      }
      return {
        tipo: 'partida',
        partidaId: mensaje.partidaId,
        secuencia: mensaje.secuencia,
        vista: mensaje.vista,
        temporizador: mensaje.temporizador,
      };
    case 'SIN_PARTIDA':
      return { tipo: 'sinPartida', nombreJuego: ultimoNombreJuego(actual) };
    default:
      return actual;
  }
}

/**
 * Panel-side sequence numbers: strictly increasing and never below the clock, so a reloaded
 * panel (which starts a new counter) is never taken for stale by an open board.
 */
export function crearContadorSecuencia(ahora: () => number) {
  let ultima = -1;
  return {
    siguiente(): number {
      ultima = Math.max(ultima + 1, Math.floor(ahora()));
      return ultima;
    },
  };
}

/** True when the last heartbeat (epoch ms) is at most `VENTANA_PRESENCIA_MS` old. */
export function tableroConectado(ultimoLatido: number | null, ahora: number): boolean {
  return ultimoLatido !== null && ahora - ultimoLatido <= VENTANA_PRESENCIA_MS;
}
