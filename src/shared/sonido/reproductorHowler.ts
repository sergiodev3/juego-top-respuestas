import { Howl } from 'howler';

import type { NombreSonido, ReproductorSonidos } from './tipos';

/** The part of a `Howl` the player uses. */
interface SonidoHowl {
  play(): unknown;
}

export interface OpcionesReproductorHowler {
  /** App base URL (Vite `BASE_URL`); sounds live at `<base>sonidos/<nombre>.wav`. */
  base?: string;
  /** Tests inject a fake instead of creating real Howler sounds. */
  crearHowl?: (src: string) => SonidoHowl;
}

function crearHowlReal(src: string): SonidoHowl {
  return new Howl({ src: [src], preload: true });
}

/**
 * Howler-backed player: each sound is created (and loaded) on first use and reused after.
 * Audio is best effort, so creation and playback errors are swallowed.
 */
export function crearReproductorHowler({
  base = import.meta.env.BASE_URL,
  crearHowl = crearHowlReal,
}: OpcionesReproductorHowler = {}): ReproductorSonidos {
  const sonidos = new Map<NombreSonido, SonidoHowl>();
  return {
    reproducir(nombre) {
      try {
        let sonido = sonidos.get(nombre);
        if (sonido === undefined) {
          sonido = crearHowl(`${base}sonidos/${nombre}.wav`);
          sonidos.set(nombre, sonido);
        }
        sonido.play();
      } catch {
        // A missing or blocked sound must never break the panel.
      }
    },
  };
}
