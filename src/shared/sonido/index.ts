// Sound effects (Howler) with a persisted mute switch. Import from `@/shared/sonido`.
export { obtenerSonidosApp, useSonidos, type Sonidos } from './contextoSonidos';
export { crearReproductorHowler, type OpcionesReproductorHowler } from './reproductorHowler';
export {
  CLAVE_SILENCIO,
  crearAlmacenSilencio,
  type AlmacenamientoSilencio,
  type AlmacenSilencio,
} from './silencio';
export { SonidosProvider } from './SonidosProvider';
export { NOMBRES_SONIDO, type NombreSonido, type ReproductorSonidos } from './tipos';
