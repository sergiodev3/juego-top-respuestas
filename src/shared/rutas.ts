/**
 * Single source of truth for application paths.
 * Shared so features can link to each other without importing from `src/app`.
 */
export const RUTAS = {
  inicio: '/',
  banco: '/banco',
  importar: '/importar',
  configurarJuego: '/juego/configurar',
  panel: '/juego/panel',
  tablero: '/tablero',
  impresion: '/impresion',
  respaldos: '/respaldos',
} as const;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];
