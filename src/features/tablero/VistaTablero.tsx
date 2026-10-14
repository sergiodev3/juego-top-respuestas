import { usePantallaCompleta } from '@/shared/pantallas';
import { useSuscriptorTablero } from '@/shared/sync';

import { PantallaTablero } from './PantallaTablero';

/**
 * Projector board (`/tablero`), rendered outside the app shell: dark, high contrast, very large
 * type. Read-only: it shows the latest `proyectarTablero` view received from the panel and
 * recovers by itself (it asks for the state on open, on focus and when it becomes visible).
 */
export function VistaTablero() {
  const estado = useSuscriptorTablero();
  const pantallaCompleta = usePantallaCompleta();
  return (
    <main className="relative flex min-h-dvh flex-col bg-slate-950 p-6 text-white md:p-10">
      {pantallaCompleta.disponible && !pantallaCompleta.activa && (
        <button
          type="button"
          onClick={pantallaCompleta.entrar}
          className="absolute top-4 right-4 rounded-lg border-2 border-amber-300 bg-slate-900 px-4 py-2 text-lg font-semibold text-amber-300 hover:bg-slate-800"
        >
          Pantalla completa
        </button>
      )}
      <PantallaTablero estado={estado} />
    </main>
  );
}
