import { multiplicadorDe, respuestasDe } from './reglas/comun';
import { puntosRondaFinal, respuestasJugador, totalRondaFinal } from './reglas/rondaFinal';
import type {
  ConfigPartida,
  EstadoJuego,
  EstadoRonda,
  EstadoRondaFinal,
  Fase,
  Jugador,
  Multiplicador,
  ResultadoRondaFinal,
} from './tipos';

/** An answer slot on the board; `texto` and `puntos` exist only once it is revealed. */
export interface VistaRespuesta {
  /** 1-based position on the board. */
  readonly numero: number;
  readonly revelada: boolean;
  readonly texto?: string;
  /**
   * Display points. In a regular round they are already multiplied by the round multiplier (an
   * answer worth 30 shows 60 in an x2 round); final-round points have no multiplier.
   */
  readonly puntos?: number;
}

export interface VistaEquipo {
  readonly nombre: string;
  readonly color: string;
  readonly puntaje: number;
}

export interface VistaRonda {
  /** 1-based round number. */
  readonly numero: number;
  readonly total: number;
  readonly multiplicador: Multiplicador;
  readonly pregunta: string;
  readonly respuestas: readonly VistaRespuesta[];
  readonly tachas: number;
  readonly tachasMaximas: number;
  /**
   * Display pot: the base pot times `multiplicador`, so it is exactly what the round winner gets
   * (`puntosOtorgados` once the round is awarded). The engine state keeps the base pot.
   */
  readonly bolsa: number;
  /** Team indexes into `VistaTablero.equipos`. */
  readonly equipoControl: number | null;
  readonly equipoRobo: number | null;
  readonly ganadorCaraACara: number | null;
  /**
   * Face-off misses so far this round (never round strikes). Kept after the face-off ends so
   * undoing back into it does not raise it; a new round starts at 0. Only a count: no team, no
   * answer data.
   */
  readonly fallosCaraACara: number;
  readonly ganadorRonda: number | null;
  /** Points the round winner got (pot x multiplier); equals `bolsa` once the round is awarded. */
  readonly puntosOtorgados: number | null;
}

export interface VistaJugadorRondaFinal {
  readonly jugador: Jugador;
  /** Player 1 is hidden while player 2 plays. */
  readonly oculto: boolean;
  /** `texto` is what the player said; shown with its points only once revealed. */
  readonly respuestas: readonly VistaRespuesta[];
}

export interface VistaRondaFinal {
  readonly equipo: number;
  readonly jugadorActual: Jugador;
  readonly jugadores: readonly [VistaJugadorRondaFinal, VistaJugadorRondaFinal];
  /** Running total of every revealed answer, including a hidden player 1. */
  readonly total: number;
  readonly meta: number;
  readonly resultado: ResultadoRondaFinal | null;
}

/** Everything the projector board may show. JSON-serializable; never holds hidden answers. */
export interface VistaTablero {
  readonly nombreJuego: string;
  readonly fase: Fase;
  readonly equipos: readonly VistaEquipo[];
  readonly ronda: VistaRonda | null;
  readonly rondaFinal: VistaRondaFinal | null;
}

function vistaRespuesta(
  numero: number,
  visible: { texto: string; puntos: number } | null,
): VistaRespuesta {
  return visible === null
    ? { numero, revelada: false }
    : { numero, revelada: true, texto: visible.texto, puntos: visible.puntos };
}

/** Display points of the current round, already multiplied by the round multiplier. */
export interface PuntosVisibles {
  /** Every answer of the current question (hidden ones too), in board order. */
  readonly respuestas: readonly number[];
  /** The pot: exactly what the round winner gets if the round ended now. */
  readonly bolsa: number;
}

/**
 * The points the board and the panel show for a regular round: each answer's points and the pot
 * times the round multiplier, like on TV (an answer worth 30 shows 60 in an x2 round). The
 * engine state keeps base points; the rules apply the multiplier once, when the round is awarded,
 * so the awarded points always equal the pot on display.
 */
