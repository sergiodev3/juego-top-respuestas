// Panel <-> board synchronization. Import from `@/shared/sync`.
export { crearCanal, type Canal, type Transporte } from './canal';
export { CanalSyncProvider } from './CanalSyncProvider';
export { obtenerCanalApp, useCanalSync } from './contextoCanal';
export {
  usePublicadorTablero,
  useSuscriptorTablero,
  type DatosTablero,
  type OpcionesPublicador,
} from './hooks';
export {
  esquemaMensajeSync,
  esquemaTemporizador,
  esquemaVistaTablero,
  VERSION_PROTOCOLO,
  type MensajeEstadoTablero,
  type MensajeSync,
  type Temporizador,
} from './mensajes';
export {
  crearContadorSecuencia,
  ESTADO_TABLERO_INICIAL,
  INTERVALO_LATIDO_MS,
  reducirEstadoTablero,
  tableroConectado,
  VENTANA_PRESENCIA_MS,
  type EstadoTablero,
} from './protocolo';
export { crearTransporteBroadcast, NOMBRE_CANAL, transporteNulo } from './transporteBroadcast';
