import { Dexie, type DexieOptions, type EntityTable, type Table } from 'dexie';

import type { Juego, Pregunta, SetPreguntas } from '@/shared/modelo';

/** Stored match (config snapshot + event log). Full shape arrives in Fase 4. */
export interface PartidaGuardada {
  id: string;
  juegoId: string;
  estado: 'enCurso' | 'terminada';
  creadoEn: number;
  actualizadoEn: number;
  eliminadoEn: number | null;
}

/** Small key-value store for app bookkeeping (e.g. whether the seed was applied). */
export interface EntradaMeta {
  clave: string;
  valor: unknown;
}

export const NOMBRE_BASE_DATOS = 'top-respuestas';

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
  declare partidas: EntityTable<PartidaGuardada, 'id'>;
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

    // Next schema change goes here, keeping version 1 untouched. Example:
    // this.version(2)
    //   .stores({ preguntas: 'id, setId, tema, actualizadoEn, dificultad' })
    //   .upgrade((tx) =>
    //     tx.table('preguntas').toCollection().modify((p) => { p.dificultad ??= 'media'; }),
    //   );
  }
}
