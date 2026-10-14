import { useCallback, useSyncExternalStore } from 'react';

function suscribir(avisar: () => void): () => void {
  document.addEventListener('fullscreenchange', avisar);
  return () => {
    document.removeEventListener('fullscreenchange', avisar);
  };
}

// `!= null` also covers browsers (and jsdom) that leave the property undefined.
const estaEnPantallaCompleta = () => document.fullscreenElement != null;
const nuncaEnPantallaCompleta = () => false;

/**
 * Fullscreen state of the current document. `entrar` must run inside a click handler (browser
 * rule); a refused request is ignored, so the button simply stays visible.
 */
export function usePantallaCompleta(): {
  disponible: boolean;
  activa: boolean;
  entrar: () => void;
} {
  const activa = useSyncExternalStore(suscribir, estaEnPantallaCompleta, nuncaEnPantallaCompleta);
  const entrar = useCallback(() => {
    document.documentElement.requestFullscreen().catch(() => {
      // Refused (no user gesture, iframe policy...): nothing else to do.
    });
  }, []);
  return {
    disponible: 'requestFullscreen' in document.documentElement,
    activa,
    entrar,
  };
}
