import { esquemaEvento, reconstruir, type Evento } from '@/engine';
import type { Partida } from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import {
  ErrorConfigPartida,
  ErrorPartidaTerminada,
  ErrorRegistroNoEncontrado,
  type DependenciasRepositorio,
  type RepositorioPartidas,
} from './repositorios';

function estaVigente(registro: { eliminadoEn: number | null }): boolean {
  return registro.eliminadoEn === null;
}

export function crearRepositorioPartidas(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): RepositorioPartidas {
  /** Must run inside a transaction on `partidas`. */
  async function obtenerEnCursoVigente(id: string): Promise<Partida> {
    const partida = await db.partidas.get(id);
    if (!partida || !estaVigente(partida)) {
      throw new ErrorRegistroNoEncontrado('partida', id);
    }
    if (partida.estado !== 'enCurso') {
      throw new ErrorPartidaTerminada(id);
    }
    return partida;
  }

  /** Read-modify-write of the log in one transaction, so the stored log is never torn. */
  function reescribirEventos(
    id: string,
    cambiar: (eventos: readonly Evento[]) => Evento[],
  ): Promise<Evento[]> {
    return db.transaction('rw', db.partidas, async () => {
      const partida = await obtenerEnCursoVigente(id);
      const eventos = cambiar(partida.eventos);
      await db.partidas.update(id, { eventos, actualizadoEn: ahora() });
      return eventos;
    });
  }

  return {
    async crear({ juegoId, config }) {
      // Same checks as loading, so a stored partida always rebuilds.
      const revisada = reconstruir(config, []);
      if (!revisada.ok) {
        throw new ErrorConfigPartida(revisada.errores);
      }
      return db.transaction('rw', db.partidas, async () => {
        const momento = ahora();
        await db.partidas
          .where('estado')
          .equals('enCurso')
          .modify({ estado: 'terminada', actualizadoEn: momento });
        const partida: Partida = {
          id: generarId(),
          juegoId,
          config: revisada.config,
          eventos: [],
          estado: 'enCurso',
          creadoEn: momento,
          actualizadoEn: momento,
          eliminadoEn: null,
        };
        await db.partidas.add(partida);
        return partida;
      });
    },

    async obtener(id) {
      const partida = await db.partidas.get(id);
      return partida && estaVigente(partida) ? partida : undefined;
    },

    async obtenerEnCurso() {
      const enCurso = await db.partidas.where('estado').equals('enCurso').toArray();
      return enCurso
        .filter(estaVigente)
        .toSorted((a, b) => b.actualizadoEn - a.actualizadoEn || (a.id < b.id ? -1 : 1))[0];
    },

    async agregarEvento(id, evento) {
      const leido = esquemaEvento.safeParse(evento);
      if (!leido.success) {
        throw new Error('El evento no es válido.');
      }
      return reescribirEventos(id, (eventos) => [...eventos, leido.data]);
    },

    async deshacer(id) {
      return reescribirEventos(id, (eventos) => eventos.slice(0, -1));
    },

    async terminar(id) {
      await db.transaction('rw', db.partidas, async () => {
        const partida = await db.partidas.get(id);
        if (!partida || !estaVigente(partida)) {
          throw new ErrorRegistroNoEncontrado('partida', id);
        }
        if (partida.estado === 'terminada') {
          return;
        }
        await db.partidas.update(id, { estado: 'terminada', actualizadoEn: ahora() });
      });
    },
  };
}
