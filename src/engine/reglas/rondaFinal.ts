import { PREGUNTAS_RONDA_FINAL } from '../estadoInicial';
import { aceptar, esIndiceEn, esIndiceEquipo, rechazar, type Procesado } from '../rechazos';
import type {
  ConfigPartida,
  ConfigRondaFinal,
  EstadoJuego,
  EstadoRondaFinal,
  Evento,
  Jugador,
  RespuestaRondaFinal,
  RespuestasJugador,
} from '../tipos';

function esJugador(valor: unknown): valor is Jugador {
  return valor === 1 || valor === 2;
}

export function respuestasJugador(
  rondaFinal: EstadoRondaFinal,
  jugador: Jugador,
): RespuestasJugador {
  return jugador === 1 ? rondaFinal.jugador1 : rondaFinal.jugador2;
}

function conRespuesta(
  rondaFinal: EstadoRondaFinal,
  jugador: Jugador,
  pregunta: number,
  respuesta: RespuestaRondaFinal,
): EstadoRondaFinal {
  const respuestas = respuestasJugador(rondaFinal, jugador).map((actual, i) =>
    i === pregunta ? respuesta : actual,
  );
  return jugador === 1
    ? { ...rondaFinal, jugador1: respuestas }
    : { ...rondaFinal, jugador2: respuestas };
}

/** Points of a final-round answer; an unmatched answer (`indice: null`) is worth 0. */
export function puntosRondaFinal(
  config: ConfigRondaFinal,
  pregunta: number,
  indice: number | null,
): number {
  return indice === null ? 0 : (config.preguntas[pregunta]?.respuestas[indice]?.puntos ?? 0);
}

/** Sum of the revealed answers of both players. */
export function totalRondaFinal(config: ConfigRondaFinal, rondaFinal: EstadoRondaFinal): number {
  let total = 0;
  for (const respuestas of [rondaFinal.jugador1, rondaFinal.jugador2]) {
    respuestas.forEach((respuesta, pregunta) => {
      if (respuesta?.revelada === true) {
        total += puntosRondaFinal(config, pregunta, respuesta.indice);
      }
    });
  }
  return total;
}

/** The highest score plays the final round; ties go to the lowest team index. */
export function crearEstadoRondaFinal(puntajes: readonly number[]): EstadoRondaFinal {
  let equipo = 0;
  let maximo = Number.NEGATIVE_INFINITY;
  puntajes.forEach((puntaje, indice) => {
    if (puntaje > maximo) {
      maximo = puntaje;
      equipo = indice;
    }
  });
  const vacias = Array.from({ length: PREGUNTAS_RONDA_FINAL }, () => null);
  return { equipo, jugadorActual: 1, jugador1: vacias, jugador2: vacias, resultado: null };
}

function responder(
  config: ConfigRondaFinal,
  estado: EstadoJuego,
  rondaFinal: EstadoRondaFinal,
  evento: Extract<Evento, { tipo: 'RF_RESPUESTA' }>,
): Procesado {
  const { jugador, pregunta, indice, texto } = evento;
  if (!esJugador(jugador) || jugador !== rondaFinal.jugadorActual) {
    return rechazar('JUGADOR_INVALIDO');
  }
  if (!esIndiceEn(config.preguntas, pregunta)) {
    return rechazar('PREGUNTA_INVALIDA');
  }
  const respuestas = config.preguntas[pregunta]?.respuestas ?? [];
  if (indice !== null && !esIndiceEn(respuestas, indice)) {
    return rechazar('RESPUESTA_INVALIDA');
  }
  if (typeof (texto as unknown) !== 'string') {
    return rechazar('TEXTO_INVALIDO');
  }
  if (jugador === 2 && indice !== null && rondaFinal.jugador1[pregunta]?.indice === indice) {
    return rechazar('RESPUESTA_REPETIDA');
  }
  // Answering again corrects the previous answer, which must then be revealed again.
  const siguiente = conRespuesta(rondaFinal, jugador, pregunta, { indice, texto, revelada: false });
  return aceptar({ ...estado, rondaFinal: siguiente });
}

function revelarRespuesta(
  config: ConfigRondaFinal,
  estado: EstadoJuego,
  rondaFinal: EstadoRondaFinal,
  jugador: unknown,
  pregunta: unknown,
): Procesado {
  if (!esJugador(jugador)) {
    return rechazar('JUGADOR_INVALIDO');
  }
  if (!esIndiceEn(config.preguntas, pregunta)) {
    return rechazar('PREGUNTA_INVALIDA');
  }
  const respuesta = respuestasJugador(rondaFinal, jugador)[pregunta] ?? null;
  if (respuesta === null) {
    return rechazar('SIN_RESPUESTA');
  }
  if (respuesta.revelada) {
    return rechazar('RESPUESTA_YA_REVELADA');
  }
  const siguiente = conRespuesta(rondaFinal, jugador, pregunta, { ...respuesta, revelada: true });
  return aceptar({ ...estado, rondaFinal: siguiente });
}

export function procesarRondaFinal(
  config: ConfigPartida,
  estado: EstadoJuego,
  rondaFinal: EstadoRondaFinal,
  evento: Evento,
): Procesado {
  const configRondaFinal = config.rondaFinal;
  if (configRondaFinal === null) {
    return rechazar('FASE_INVALIDA');
  }
  switch (evento.tipo) {
    case 'ASIGNAR_TURNO': {
      if (!esIndiceEquipo(config, evento.equipo)) {
        return rechazar('EQUIPO_INVALIDO');
      }
      const iniciada = [...rondaFinal.jugador1, ...rondaFinal.jugador2].some((r) => r !== null);
      if (iniciada) {
        return rechazar('RONDA_FINAL_INICIADA');
      }
      return aceptar({ ...estado, rondaFinal: { ...rondaFinal, equipo: evento.equipo } });
    }
    case 'RF_RESPUESTA':
      return responder(configRondaFinal, estado, rondaFinal, evento);
    case 'RF_REVELAR':
      return revelarRespuesta(
        configRondaFinal,
        estado,
        rondaFinal,
        evento.jugador,
        evento.pregunta,
      );
    case 'RF_SIGUIENTE_JUGADOR': {
      if (rondaFinal.jugadorActual === 2) {
        return rechazar('JUGADOR_INVALIDO', 'El segundo jugador ya está en turno.');
      }
      return aceptar({ ...estado, rondaFinal: { ...rondaFinal, jugadorActual: 2 } });
    }
    case 'RF_TERMINAR': {
      // A bonus result only: final-round points are never added to team scores.
      const total = totalRondaFinal(configRondaFinal, rondaFinal);
      const { meta } = configRondaFinal;
      return aceptar({
        ...estado,
        fase: 'juegoTerminado',
        rondaFinal: { ...rondaFinal, resultado: { total, meta, superoMeta: total >= meta } },
      });
    }
    default:
      return rechazar('FASE_INVALIDA');
  }
}
