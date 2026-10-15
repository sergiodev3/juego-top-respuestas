import { usePantallaCompleta } from '@/shared/pantallas';
import { useSuscriptorTablero } from '@/shared/sync';
import { cx } from '@/shared/utils/cx';

import { PantallaTablero } from './PantallaTablero';
import { useCursorInactivo } from './useCursorInactivo';

/**
 * Projector board (`/tablero`), rendered outside the app shell: dark, high contrast, very large
 * type. Read-only: it shows the latest `proyectarTablero` view received from the panel and
 * recovers by itself (it asks for the state on open, on focus and when it becomes visible).
 * The cursor and the fullscreen button hide after 3 s without mouse movement.
 */
export function VistaTablero() {
  const estado = useSuscriptorTablero();
  const pantallaCompleta = usePantallaCompleta();
  const cursorInactivo = useCursorInactivo();
  return (
    // Fixed to the viewport height: the board never scrolls on the projector.
    <main
      className={cx(
        'relative flex h-dvh flex-col overflow-hidden bg-slate-950 p-[clamp(0.75rem,2.5vmin,2.5rem)] text-white',
        cursorInactivo && 'cursor-none',
      )}
    >
      {pantallaCompleta.disponible && !pantallaCompleta.activa && !cursorInactivo && (
        <button
          type="button"
          onClick={pantallaCompleta.entrar}
          className="absolute top-4 right-4 z-30 rounded-lg border-2 border-amber-300 bg-slate-900 px-4 py-2 text-lg font-semibold text-amber-300 hover:bg-slate-800"
        >
          Pantalla completa
        </button>
      )}
      <PantallaTablero estado={estado} />
    </main>
  );
}
