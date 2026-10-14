/** The game's sound effects; each one is `public/sonidos/<nombre>.wav`. */
export const NOMBRES_SONIDO = ['acierto', 'tache', 'revelar', 'ganador'] as const;

export type NombreSonido = (typeof NOMBRES_SONIDO)[number];

/** Plays sound effects. Implementations must never throw (audio is best effort). */
export interface ReproductorSonidos {
  reproducir(nombre: NombreSonido): void;
}
