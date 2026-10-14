import { z } from 'zod';

import { esquemaConfigPartida, esquemaEvento, type ConfigPartida, type Evento } from '@/engine';

export const ESTADOS_PARTIDA = ['enCurso', 'terminada'] as const;

export type EstadoPartida = (typeof ESTADOS_PARTIDA)[number];

/**
 * A played (or playing) match: an immutable `ConfigPartida` snapshot taken at start time plus
 * the append-only event log. The game state is never stored; it is rebuilt with `reconstruir`.
 */
export interface Partida {
  id: string;
  juegoId: string;
  config: ConfigPartida;
  eventos: Evento[];
  estado: EstadoPartida;
  /** Epoch milliseconds. */
  creadoEn: number;
  actualizadoEn: number;
  /** Soft delete tombstone. */
  eliminadoEn: number | null;
}

/** Shape of a stored partida. Game rules are checked separately (`validarConfig`, `validar`). */
export const esquemaPartida = z.object({
  id: z.string().min(1),
  juegoId: z.string().min(1),
  config: esquemaConfigPartida,
  eventos: z.array(esquemaEvento),
  estado: z.enum(ESTADOS_PARTIDA),
  creadoEn: z.number().int(),
  actualizadoEn: z.number().int(),
  eliminadoEn: z.number().int().nullable(),
}) satisfies z.ZodType<Partida>;
