import { z } from 'zod';

export const MIN_EQUIPOS = 2;
export const MAX_EQUIPOS = 4;
export const MAX_NOMBRE_JUEGO = 80;
export const MAX_NOMBRE_EQUIPO = 30;
export const TACHAS_MAXIMAS_PREDETERMINADAS = 3;
export const SEGUNDOS_RONDA_FINAL_PREDETERMINADOS: [number, number] = [20, 25];
export const META_RONDA_FINAL_PREDETERMINADA = 200;
export const MAX_RONDAS_PREDETERMINADAS = 4;

/**
 * Team colors, all dark enough for white text (WCAG AA) and distinct from each other.
 * Order matches the default team order (A, B, C, D).
 */
export const COLORES_EQUIPOS = ['#1d4ed8', '#b91c1c', '#047857', '#7e22ce'] as const;

export const esquemaEquipo = z.object({
  id: z.string().min(1),
  nombre: z
    .string({ error: 'Escribe el nombre del equipo.' })
    .trim()
    .min(1, { error: 'Escribe el nombre del equipo.' })
    .max(MAX_NOMBRE_EQUIPO, {
      error: `El nombre del equipo no puede tener más de ${String(MAX_NOMBRE_EQUIPO)} caracteres.`,
    }),
  color: z.string().regex(/^#[0-9a-f]{6}$/iu, { error: 'El color debe tener el formato #RRGGBB.' }),
});

export type Equipo = z.output<typeof esquemaEquipo>;

export const esquemaMultiplicador = z.union([z.literal(1), z.literal(2), z.literal(3)], {
  error: 'El multiplicador debe ser x1, x2 o x3.',
});

export type Multiplicador = z.output<typeof esquemaMultiplicador>;

export const esquemaRonda = z.object({
  preguntaId: z.string().min(1),
  multiplicador: esquemaMultiplicador,
});

export type Ronda = z.output<typeof esquemaRonda>;

export const esquemaReglas = z.object({
  tachasMaximas: z.number().int().min(1),
  rondaFinal: z.object({
    activa: z.boolean(),
    preguntaIds: z.array(z.string().min(1)),
    /** Timer seconds for the first and second player. */
    segundos: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    /** Points the pair must reach to win the final round. */
    meta: z.number().int().positive(),
  }),
});

export type Reglas = z.output<typeof esquemaReglas>;

/** Editable fields of a saved game configuration (no id or timestamps). */
export const esquemaDatosJuego = z.object({
  nombre: z
    .string({ error: 'Escribe el nombre del juego.' })
    .trim()
    .min(1, { error: 'Escribe el nombre del juego.' })
    .max(MAX_NOMBRE_JUEGO, {
      error: `El nombre del juego no puede tener más de ${String(MAX_NOMBRE_JUEGO)} caracteres.`,
    }),
  equipos: z
    .array(esquemaEquipo)
    .min(MIN_EQUIPOS, { error: `Agrega al menos ${String(MIN_EQUIPOS)} equipos.` })
    .max(MAX_EQUIPOS, { error: `Puede haber como máximo ${String(MAX_EQUIPOS)} equipos.` }),
  reglas: esquemaReglas,
  rondas: z.array(esquemaRonda),
});

export type DatosJuego = z.output<typeof esquemaDatosJuego>;

/** Stored game configuration. Timestamps are epoch milliseconds; `eliminadoEn` marks a soft delete. */
export const esquemaJuego = esquemaDatosJuego.extend({
  id: z.string().min(1),
  creadoEn: z.number().int(),
  actualizadoEn: z.number().int(),
  eliminadoEn: z.number().int().nullable(),
});

export type Juego = z.output<typeof esquemaJuego>;

/** x1 for every round, except a 4-round game, which ends with x2 and x3. */
function multiplicadorPredeterminado(indice: number, totalRondas: number): Multiplicador {
  if (totalRondas === MAX_RONDAS_PREDETERMINADAS) {
    if (indice === 2) {
      return 2;
    }
    if (indice === 3) {
      return 3;
    }
  }
  return 1;
}

/**
 * Sensible defaults so a game can start right away: "Equipo A" vs "Equipo B", 3 strikes,
 * the first 4 questions as rounds (in the given order) and the final round turned off.
 * Pure: team ids are positional (`equipo-1`, `equipo-2`).
 */
export function crearJuegoPorDefecto({
  nombre,
  preguntaIds,
}: {
  nombre: string;
  preguntaIds: readonly string[];
}): DatosJuego {
  const ids = preguntaIds.slice(0, MAX_RONDAS_PREDETERMINADAS);
  return {
    nombre: nombre.trim().slice(0, MAX_NOMBRE_JUEGO).trimEnd(),
    equipos: [
      { id: 'equipo-1', nombre: 'Equipo A', color: COLORES_EQUIPOS[0] },
      { id: 'equipo-2', nombre: 'Equipo B', color: COLORES_EQUIPOS[1] },
    ],
    reglas: {
      tachasMaximas: TACHAS_MAXIMAS_PREDETERMINADAS,
      rondaFinal: {
        activa: false,
        preguntaIds: [],
        segundos: [...SEGUNDOS_RONDA_FINAL_PREDETERMINADOS],
        meta: META_RONDA_FINAL_PREDETERMINADA,
      },
    },
    rondas: ids.map((preguntaId, indice) => ({
      preguntaId,
      multiplicador: multiplicadorPredeterminado(indice, ids.length),
    })),
  };
}
