import { reconstruir, type ResultadoReconstruccion } from '@/engine';
import type { Partida } from '@/shared/modelo';

/**
 * Rebuilds a stored partida (or reports why it cannot be) without ever throwing. Accepts
 * `undefined` so a missing record from `obtener` maps to the same friendly error path. On
 * success, use the returned `config` for every later engine call and surface `advertencias`
 * (skipped events) discreetly.
 */
export function cargarPartida(
  partida: Pick<Partida, 'config' | 'eventos'> | undefined,
): ResultadoReconstruccion {
  if (partida === undefined) {
    return { ok: false, errores: ['No se encontró la partida solicitada.'] };
  }
  return reconstruir(partida.config, partida.eventos);
}
