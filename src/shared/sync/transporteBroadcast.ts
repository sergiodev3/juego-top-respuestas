import type { Transporte } from './canal';

/** BroadcastChannel name shared by the panel and the board (same origin only). */
export const NOMBRE_CANAL = 'top-respuestas';

/**
 * BroadcastChannel adapter. Returns `null` where the API is missing; callers then fall back
 * to `transporteNulo`. Like BroadcastChannel, a window never receives its own messages.
 */
export function crearTransporteBroadcast(nombre: string = NOMBRE_CANAL): Transporte | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  const canal = new BroadcastChannel(nombre);
  return {
    enviar(datos) {
      canal.postMessage(datos);
    },
    escuchar(manejador) {
      const oyente = (evento: MessageEvent<unknown>) => {
        manejador(evento.data);
      };
      canal.addEventListener('message', oyente);
      return () => {
        canal.removeEventListener('message', oyente);
      };
    },
    cerrar() {
      canal.close();
    },
  };
}

/** Transport that drops everything (no BroadcastChannel available). */
export const transporteNulo: Transporte = {
  enviar() {
    // Nothing to send to.
  },
  escuchar() {
    return () => {
      // Nothing to stop.
    };
  },
  cerrar() {
    // Nothing to close.
  },
};
