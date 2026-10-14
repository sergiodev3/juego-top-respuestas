import { generatePath } from 'react-router';

/**
 * Single source of truth for application paths.
 * Shared so features can link to each other without importing from `src/app`.
 */
export const RUTAS = {
  inicio: '/',
  banco: '/banco',
  bancoSet: '/banco/:setId',
  bancoPreguntaNueva: '/banco/:setId/preguntas/nueva',
  bancoPregunta: '/banco/:setId/preguntas/:preguntaId',
  importar: '/importar',
  configurarJuego: '/juego/configurar',
  configurarJuegoGuardado: '/juego/configurar/:juegoId',
  panel: '/juego/panel',
  panelPartida: '/juego/panel/:partidaId',
  tablero: '/tablero',
  impresion: '/impresion',
  respaldos: '/respaldos',
} as const;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];

/** `/banco/:setId` */
export function rutaSetBanco(setId: string): string {
  return generatePath(RUTAS.bancoSet, { setId });
}

/** `/banco/:setId/preguntas/nueva` */
export function rutaPreguntaNueva(setId: string): string {
  return generatePath(RUTAS.bancoPreguntaNueva, { setId });
}

/** `/juego/configurar/:juegoId` */
export function rutaConfigurarJuego(juegoId: string): string {
  return generatePath(RUTAS.configurarJuegoGuardado, { juegoId });
}

/** `/juego/panel/:partidaId` */
export function rutaPanel(partidaId: string): string {
  return generatePath(RUTAS.panelPartida, { partidaId });
}

/** `/banco/:setId/preguntas/:preguntaId` */
export function rutaEditarPregunta(setId: string, preguntaId: string): string {
  return generatePath(RUTAS.bancoPregunta, { setId, preguntaId });
}
