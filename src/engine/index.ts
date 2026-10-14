// Public API of the pure game engine. Import from `@/engine`, never from inner modules.
export type * from './tipos';
export { EventoRechazadoError } from './rechazos';
export { crearEstadoInicial, validarConfig } from './estadoInicial';
export { aplicar, deshacer, reducir, validar } from './motor';
export type {
  VistaEquipo,
  VistaJugadorRondaFinal,
  VistaRespuesta,
  VistaRonda,
  VistaRondaFinal,
  VistaTablero,
} from './proyeccion';
export { proyectarTablero } from './proyeccion';
