import type { CodigoRechazo, ConfigPartida, EstadoJuego, Rechazo } from './tipos';

const MOTIVOS: Readonly<Record<CodigoRechazo, string>> = {
  EVENTO_DESCONOCIDO: 'No se reconoce esta acción.',
  EVENTO_MALFORMADO: 'El evento guardado no tiene un formato válido.',
  JUEGO_TERMINADO: 'El juego ya terminó.',
  FASE_INVALIDA: 'Esta acción no está disponible en este momento del juego.',
  EQUIPO_INVALIDO: 'Elige un equipo válido.',
  RESPUESTA_INVALIDA: 'Esa respuesta no existe en esta pregunta.',
  RESPUESTA_YA_REVELADA: 'Esa respuesta ya está revelada.',
  SIN_RESPONDEDOR: 'Primero indica qué equipo presionó el botón.',
  CARA_A_CARA_RESUELTO: 'El cara a cara ya tiene ganador: elige jugar o pasar.',
  SIN_GANADOR_CARA_A_CARA: 'El cara a cara todavía no tiene ganador.',
  PASAR_REQUIERE_EQUIPO: 'Indica a qué equipo se le pasa el turno.',
  SIN_EQUIPO_ROBO: 'Primero indica qué equipo intenta robar.',
  SIN_RESPUESTAS_OCULTAS: 'Todas las respuestas ya están reveladas.',
  DELTA_INVALIDO: 'El ajuste debe ser un número entero distinto de cero.',
  RONDA_FINAL_INICIADA: 'Ya no se puede cambiar el equipo porque la ronda final ya empezó.',
  JUGADOR_INVALIDO: 'Ese jugador no está en turno.',
  PREGUNTA_INVALIDA: 'Esa pregunta no existe en la ronda final.',
  TEXTO_INVALIDO: 'Escribe lo que respondió el jugador.',
  RESPUESTA_REPETIDA: 'El primer jugador ya dio esa respuesta. Pide otra.',
  SIN_RESPUESTA: 'Ese jugador todavía no responde esa pregunta.',
};

/** Builds a rejection with the default message for `codigo`, or a more specific `motivo`. */
export function rechazar(codigo: CodigoRechazo, motivo: string = MOTIVOS[codigo]): Rechazo {
  return { ok: false, codigo, motivo };
}

/** Result of processing one event: the next state, or why it was rejected. */
export type Procesado = { readonly ok: true; readonly estado: EstadoJuego } | Rechazo;

export function aceptar(estado: EstadoJuego): Procesado {
  return { ok: true, estado };
}

export function esIndiceEquipo(config: ConfigPartida, equipo: unknown): equipo is number {
  return (
    Number.isInteger(equipo) &&
    (equipo as number) >= 0 &&
    (equipo as number) < config.equipos.length
  );
}

export function esIndiceEn(lista: readonly unknown[], indice: unknown): indice is number {
  return Number.isInteger(indice) && (indice as number) >= 0 && (indice as number) < lista.length;
}

/** Thrown by `aplicar` for an invalid event. `reducir` never throws for invalid events. */
export class EventoRechazadoError extends Error {
  readonly codigo: CodigoRechazo;

  constructor(rechazo: Rechazo) {
    super(rechazo.motivo);
    this.name = 'EventoRechazadoError';
    this.codigo = rechazo.codigo;
  }
}
