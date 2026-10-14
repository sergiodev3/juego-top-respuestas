import { esquemaMensajeSync, type MensajeSync } from './mensajes';

/** Raw, untyped message pipe (BroadcastChannel in the app, an in-memory bus in tests). */
export interface Transporte {
  enviar(datos: unknown): void;
  /** Returns a function that stops listening. */
  escuchar(manejador: (datos: unknown) => void): () => void;
  cerrar(): void;
}

/** Typed channel: validates what it sends and what it receives. */
export interface Canal {
  publicar(mensaje: MensajeSync): void;
  /** Invalid incoming payloads are ignored. Returns a function that unsubscribes. */
  suscribir(manejador: (mensaje: MensajeSync) => void): () => void;
  cerrar(): void;
}

export function crearCanal(transporte: Transporte): Canal {
  return {
    publicar(mensaje) {
      // Re-parsing strips any key the protocol does not define before it leaves the window.
      transporte.enviar(esquemaMensajeSync.parse(mensaje));
    },
    suscribir(manejador) {
      return transporte.escuchar((datos) => {
        const leido = esquemaMensajeSync.safeParse(datos);
        if (leido.success) {
          manejador(leido.data);
        }
      });
    },
    cerrar() {
      transporte.cerrar();
    },
  };
}
