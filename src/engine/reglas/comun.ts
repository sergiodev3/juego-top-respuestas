import { esIndiceEn, rechazar } from '../rechazos';
import type {
  ConfigPartida,
  EstadoJuego,
  EstadoRonda,
  Fase,
  Multiplicador,
  Rechazo,
  RespuestaSnapshot,
} from '../tipos';

export function respuestasDe(
  config: ConfigPartida,
  ronda: EstadoRonda,
): readonly RespuestaSnapshot[] {
  return config.rondas[ronda.indice]?.pregunta.respuestas ?? [];
}

function multiplicadorDe(config: ConfigPartida, ronda: EstadoRonda): Multiplicador {
  return config.rondas[ronda.indice]?.multiplicador ?? 1;
}

/** Replaces the current round (and optionally the phase). */
export function conRonda(estado: EstadoJuego, ronda: EstadoRonda, fase?: Fase): EstadoJuego {
  return { ...estado, ronda, fase: fase ?? estado.fase };
}

/** `null` when `indice` names a hidden answer of the current question. */
export function verificarRespuestaOculta(ronda: EstadoRonda, indice: unknown): Rechazo | null {
  if (!esIndiceEn(ronda.respuestas, indice)) {
    return rechazar('RESPUESTA_INVALIDA');
  }
  if (ronda.respuestas[indice] !== 'oculta') {
    return rechazar('RESPUESTA_YA_REVELADA');
  }
  return null;
}

/** Reveals answer `indice` and adds its points to the pot. */
export function revelar(config: ConfigPartida, ronda: EstadoRonda, indice: number): EstadoRonda {
  const puntos = respuestasDe(config, ronda)[indice]?.puntos ?? 0;
  return {
    ...ronda,
    respuestas: ronda.respuestas.map((actual, i) => (i === indice ? 'revelada' : actual)),
    bolsa: ronda.bolsa + puntos,
  };
}

/** Awards pot x multiplier to `equipo` and ends the round. */
export function otorgarRonda(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  equipo: number,
): EstadoJuego {
  const puntosOtorgados = ronda.bolsa * multiplicadorDe(config, ronda);
  return {
    ...estado,
    fase: 'finDeRonda',
    puntajes: estado.puntajes.map((puntaje, i) =>
      i === equipo ? puntaje + puntosOtorgados : puntaje,
    ),
    ronda: { ...ronda, ganador: equipo, puntosOtorgados },
  };
}
