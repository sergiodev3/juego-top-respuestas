import { Link, NavLink, Outlet } from 'react-router';

import { RUTAS } from '@/shared/rutas';
import { cx } from '@/shared/utils/cx';

const ENLACES = [
  { to: RUTAS.banco, etiqueta: 'Banco' },
  { to: RUTAS.importar, etiqueta: 'Importar' },
  { to: RUTAS.configurarJuego, etiqueta: 'Configurar juego' },
  { to: RUTAS.panel, etiqueta: 'Panel' },
  { to: RUTAS.impresion, etiqueta: 'Impresión' },
  { to: RUTAS.respaldos, etiqueta: 'Respaldos' },
] as const;

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-amber-400 text-slate-900' : 'text-slate-100 hover:bg-slate-700',
  );

/** App shell (header + navigation) for every view except the projector board. */
export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to={RUTAS.inicio} className="text-xl font-bold text-amber-300">
            Top Respuestas
          </Link>
          <nav aria-label="Navegación principal" className="flex flex-wrap gap-1">
            {ENLACES.map((enlace) => (
              <NavLink key={enlace.to} to={enlace.to} className={claseEnlace}>
                {enlace.etiqueta}
              </NavLink>
            ))}
            <a
              href={RUTAS.tablero}
              target="_blank"
              rel="noopener"
              className={claseEnlace({ isActive: false })}
            >
              Tablero <span aria-hidden="true">↗</span>
              <span className="sr-only"> (se abre en una ventana nueva)</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
