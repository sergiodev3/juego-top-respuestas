import { Dexie, type DexieOptions, type EntityTable, type Table } from 'dexie';

import type { Juego, Partida, Pregunta, SetPreguntas } from '@/shared/modelo';

/** Small key-value store for app bookkeeping (e.g. whether the seed was applied). */
export interface EntradaMeta {
  clave: string;
  valor: unknown;
}

export const NOMBRE_BASE_DATOS = 'top-respuestas';

/** Version 1 shipped `partidas` as a placeholder without a config snapshot or event log. */
interface PartidaVersion1 {
  config?: unknown;
  eventos?: unknown;
  estado: string;
}

/**
 * IndexedDB database. Every schema change is a new `this.version(n)` block; never edit a
 * shipped version. Only list indexed fields in `stores` (other fields are stored anyway).
 * IndexedDB cannot index `null`, so soft-deleted rows (`eliminadoEn !== null`) are
 * filtered in code, not through an index.
 */
export class BaseDatosTopRespuestas extends Dexie {
  declare sets: EntityTable<SetPreguntas, 'id'>;
  declare preguntas: EntityTable<Pregunta, 'id'>;
  declare juegos: EntityTable<Juego, 'id'>;
  declare partidas: EntityTable<Partida, 'id'>;
  declare meta: Table<EntradaMeta, string>;

  constructor(nombre: string = NOMBRE_BASE_DATOS, opciones?: DexieOptions) {
    super(nombre, opciones);

    this.version(1).stores({
      sets: 'id, nombre, actualizadoEn',
      preguntas: 'id, setId, tema, actualizadoEn',
      juegos: 'id, actualizadoEn',
      partidas: 'id, juegoId, estado, actualizadoEn',
      meta: 'clave',
    });

    // Fase 4: partidas hold a config snapshot and an event log. Indexes are unchanged; the
    // upgrade gives placeholder rows an empty log and ends those without a snapshot, so they
    // never show up as "Continuar partida".
    this.version(2)
      .stores({ partidas: 'id, juegoId, estado, actualizadoEn' })
      .upgrade((tx) =>
        tx
          .table<PartidaVersion1>('partidas')
          .toCollection()
          .modify((partida) => {
            if (!Array.isArray(partida.eventos)) {
              partida.eventos = [];
            }
            if (partida.config === undefined) {
              partida.estado = 'terminada';
            }
          }),
      );

    // Next schema change goes here as `this.version(3)`, keeping versions 1 and 2 untouched.
  }
}
