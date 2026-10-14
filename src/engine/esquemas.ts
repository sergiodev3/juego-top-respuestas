/**
 * Zod schemas for what the engine reads back from storage: the config snapshot and the stored
 * events. They check shapes only; game rules stay in `validarConfig` and the rule modules.
 */
import { z } from 'zod';

import { MAX_EQUIPOS, PREGUNTAS_RONDA_FINAL } from './estadoInicial';
import type { ConfigPartida, Evento } from './tipos';

const esquemaRespuesta = z.object({
  texto: z.string(),
  puntos: z.number(),
  sinonimos: z.array(z.string()),
});

const esquemaPregunta = z.object({
  id: z.string(),
  tema: z.string(),
  texto: z.string(),
  respuestas: z.array(esquemaRespuesta),
});

/**
 * Shape of a stored `ConfigPartida`. Counts, sorting and the strike limit are checked afterwards
 * by `validarConfig`. Unknown keys are dropped.
 */
export const esquemaConfigPartida = z.object({
  nombre: z.string(),
  equipos: z.array(z.object({ id: z.string(), nombre: z.string(), color: z.string() })),
  rondas: z.array(z.object({ pregunta: esquemaPregunta, multiplicador: z.literal([1, 2, 3]) })),
  tachasMaximas: z.number(),
  rondaFinal: z
    .object({
      preguntas: z.array(esquemaPregunta),
      segundos: z.tuple([z.number().int().positive(), z.number().int().positive()]),
      meta: z.number().int().min(0),
    })
    .nullable(),
}) satisfies z.ZodType<ConfigPartida>;

/** Static ranges only: the real team and answer counts are checked by the rules. */
const indiceEquipo = z
  .number()
  .int()
  .min(0)
  .max(MAX_EQUIPOS - 1);
const indiceRespuesta = z.number().int().min(0);
const jugador = z.literal([1, 2]);
const preguntaRondaFinal = z
  .number()
  .int()
  .min(0)
  .max(PREGUNTAS_RONDA_FINAL - 1);
/** Same check as the rule (`Number.isInteger`), so every delta the panel can store replays. */
const delta = z.number().refine((valor) => Number.isInteger(valor) && valor !== 0);

/**
 * Shape of a stored event, one variant per `Evento`. Unknown keys are dropped. Every event that
 * `validar` accepts passes this schema, so a log written by the panel always replays in full.
 */
export const esquemaEvento = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ASIGNAR_TURNO'), equipo: indiceEquipo }),
  z.object({ tipo: z.literal('REVELAR'), indice: indiceRespuesta }),
  z.object({ tipo: z.literal('TACHE') }),
  z.object({ tipo: z.literal('JUGAR') }),
  z.object({ tipo: z.literal('PASAR'), equipo: indiceEquipo.optional() }),
  z.object({ tipo: z.literal('ROBO_EXITOSO'), indice: indiceRespuesta }),
  z.object({ tipo: z.literal('ROBO_FALLIDO') }),
  z.object({ tipo: z.literal('REVELAR_TODAS') }),
  z.object({ tipo: z.literal('SIGUIENTE_RONDA') }),
  z.object({ tipo: z.literal('AJUSTAR_PUNTOS'), equipo: indiceEquipo, delta }),
  z.object({ tipo: z.literal('TERMINAR_JUEGO') }),
  z.object({
    tipo: z.literal('RF_RESPUESTA'),
    jugador,
    pregunta: preguntaRondaFinal,
    indice: indiceRespuesta.nullable(),
    texto: z.string(),
  }),
  z.object({ tipo: z.literal('RF_REVELAR'), jugador, pregunta: preguntaRondaFinal }),
  z.object({ tipo: z.literal('RF_SIGUIENTE_JUGADOR') }),
  z.object({ tipo: z.literal('RF_TERMINAR') }),
]) satisfies z.ZodType<Evento>;
