import type { Variants } from 'motion/react';

/** Length of the reveal flip. */
export const DURACION_VOLTEO_S = 0.5;

/**
 * Reveal flip for answer slots (`animate={revelada ? 'revelada' : 'oculta'}`). The slot turns
 * in from edge-on around its horizontal axis; hiding it again (undo) does not animate. Use with
 * `initial={false}` so slots that are already revealed on mount do not flip.
 */
export const VOLTEO: Variants = {
  oculta: { rotateX: 0 },
  revelada: { rotateX: [90, 0] },
};
