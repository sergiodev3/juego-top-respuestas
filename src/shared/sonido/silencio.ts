/** `localStorage` key of the per-device mute choice. */
export const CLAVE_SILENCIO = 'top-respuestas:silencio';

export type AlmacenamientoSilencio = Pick<Storage, 'getItem' | 'setItem'>;

/** Mute switch; a snapshot store usable with `useSyncExternalStore`. */
export interface AlmacenSilencio {
  readonly estaSilenciado: () => boolean;
  readonly establecer: (silenciado: boolean) => void;
  readonly suscribir: (alCambiar: () => void) => () => void;
}

/**
 * Mute state persisted in storage as a per-device convenience (sound on by default). Storage
 * may be missing or throw (private windows, blocked site data): every access is guarded and the
 * choice then lasts for the session only.
 */
export function crearAlmacenSilencio(
  obtenerAlmacenamiento: () => AlmacenamientoSilencio | undefined,
): AlmacenSilencio {
  let silenciado = false;
  try {
    silenciado = obtenerAlmacenamiento()?.getItem(CLAVE_SILENCIO) === 'true';
  } catch {
    // Unreadable storage: keep the default (sound on).
  }
  const suscriptores = new Set<() => void>();

  return {
    estaSilenciado: () => silenciado,
    establecer: (valor) => {
      if (valor === silenciado) {
        return;
      }
      silenciado = valor;
      try {
        obtenerAlmacenamiento()?.setItem(CLAVE_SILENCIO, String(valor));
      } catch {
        // Not persisted; the choice still applies until the page closes.
      }
      for (const alCambiar of suscriptores) {
        alCambiar();
      }
    },
    suscribir: (alCambiar) => {
      suscriptores.add(alCambiar);
      return () => {
        suscriptores.delete(alCambiar);
      };
    },
  };
}
