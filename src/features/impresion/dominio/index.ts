// Pure printing helpers (no React or Dexie): host cards, sheets, scoreboard and URL selection.
export { crearMarcador, type EquipoMarcador, type FuenteMarcador, type Marcador } from './marcador';
export { leerSeleccion, type FuenteImpresion, type SeleccionImpresion } from './seleccion';
export {
  agruparEnHojas,
  crearTarjetas,
  resumenImpresion,
  type FuenteTarjetas,
  type RespuestaTarjeta,
  type Tarjeta,
  type TarjetasPorHoja,
} from './tarjetas';
