import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

/** How long the big X overlay stays on screen after a strike. */
const DURACION_SOBREPOSICION_TACHAS_MS = 1200;

interface SobreposicionTachasProps {
  tachas: number;
  maximas: number;
}

/**
 * Full-screen big red X shown for a moment whenever the strike count goes up (one X per current
 * strike, at most `maximas`). Strikes present on mount, decreases (undo) and new rounds never
 * show it, so a reconnecting board does not replay them.
 */
export function SobreposicionTachas({ tachas, maximas }: SobreposicionTachasProps) {
  const reducido = useReducedMotion() ?? false;
  const [previas, setPrevias] = useState(tachas);
  const [aviso, setAviso] = useState<{ cuenta: number } | null>(null);

  // Adjust state while rendering when the prop changes (no extra effect pass).
  if (tachas !== previas) {
    setPrevias(tachas);
    setAviso(tachas > previas ? { cuenta: Math.min(tachas, maximas) } : null);
  }

  useEffect(() => {
    if (aviso === null) {
      return;
    }
    const temporizador = setTimeout(() => {
      setAviso(null);
    }, DURACION_SOBREPOSICION_TACHAS_MS);
    return () => {
      clearTimeout(temporizador);
    };
  }, [aviso]);

  if (aviso === null) {
    return null;
  }
  const { cuenta } = aviso;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60">
      <motion.div
        role="img"
        aria-label={cuenta === 1 ? '1 tacha' : `${String(cuenta)} tachas`}
        initial={reducido ? false : { scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="flex gap-6"
      >
        {Array.from({ length: cuenta }, (_, indice) => (
          <span
            key={indice}
            className="text-[12rem] leading-none font-black text-red-600 [-webkit-text-stroke:6px_white] md:text-[18rem]"
          >
            X
          </span>
        ))}
      </motion.div>
    </div>
  );
}
