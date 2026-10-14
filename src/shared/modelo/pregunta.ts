import { z } from 'zod';

import { esquemaListaRespuestas, esquemaRespuesta, MAX_RESPUESTAS } from './respuesta';

export const MAX_TEXTO_PREGUNTA = 200;
export const MAX_TEMA = 60;

/** Editable fields of a question (no id, set or timestamps). Normalizes on parse. */
export const esquemaDatosPregunta = z.object({
  texto: z
    .string({ error: 'Escribe el texto de la pregunta.' })
    .trim()
    .min(1, { error: 'Escribe el texto de la pregunta.' })
    .max(MAX_TEXTO_PREGUNTA, {
      error: `La pregunta no puede tener más de ${String(MAX_TEXTO_PREGUNTA)} caracteres.`,
    }),
  tema: z
    .string({ error: 'El tema debe ser texto.' })
    .trim()
    .max(MAX_TEMA, { error: `El tema no puede tener más de ${String(MAX_TEMA)} caracteres.` })
    .default(''),
  respuestas: esquemaListaRespuestas,
});

/** Normalized question data, ready to store. */
export type DatosPregunta = z.output<typeof esquemaDatosPregunta>;

/** Stored question record. Timestamps are epoch milliseconds; `eliminadoEn` marks a soft delete. */
export const esquemaPregunta = z.object({
  id: z.string().min(1),
  setId: z.string().min(1),
  tema: z.string(),
  texto: z.string().min(1),
  respuestas: z.array(esquemaRespuesta).min(1).max(MAX_RESPUESTAS),
  creadoEn: z.number().int(),
  actualizadoEn: z.number().int(),
  eliminadoEn: z.number().int().nullable(),
});

export type Pregunta = z.output<typeof esquemaPregunta>;
