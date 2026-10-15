import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

import { RUTAS } from '@/shared/rutas';

import { Layout } from './Layout';
import { VistaError } from './VistaError';
import { VistaInicio } from './VistaInicio';

/** Blank space under the app shell while a view's chunk loads on the first visit. */
const CARGANDO_VISTA = <div aria-busy="true" className="min-h-[50vh]" />;

/** A route whose view builds as its own chunk and loads on first use. */
function rutaDiferida(path: string, cargar: () => Promise<ComponentType>): RouteObject {
  return {
    path,
    lazy: async () => ({ Component: await cargar() }),
    hydrateFallbackElement: CARGANDO_VISTA,
  };
}

const cargarBanco = async () => (await import('@/features/banco/VistaBanco')).VistaBanco;
const cargarSetBanco = async () => (await import('@/features/banco/VistaSetBanco')).VistaSetBanco;
const cargarEditorPregunta = async () =>
  (await import('@/features/banco/VistaEditorPregunta')).VistaEditorPregunta;
const cargarImportar = async () =>
  (await import('@/features/importar/VistaImportar')).VistaImportar;
const cargarConfigurarJuego = async () =>
  (await import('@/features/juego/VistaConfigurarJuego')).VistaConfigurarJuego;
const cargarJuegoRapido = async () =>
  (await import('@/features/juego/VistaJuegoRapido')).VistaJuegoRapido;
const cargarPanel = async () => (await import('@/features/juego/VistaPanel')).VistaPanel;
const cargarImpresion = async () =>
  (await import('@/features/impresion/VistaImpresion')).VistaImpresion;
const cargarRespaldos = async () =>
  (await import('@/features/respaldos/VistaRespaldos')).VistaRespaldos;

/**
 * Route table. The projector board (`/tablero`) is a top-level route so it renders
 * without the app shell; every other view lives under `Layout`. Only the shell, Inicio and
 * the error view are in the main chunk: every other view (the board with `motion`, the
 * panel with `howler`, the bank, import and setup) is lazy-loaded as its own chunk, still
 * precached by the service worker for offline use.
 */
export const rutas: RouteObject[] = [
  {
    path: RUTAS.inicio,
    element: <Layout />,
    errorElement: <VistaError />,
    children: [
      { index: true, element: <VistaInicio /> },
      rutaDiferida(RUTAS.banco, cargarBanco),
      rutaDiferida(RUTAS.bancoSet, cargarSetBanco),
      rutaDiferida(RUTAS.bancoPreguntaNueva, cargarEditorPregunta),
      rutaDiferida(RUTAS.bancoPregunta, cargarEditorPregunta),
      rutaDiferida(RUTAS.importar, cargarImportar),
      rutaDiferida(RUTAS.configurarJuego, cargarConfigurarJuego),
      rutaDiferida(RUTAS.configurarJuegoGuardado, cargarConfigurarJuego),
      rutaDiferida(RUTAS.juegoRapido, cargarJuegoRapido),
      rutaDiferida(RUTAS.panel, cargarPanel),
      rutaDiferida(RUTAS.panelPartida, cargarPanel),
      rutaDiferida(RUTAS.impresion, cargarImpresion),
      rutaDiferida(RUTAS.respaldos, cargarRespaldos),
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
