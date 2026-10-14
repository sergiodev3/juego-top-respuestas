// Pure game-setup helpers (no React or Dexie): config snapshots, quick game, partida loading.
export { cargarPartida } from './cargarPartida';
export { crearConfigPartida, crearJuegoRapido, type ResultadoConfigPartida } from './configPartida';
export {
  agregarEquipo,
  elegirAlAzar,
  letraEquipo,
  llenarRondaFinal,
  llenarRondas,
  mensajesValidacion,
  moverRonda,
  preguntasEnUso,
  quitarEquipo,
  validarParaIniciar,
} from './edicionJuego';
export {
  accionSiguienteRonda,
  confirmacionPara,
  ETIQUETAS_FASE,
  evaluarAccion,
  eventoRevelar,
  ganadoresJuego,
  guiaPanel,
  nombreEquipo,
  proyectarTotalRondaFinal,
  respuestasOcultas,
  type Confirmacion,
  type EstadoAccion,
} from './panel';
