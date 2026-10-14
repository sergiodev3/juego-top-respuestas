/**
 * Engine-owned types. The engine never imports app, db, or feature types: the panel maps its
 * saved game (`Juego` + questions) into a `ConfigPartida` snapshot before starting a partida.
 * Teams are addressed by index (0-3, keys A-D on the host keyboard).
 */

export type Multiplicador = 1 | 2 | 3;

export interface RespuestaSnapshot {
  readonly texto: string;
  readonly puntos: number;
  readonly sinonimos: readonly string[];
}

/** A question copied into the partida. Answers are sorted by points, desc (index 0 = top). */
export interface PreguntaSnapshot {
  readonly id: string;
  readonly tema: string;
  readonly texto: string;
  readonly respuestas: readonly RespuestaSnapshot[];
}

export interface EquipoConfig {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
}

export interface RondaConfig {
  readonly pregunta: PreguntaSnapshot;
  readonly multiplicador: Multiplicador;
}

export interface ConfigRondaFinal {
  /** Exactly five questions. */
  readonly preguntas: readonly PreguntaSnapshot[];
  /** Timer seconds for player 1 and player 2 (the timer itself lives in the UI). */
  readonly segundos: readonly [number, number];
  /** Points the two players must reach together. */
  readonly meta: number;
}

/** Immutable snapshot of everything a partida needs, so replay never depends on the bank. */
export interface ConfigPartida {
  readonly nombre: string;
  /** 2-4 teams. */
  readonly equipos: readonly EquipoConfig[];
  /** At least one round. */
  readonly rondas: readonly RondaConfig[];
  readonly tachasMaximas: number;
  readonly rondaFinal: ConfigRondaFinal | null;
}

export type Jugador = 1 | 2;

/** Events stored in the partida log. `DESHACER` is not an event: see `deshacer`. */
export type Evento =
  | { readonly tipo: 'ASIGNAR_TURNO'; readonly equipo: number }
  | { readonly tipo: 'REVELAR'; readonly indice: number }
  | { readonly tipo: 'TACHE' }
  | { readonly tipo: 'JUGAR' }
  | { readonly tipo: 'PASAR'; readonly equipo?: number }
  | { readonly tipo: 'ROBO_EXITOSO'; readonly indice: number }
  | { readonly tipo: 'ROBO_FALLIDO' }
  | { readonly tipo: 'REVELAR_TODAS' }
  | { readonly tipo: 'SIGUIENTE_RONDA' }
  | { readonly tipo: 'AJUSTAR_PUNTOS'; readonly equipo: number; readonly delta: number }
  | { readonly tipo: 'TERMINAR_JUEGO' }
  | {
      readonly tipo: 'RF_RESPUESTA';
      readonly jugador: Jugador;
      /** Final-round question index, 0-4. */
      readonly pregunta: number;
      /** Matched answer index, or `null` when nothing matched (0 points). */
      readonly indice: number | null;
      /** What the player said. */
      readonly texto: string;
    }
  | { readonly tipo: 'RF_REVELAR'; readonly jugador: Jugador; readonly pregunta: number }
  | { readonly tipo: 'RF_SIGUIENTE_JUGADOR' }
  | { readonly tipo: 'RF_TERMINAR' };

export type TipoEvento = Evento['tipo'];

export type Fase =
  'caraACara' | 'enJuego' | 'robo' | 'finDeRonda' | 'rondaFinal' | 'juegoTerminado';

/** Stable rejection codes; the UI may branch on them (e.g. buzzer on `RESPUESTA_REPETIDA`). */
export type CodigoRechazo =
  | 'EVENTO_DESCONOCIDO'
  | 'JUEGO_TERMINADO'
  | 'FASE_INVALIDA'
  | 'EQUIPO_INVALIDO'
  | 'RESPUESTA_INVALIDA'
  | 'RESPUESTA_YA_REVELADA'
  | 'SIN_RESPONDEDOR'
  | 'CARA_A_CARA_RESUELTO'
  | 'SIN_GANADOR_CARA_A_CARA'
  | 'PASAR_REQUIERE_EQUIPO'
  | 'SIN_EQUIPO_ROBO'
  | 'SIN_RESPUESTAS_OCULTAS'
  | 'DELTA_INVALIDO'
  | 'RONDA_FINAL_INICIADA'
  | 'JUGADOR_INVALIDO'
  | 'PREGUNTA_INVALIDA'
  | 'TEXTO_INVALIDO'
  | 'RESPUESTA_REPETIDA'
  | 'SIN_RESPUESTA';

export interface Rechazo {
  readonly ok: false;
  readonly codigo: CodigoRechazo;
  /** User-facing Spanish (es-MX) explanation. */
  readonly motivo: string;
}

export type ResultadoValidacion = { readonly ok: true } | Rechazo;

/** An event skipped during replay because it was invalid at that point of the log. */
export interface Advertencia {
  /** Position of the skipped event in the log. */
  readonly indice: number;
  readonly codigo: CodigoRechazo;
  readonly motivo: string;
}

/** `revelada` added points to the pot; `reveladaSinPuntos` came from `REVELAR_TODAS`. */
export type EstadoRespuesta = 'oculta' | 'revelada' | 'reveladaSinPuntos';

/** One face-off attempt: a responder answering once. `indice` is `null` for a miss. */
export interface IntentoCaraACara {
  readonly equipo: number;
  readonly indice: number | null;
}

export interface EstadoCaraACara {
  readonly intentos: readonly IntentoCaraACara[];
  /** Team that buzzed and has not answered yet. */
  readonly respondedor: number | null;
  /** Set once the face-off is resolved; the winner then chooses `JUGAR` or `PASAR`. */
  readonly ganador: number | null;
}

export interface EstadoRonda {
  /** 0-based index into `config.rondas`. */
  readonly indice: number;
  /** Parallel to the question's answers. */
  readonly respuestas: readonly EstadoRespuesta[];
  /** Points accumulated this round, before the multiplier. */
  readonly bolsa: number;
  readonly tachas: number;
  readonly caraACara: EstadoCaraACara;
  readonly equipoControl: number | null;
  readonly equipoRobo: number | null;
  readonly ganador: number | null;
  /** Pot x multiplier, set when the round is awarded. */
  readonly puntosOtorgados: number | null;
}

export interface RespuestaRondaFinal {
  /** Matched answer index, or `null` for no match. */
  readonly indice: number | null;
  readonly texto: string;
  readonly revelada: boolean;
}

/** Five slots per player, one per final-round question. */
export type RespuestasJugador = readonly (RespuestaRondaFinal | null)[];

export interface ResultadoRondaFinal {
  readonly total: number;
  readonly meta: number;
  readonly superoMeta: boolean;
}

export interface EstadoRondaFinal {
  /** Team playing the final round. */
  readonly equipo: number;
  readonly jugadorActual: Jugador;
  readonly jugador1: RespuestasJugador;
  readonly jugador2: RespuestasJugador;
  /** Set by `RF_TERMINAR`. A bonus result: it is never added to team scores. */
  readonly resultado: ResultadoRondaFinal | null;
}

/** Plain JSON-serializable game state. */
export interface EstadoJuego {
  readonly fase: Fase;
  /** Parallel to `config.equipos`. */
  readonly puntajes: readonly number[];
  /** Current regular round; `null` once the regular rounds are over. */
  readonly ronda: EstadoRonda | null;
  readonly rondaFinal: EstadoRondaFinal | null;
  /** Events skipped by `reducir`. */
  readonly advertencias: readonly Advertencia[];
}
