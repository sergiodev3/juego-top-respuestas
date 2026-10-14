import type { RouteObject } from 'react-router';

import { VistaBanco } from '@/features/banco/VistaBanco';
import { VistaEditorPregunta } from '@/features/banco/VistaEditorPregunta';
import { VistaSetBanco } from '@/features/banco/VistaSetBanco';
import { VistaImportar } from '@/features/importar/VistaImportar';
import { VistaImpresion } from '@/features/impresion/VistaImpresion';
import { VistaConfigurarJuego } from '@/features/juego/VistaConfigurarJuego';
import { VistaJuegoRapido } from '@/features/juego/VistaJuegoRapido';
import { VistaPanel } from '@/features/juego/VistaPanel';
import { VistaRespaldos } from '@/features/respaldos/VistaRespaldos';
import { RUTAS } from '@/shared/rutas';

import { Layout } from './Layout';
import { VistaError } from './VistaError';
import { VistaInicio } from './VistaInicio';

/**
 * Route table. The projector board (`/tablero`) is a top-level route so it renders
 * without the app shell; every other view lives under `Layout`. The board is lazy-loaded:
 * it (and `motion`, which only the board uses) builds as its own chunk, still precached by
 * the service worker for offline use.
 */
export const rutas: RouteObject[] = [
  {
    path: RUTAS.inicio,
    element: <Layout />,
    errorElement: <VistaError />,
    children: [
      { index: true, element: <VistaInicio /> },
      { path: RUTAS.banco, element: <VistaBanco /> },
      { path: RUTAS.bancoSet, element: <VistaSetBanco /> },
      { path: RUTAS.bancoPreguntaNueva, element: <VistaEditorPregunta /> },
      { path: RUTAS.bancoPregunta, element: <VistaEditorPregunta /> },
      { path: RUTAS.importar, element: <VistaImportar /> },
      { path: RUTAS.configurarJuego, element: <VistaConfigurarJuego /> },
      { path: RUTAS.configurarJuegoGuardado, element: <VistaConfigurarJuego /> },
      { path: RUTAS.juegoRapido, element: <VistaJuegoRapido /> },
      { path: RUTAS.panel, element: <VistaPanel /> },
      { path: RUTAS.panelPartida, element: <VistaPanel /> },
      { path: RUTAS.impresion, element: <VistaImpresion /> },
      { path: RUTAS.respaldos, element: <VistaRespaldos /> },
      { path: '*', element: <VistaError noEncontrada /> },
    ],
  },
  {
    path: RUTAS.tablero,
    lazy: async () => {
      const { VistaTablero } = await import('@/features/tablero/VistaTablero');
      return { Component: VistaTablero };
    },
    // Dark while the board chunk loads, so the projector never flashes white.
    hydrateFallbackElement: <div className="min-h-dvh bg-slate-950" />,
    errorElement: <VistaError />,
  },
];
