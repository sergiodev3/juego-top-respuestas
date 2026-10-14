import type { ConfigPartida, EstadoJuego, Evento } from '@/engine';
import type { NombreSonido } from '@/shared/sonido';

/**
 * The sound for an event the host just saved, given the state after it (`null`: silence).
 *
 * - `ganador` whenever the event ends the game (last round, `RF_TERMINAR`, `TERMINAR_JUEGO`).
 * - `acierto` for an answer that scores: `REVELAR` (face-off or play), `ROBO_EXITOSO`, and a
 *   final-round reveal worth points.
 * - `tache` for a miss: `TACHE` (also a face-off miss), `ROBO_FALLIDO`, and a final-round reveal
 *   of an answer that matched nothing.
 * - `revelar` for answers shown without points: `REVELAR_TODAS`, and a final-round reveal of a
 *   matched answer worth 0 points (it is on the survey board, just not scoring).
 *
 * Recording a final-round answer (`RF_RESPUESTA`) is silent: its sound comes with its reveal.
 * A repeated final-round answer is rejected by the engine, so it is never saved.
 */
export function sonidoDeEvento(
  config: ConfigPartida,
  evento: Evento,
  despues: EstadoJuego,
): NombreSonido | null {
  if (despues.fase === 'juegoTerminado') {
    return 'ganador';
  }
  switch (evento.tipo) {
    case 'REVELAR':
    case 'ROBO_EXITOSO':
      return 'acierto';
    case 'TACHE':
    case 'ROBO_FALLIDO':
      return 'tache';
    case 'REVELAR_TODAS':
      return 'revelar';
    case 'RF_REVELAR': {
      const rondaFinal = despues.rondaFinal;
      const respuestas = evento.jugador === 1 ? rondaFinal?.jugador1 : rondaFinal?.jugador2;
      const indice = respuestas?.[evento.pregunta]?.indice ?? null;
      if (indice === null) {
        return 'tache';
      }
      const puntos = config.rondaFinal?.preguntas[evento.pregunta]?.respuestas[indice]?.puntos ?? 0;
      return puntos > 0 ? 'acierto' : 'revelar';
    }
    default:
      return null;
  }
}