export function puntosVisibles(config: ConfigPartida, ronda: EstadoRonda): PuntosVisibles {
  const multiplicador = multiplicadorDe(config, ronda);
  return {
    respuestas: respuestasDe(config, ronda).map(({ puntos }) => puntos * multiplicador),
    bolsa: ronda.bolsa * multiplicador,
  };
}

function proyectarRonda(config: ConfigPartida, ronda: EstadoRonda): VistaRonda {
  const configRonda = config.rondas[ronda.indice];
  const respuestas = respuestasDe(config, ronda);
  const puntos = puntosVisibles(config, ronda);
  return {
    numero: ronda.indice + 1,
    total: config.rondas.length,
    multiplicador: multiplicadorDe(config, ronda),
    pregunta: configRonda?.pregunta.texto ?? '',
    respuestas: ronda.respuestas.map((estadoRespuesta, indice) => {
      const respuesta = respuestas[indice];
      const puntosRespuesta = puntos.respuestas[indice];
      return vistaRespuesta(
        indice + 1,
        estadoRespuesta === 'oculta' || respuesta === undefined || puntosRespuesta === undefined
          ? null
          : { texto: respuesta.texto, puntos: puntosRespuesta },
      );
    }),
    tachas: ronda.tachas,
    tachasMaximas: config.tachasMaximas,
    bolsa: puntos.bolsa,
    equipoControl: ronda.equipoControl,
    equipoRobo: ronda.equipoRobo,
    ganadorCaraACara: ronda.caraACara.ganador,
    fallosCaraACara: ronda.caraACara.intentos.filter((intento) => intento.indice === null).length,
    ganadorRonda: ronda.ganador,
    puntosOtorgados: ronda.puntosOtorgados,
  };
}

function proyectarRondaFinal(
  config: ConfigPartida,
  fase: Fase,
  rondaFinal: EstadoRondaFinal,
): VistaRondaFinal | null {
  const configRondaFinal = config.rondaFinal;
  if (configRondaFinal === null) {
    return null;
  }
  const jugadorUnoOculto = fase === 'rondaFinal' && rondaFinal.jugadorActual === 2;
  const proyectarJugador = (jugador: Jugador, oculto: boolean): VistaJugadorRondaFinal => ({
    jugador,
    oculto,
    respuestas: respuestasJugador(rondaFinal, jugador).map((respuesta, pregunta) => {
      if (oculto || respuesta === null || !respuesta.revelada) {
        return vistaRespuesta(pregunta + 1, null);
      }
      return vistaRespuesta(pregunta + 1, {
        texto: respuesta.texto,
        puntos: puntosRondaFinal(configRondaFinal, pregunta, respuesta.indice),
      });
    }),
  });
  return {
    equipo: rondaFinal.equipo,
    jugadorActual: rondaFinal.jugadorActual,
    jugadores: [proyectarJugador(1, jugadorUnoOculto), proyectarJugador(2, false)],
    total: totalRondaFinal(configRondaFinal, rondaFinal),
    meta: configRondaFinal.meta,
    resultado: rondaFinal.resultado,
  };
}

/**
 * Builds the board view. Only revealed answers carry text and points; synonyms, hidden answers,
 * other rounds and replay warnings never leave the engine. Round points are display values,
 * already multiplied (see `puntosVisibles`).
 */
export function proyectarTablero(config: ConfigPartida, estado: EstadoJuego): VistaTablero {
  return {
    nombreJuego: config.nombre,
    fase: estado.fase,
    equipos: config.equipos.map((equipo, indice) => ({
      nombre: equipo.nombre,
      color: equipo.color,
      puntaje: estado.puntajes[indice] ?? 0,
    })),
    ronda: estado.ronda === null ? null : proyectarRonda(config, estado.ronda),
    rondaFinal:
      estado.rondaFinal === null
        ? null
        : proyectarRondaFinal(config, estado.fase, estado.rondaFinal),
  };
}
