// Public API of the pure game engine. Import from `@/engine`, never from inner modules.
export type * from './tipos';
export { EventoRechazadoError } from './rechazos';
export { PREGUNTAS_RONDA_FINAL, crearEstadoInicial, validarConfig } from './estadoInicial';
export { esquemaConfigPartida, esquemaEvento } from './esquemas';
export { aplicar, deshacer, reducir, validar } from './motor';
export { reconstruir } from './reconstruccion';
export type {
  VistaEquipo,
  VistaJugadorRondaFinal,
  VistaRespuesta,
  VistaRonda,
  VistaRondaFinal,
  VistaTablero,
} from './proyeccion';
export { proyectarTablero } from './proyeccion';
