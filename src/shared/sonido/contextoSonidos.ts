import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import { crearReproductorHowler } from './reproductorHowler';
import { crearAlmacenSilencio, type AlmacenSilencio } from './silencio';
import type { NombreSonido, ReproductorSonidos } from './tipos';

export interface Sonidos {
  readonly reproductor: ReproductorSonidos;
  readonly silencio: AlmacenSilencio;
}

export const ContextoSonidos = createContext<Sonidos | null>(null);

let sonidosApp: Sonidos | null = null;

/** The window's Howler player and `localStorage` mute switch, created on first use. */
export function obtenerSonidosApp(): Sonidos {
  sonidosApp ??= {
    reproductor: crearReproductorHowler(),
    silencio: crearAlmacenSilencio(() => window.localStorage),
  };
  return sonidosApp;
}

/**
 * Sound effects from `SonidosProvider` (tests inject a fake player), or the app's. `reproducir`
 * is a no-op while muted or for `null`, and never throws; `alternarSilencio` flips and persists
 * the mute switch (the panel button and the `M` shortcut).
 */
export function useSonidos() {
  const { reproductor, silencio } = useContext(ContextoSonidos) ?? obtenerSonidosApp();
  const silenciado = useSyncExternalStore(
    silencio.suscribir,
    silencio.estaSilenciado,
    silencio.estaSilenciado,
  );

  const reproducir = useCallback(
    (nombre: NombreSonido | null) => {
      if (nombre === null || silencio.estaSilenciado()) {
        return;
      }
      try {
        reproductor.reproducir(nombre);
      } catch {
        // Audio is best effort: it must never break the UI.
      }
    },
    [reproductor, silencio],
  );

  const alternarSilencio = useCallback(() => {
    silencio.establecer(!silencio.estaSilenciado());
  }, [silencio]);

  return { silenciado, reproducir, alternarSilencio };
}
