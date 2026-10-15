import { useLiveQuery } from 'dexie-react-hooks';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { Pregunta } from '@/shared/modelo';

import {
  crearMarcador,
  crearTarjetas,
  type FuenteImpresion,
  type Marcador,
  type Tarjeta,
} from './dominio';

export type DatosImpresion =
  /** `marcador` is the optional paper scoreboard of the same source. */
  | { estado: 'listo'; titulo: string; tarjetas: Tarjeta[]; marcador: Marcador }
  /** The source is unknown, deleted or empty: `mensaje` explains it above the picker. */
  | { estado: 'noDisponible'; mensaje: string };

/**
 * Loads the cards of a set or a saved game; `undefined` while loading. Live: edits in the bank
 * show up in the preview. Only repository calls are awaited, so `liveQuery` keeps tracking them.
 */
export function useTarjetasImpresion(fuente: FuenteImpresion): DatosImpresion | undefined {
  const repositorios = useRepositorios();
  return useLiveQuery(async (): Promise<DatosImpresion> => {
    if (fuente.tipo === 'set') {
      const set = await repositorios.sets.obtener(fuente.id);
      if (set === undefined) {
        return {
          estado: 'noDisponible',
          mensaje: 'No encontramos ese set. Puede que se haya eliminado; elige otro.',
        };
      }
      const preguntas = await repositorios.preguntas.listarPorSet(set.id);
      if (preguntas.length === 0) {
        return { estado: 'noDisponible', mensaje: 'Este set no tiene preguntas; elige otro.' };
      }
      return {
        estado: 'listo',
        titulo: `Set: ${set.nombre}`,
        tarjetas: crearTarjetas({ tipo: 'set', preguntas }),
        marcador: crearMarcador({ tipo: 'set', nombre: set.nombre }),
      };
    }

    const juego = await repositorios.juegos.obtener(fuente.id);
    if (juego === undefined) {
      return {
        estado: 'noDisponible',
        mensaje: 'No encontramos ese juego. Puede que se haya eliminado; elige otro.',
      };
    }
    const ids = new Set([
      ...juego.rondas.map((ronda) => ronda.preguntaId),
      ...(juego.reglas.rondaFinal.activa ? juego.reglas.rondaFinal.preguntaIds : []),
    ]);
    const preguntasPorId = new Map<string, Pregunta>();
    for (const id of ids) {
      // `obtener` hides deleted questions, so they become notice cards.
      const pregunta = await repositorios.preguntas.obtener(id);
      if (pregunta !== undefined) {
        preguntasPorId.set(id, pregunta);
      }
    }
    const tarjetas = crearTarjetas({ tipo: 'juego', juego, preguntasPorId });
    if (tarjetas.length === 0) {
      return { estado: 'noDisponible', mensaje: 'Este juego no tiene rondas; elige otro.' };
    }
    return {
      estado: 'listo',
      titulo: `Juego: ${juego.nombre}`,
      tarjetas,
      marcador: crearMarcador({ tipo: 'juego', juego }),
    };
  }, [repositorios, fuente.tipo, fuente.id]);
}
