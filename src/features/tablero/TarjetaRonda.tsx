import { motion, useReducedMotion } from 'motion/react';

import type { Tarjeta } from './useTarjetaRonda';

function etiquetaMultiplicador(multiplicador: number): string | null {
  if (multiplicador === 2) {
    return 'Puntos dobles';
  }
  if (multiplicador === 3) {
    return 'Puntos triples';
  }
  return null;
}

/** Full-screen round title card: game name, "Ronda N de M" or "Ronda final", and the multiplier. */
export function TarjetaRonda({ tarjeta }: { tarjeta: Tarjeta }) {
  const reducido = useReducedMotion() ?? false;
  const multiplicador =
    tarjeta.tipo === 'ronda' ? etiquetaMultiplicador(tarjeta.multiplicador) : null;
  return (
    <section
      aria-label="Presentación de la ronda"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950 p-[clamp(1rem,4vmin,4rem)] text-center"
    >
      <motion.div
        initial={reducido ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex flex-col items-center gap-[clamp(1rem,4vh,3rem)]"
      >
        <p className="text-tablero-lg font-bold text-slate-100">{tarjeta.nombreJuego}</p>
        <p className="text-tablero-2xl leading-none font-black tracking-tight text-amber-300">
          {tarjeta.tipo === 'final'
            ? 'Ronda final'
            : `Ronda ${String(tarjeta.numero)} de ${String(tarjeta.total)}`}
        </p>
        {multiplicador !== null && (
          <p className="rounded-full bg-amber-300 px-[1em] py-[0.25em] text-tablero-lg font-extrabold text-slate-950">
            {multiplicador}
          </p>
        )}
      </motion.div>
    </section>
  );
}
