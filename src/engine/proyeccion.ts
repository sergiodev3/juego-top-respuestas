import { respuestasDe } from './reglas/comun';
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
  readonly bolsa: number;
  /** Team indexes into `VistaTablero.equipos`. */
  readonly equipoControl: number | null;
  readonly equipoRobo: number | null;
  readonly ganadorCaraACara: number | null;
  readonly ganadorRonda: number | null;
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

function proyectarRonda(config: ConfigPartida, ronda: EstadoRonda): VistaRonda {
  const configRonda = config.rondas[ronda.indice];
  const respuestas = respuestasDe(config, ronda);
  return {
    numero: ronda.indice + 1,
    total: config.rondas.length,
    multiplicador: configRonda?.multiplicador ?? 1,
    pregunta: configRonda?.pregunta.texto ?? '',
    respuestas: ronda.respuestas.map((estadoRespuesta, indice) => {
      const respuesta = respuestas[indice];
      return vistaRespuesta(
        indice + 1,
        estadoRespuesta === 'oculta' || respuesta === undefined
          ? null
          : { texto: respuesta.texto, puntos: respuesta.puntos },
      );
    }),
    tachas: ronda.tachas,
    tachasMaximas: config.tachasMaximas,
    bolsa: ronda.bolsa,
    equipoControl: ronda.equipoControl,
    equipoRobo: ronda.equipoRobo,
    ganadorCaraACara: ronda.caraACara.ganador,
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
 * other rounds and replay warnings never leave the engine.
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
