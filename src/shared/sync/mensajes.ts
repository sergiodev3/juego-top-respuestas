/**
 * Panel <-> board wire protocol (version 1). Every message is validated on receipt; the board
 * only ever gets the `proyectarTablero` projection, never the config or the event log.
 */
import { z } from 'zod';

import type { Fase, VistaTablero } from '@/engine';

export const VERSION_PROTOCOLO = 1;

const FASES = [
  'caraACara',
  'enJuego',
  'robo',
  'finDeRonda',
  'rondaFinal',
  'juegoTerminado',
] as const satisfies readonly Fase[];

const indice = z.number().int().min(0);
const entero = z.number().int();

const esquemaVistaRespuesta = z.object({
  numero: z.number().int().positive(),
  revelada: z.boolean(),
  texto: z.string().optional(),
  puntos: entero.optional(),
});

const esquemaVistaJugador = z.object({
  jugador: z.literal([1, 2]),
  oculto: z.boolean(),
  respuestas: z.array(esquemaVistaRespuesta).readonly(),
});

/**
 * Mirror of the engine `VistaTablero`. `satisfies` plus the type test in `mensajes.test.ts`
 * keep both in lockstep. Unknown keys are dropped, so nothing extra can reach the board.
 */
export const esquemaVistaTablero = z.object({
  nombreJuego: z.string(),
  fase: z.enum(FASES),
  equipos: z.array(z.object({ nombre: z.string(), color: z.string(), puntaje: entero })).readonly(),
  ronda: z
    .object({
      numero: z.number().int().positive(),
      total: z.number().int().positive(),
      multiplicador: z.literal([1, 2, 3]),
      pregunta: z.string(),
      respuestas: z.array(esquemaVistaRespuesta).readonly(),
      tachas: indice,
      tachasMaximas: z.number().int().positive(),
      bolsa: entero,
      equipoControl: indice.nullable(),
      equipoRobo: indice.nullable(),
      ganadorCaraACara: indice.nullable(),
      ganadorRonda: indice.nullable(),
      puntosOtorgados: entero.nullable(),
    })
    .nullable(),
  rondaFinal: z
    .object({
      equipo: indice,
      jugadorActual: z.literal([1, 2]),
      jugadores: z.tuple([esquemaVistaJugador, esquemaVistaJugador]).readonly(),
      total: entero,
      meta: entero,
      resultado: z.object({ total: entero, meta: entero, superoMeta: z.boolean() }).nullable(),
    })
    .nullable(),
}) satisfies z.ZodType<VistaTablero>;

/** Final-round timer state, owned by the panel UI (not the engine). Seconds. */
export const esquemaTemporizador = z.object({
  restante: z.number().min(0),
  total: z.number().positive(),
  corriendo: z.boolean(),
});

export type Temporizador = z.output<typeof esquemaTemporizador>;

const v = z.literal(VERSION_PROTOCOLO);

type Version = typeof VERSION_PROTOCOLO;

export interface MensajeEstadoTablero {
  readonly v: Version;
  readonly tipo: 'ESTADO_TABLERO';
  readonly partidaId: string;
  readonly secuencia: number;
  readonly vista: VistaTablero;
  readonly temporizador: Temporizador | null;
}

export type MensajeSync =
  | MensajeEstadoTablero
  | { readonly v: Version; readonly tipo: 'SIN_PARTIDA' }
  | { readonly v: Version; readonly tipo: 'SOLICITAR_ESTADO' }
  | { readonly v: Version; readonly tipo: 'TABLERO_PRESENTE' };

export const esquemaMensajeSync = z.discriminatedUnion('tipo', [
  /** Panel -> board: the full current view. Later `secuencia` wins within one partida. */
  z.object({
    v,
    tipo: z.literal('ESTADO_TABLERO'),
    partidaId: z.string().min(1),
    secuencia: z.number().int().min(0),
    vista: esquemaVistaTablero,
    temporizador: esquemaTemporizador.nullable(),
  }),
  /** Panel -> board: no partida is being played (show the waiting screen). */
  z.object({ v, tipo: z.literal('SIN_PARTIDA') }),
  /** Board -> panel: send me the current state (board opened, reloaded or regained focus). */
  z.object({ v, tipo: z.literal('SOLICITAR_ESTADO') }),
  /** Board -> panel: heartbeat every 2 s. */
  z.object({ v, tipo: z.literal('TABLERO_PRESENTE') }),
]) satisfies z.ZodType<MensajeSync>;
