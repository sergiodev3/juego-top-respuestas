import { z } from 'zod';

import { esquemaJuego, type Juego } from './juego';
import { esquemaPartida, type Partida } from './partida';
import { esquemaPregunta, type Pregunta } from './pregunta';
import { esquemaSetPreguntas, type SetPreguntas } from './set';

/** Identifies the file as ours; `version` is bumped only for incompatible format changes. */
export const APP_RESPALDO = 'top-respuestas';
export const VERSION_RESPALDO = 1;

/** The records a backup carries. Soft-deleted rows and app bookkeeping (`meta`) are left out. */
export interface DatosRespaldo {
  sets: SetPreguntas[];
  preguntas: Pregunta[];
  juegos: Juego[];
  partidas: Partida[];
}

export interface Respaldo {
  app: typeof APP_RESPALDO;
  version: typeof VERSION_RESPALDO;
  /** Epoch milliseconds. */
  exportadoEn: number;
  datos: DatosRespaldo;
}

export const esquemaDatosRespaldo = z.object({
  sets: z.array(esquemaSetPreguntas),
  preguntas: z.array(esquemaPregunta),
  juegos: z.array(esquemaJuego),
  partidas: z.array(esquemaPartida),
}) satisfies z.ZodType<DatosRespaldo>;

export const esquemaRespaldo = z.object({
  app: z.literal(APP_RESPALDO),
  version: z.literal(VERSION_RESPALDO),
  exportadoEn: z.number().int(),
  datos: esquemaDatosRespaldo,
}) satisfies z.ZodType<Respaldo>;

export const MODOS_RESTAURACION = ['combinar', 'reemplazar'] as const;

export type ModoRestauracion = (typeof MODOS_RESTAURACION)[number];

/** Per-table outcome of a restore. `sinCambios` are records the local copy already had (or newer). */
export interface ConteoRestauracion {
  agregados: number;
  actualizados: number;
  sinCambios: number;
}

export interface ResumenRestauracion {
  modo: ModoRestauracion;
  sets: ConteoRestauracion;
  preguntas: ConteoRestauracion;
  juegos: ConteoRestauracion;
  partidas: ConteoRestauracion;
}

function hayIdsRepetidos(registros: readonly { id: string }[]): boolean {
  return new Set(registros.map((registro) => registro.id)).size !== registros.length;
}

/**
 * Cross-record checks the schemas cannot express: ids are unique per table and every question
 * belongs to a set that is in the same file (an export is always self-contained). User-facing
 * Spanish messages; an empty list means the data is consistent.
 */
export function erroresDeIntegridad(datos: DatosRespaldo): string[] {
  const errores: string[] = [];
  const tablas = [
    ['sets', datos.sets],
    ['preguntas', datos.preguntas],
    ['juegos', datos.juegos],
    ['partidas', datos.partidas],
  ] as const;
  for (const [nombre, registros] of tablas) {
    if (hayIdsRepetidos(registros)) {
      errores.push(`El respaldo repite registros en «${nombre}».`);
    }
  }
  const idsSets = new Set(datos.sets.map((set) => set.id));
  const huerfanas = datos.preguntas.filter((pregunta) => !idsSets.has(pregunta.setId)).length;
  if (huerfanas > 0) {
    errores.push(
      huerfanas === 1
        ? 'Hay 1 pregunta que pertenece a un set que no está en el respaldo.'
        : `Hay ${String(huerfanas)} preguntas que pertenecen a un set que no está en el respaldo.`,
    );
  }
  return errores;
}
