import { z } from 'zod';

export const MAX_RESPUESTAS = 8;
export const MAX_TEXTO_RESPUESTA = 80;

/** Trims every synonym and drops the blank ones. */
const esquemaSinonimos = z
  .array(z.string({ error: 'Cada sinónimo debe ser texto.' }))
  .default([])
  .transform((sinonimos) => sinonimos.map((s) => s.trim()).filter((s) => s !== ''));

export const esquemaRespuesta = z.object({
  texto: z
    .string({ error: 'Escribe el texto de la respuesta.' })
    .trim()
    .min(1, { error: 'Escribe el texto de la respuesta.' })
    .max(MAX_TEXTO_RESPUESTA, {
      error: `La respuesta no puede tener más de ${String(MAX_TEXTO_RESPUESTA)} caracteres.`,
    }),
  puntos: z
    .number({ error: 'Escribe los puntos de la respuesta.' })
    .int({ error: 'Los puntos deben ser un número entero.' })
    .min(0, { error: 'Los puntos no pueden ser negativos.' }),
  sinonimos: esquemaSinonimos,
});

export type Respuesta = z.output<typeof esquemaRespuesta>;

/** Returns a copy sorted by points (highest first); ties keep their original order. */
export function ordenarRespuestas<T extends { puntos: number }>(respuestas: readonly T[]): T[] {
  // Array.prototype.toSorted is stable, so ties keep their relative order.
  return respuestas.toSorted((a, b) => b.puntos - a.puntos);
}

function esTextoEnBlanco(valor: unknown): boolean {
  return (
    valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')
  );
}

/**
 * True when an answer row was left completely blank (no text, no points, no synonyms).
 * Such rows are dropped before validation instead of being reported as errors.
 */
export function esRespuestaVacia(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const texto: unknown = 'texto' in valor ? valor.texto : undefined;
  const puntos: unknown = 'puntos' in valor ? valor.puntos : undefined;
  const sinonimos: unknown = 'sinonimos' in valor ? valor.sinonimos : undefined;

  const sinPuntos =
    puntos === undefined || puntos === null || (typeof puntos === 'number' && Number.isNaN(puntos));
  const sinSinonimos =
    sinonimos === undefined || (Array.isArray(sinonimos) && sinonimos.every(esTextoEnBlanco));

  return esTextoEnBlanco(texto) && sinPuntos && sinSinonimos;
}

/** Answer list of a question: drops blank rows, validates 1-8 answers, sorts by points. */
export const esquemaListaRespuestas = z.preprocess(
  (valor) => (Array.isArray(valor) ? valor.filter((r) => !esRespuestaVacia(r)) : valor),
  z
    .array(esquemaRespuesta, { error: 'Las respuestas deben ser una lista.' })
    .min(1, { error: 'Agrega al menos una respuesta.' })
    .max(MAX_RESPUESTAS, {
      error: `Una pregunta puede tener como máximo ${String(MAX_RESPUESTAS)} respuestas.`,
    })
    .transform((respuestas) => ordenarRespuestas(respuestas)),
);
