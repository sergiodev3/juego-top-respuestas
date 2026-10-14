import { z } from 'zod';

export const MAX_NOMBRE_SET = 80;
export const MAX_MATERIA = 60;
export const MAX_GRUPO = 40;

/** Editable fields of a question set (no id or timestamps). Normalizes on parse. */
export const esquemaDatosSet = z.object({
  nombre: z
    .string({ error: 'Escribe el nombre del set.' })
    .trim()
    .min(1, { error: 'Escribe el nombre del set.' })
    .max(MAX_NOMBRE_SET, {
      error: `El nombre no puede tener más de ${String(MAX_NOMBRE_SET)} caracteres.`,
    }),
  materia: z
    .string({ error: 'La materia debe ser texto.' })
    .trim()
    .max(MAX_MATERIA, {
      error: `La materia no puede tener más de ${String(MAX_MATERIA)} caracteres.`,
    })
    .default(''),
  grupo: z
    .string({ error: 'El grupo debe ser texto.' })
    .trim()
    .max(MAX_GRUPO, { error: `El grupo no puede tener más de ${String(MAX_GRUPO)} caracteres.` })
    .default(''),
});

export type DatosSet = z.output<typeof esquemaDatosSet>;

/** Stored question set record. Timestamps are epoch milliseconds; `eliminadoEn` marks a soft delete. */
export const esquemaSetPreguntas = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  materia: z.string(),
  grupo: z.string(),
  creadoEn: z.number().int(),
  actualizadoEn: z.number().int(),
  eliminadoEn: z.number().int().nullable(),
});

export type SetPreguntas = z.output<typeof esquemaSetPreguntas>;

const SUFIJO_COPIA = ' (copia)';

/** Name for a duplicated set, kept within the maximum name length. */
export function nombreDeCopia(nombre: string): string {
  return `${nombre.slice(0, MAX_NOMBRE_SET - SUFIJO_COPIA.length).trimEnd()}${SUFIJO_COPIA}`;
}
