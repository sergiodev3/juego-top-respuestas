import type { DatosPregunta, DatosSet, Pregunta, SetPreguntas } from '@/shared/modelo';

/**
 * Persistence ports. Features depend on these interfaces only, so the Dexie
 * implementation can later be swapped or wrapped (e.g. Express + PostgreSQL sync).
 *
 * Reads never return soft-deleted records. Writes validate and normalize their input
 * with the domain schemas and reject with a `ZodError` when it is invalid.
 */
export interface RepositorioSets {
  /** Non-deleted sets sorted by name. */
  listar(): Promise<SetPreguntas[]>;
  /** Sets whose name, materia or grupo contain `texto` (case and accent insensitive). */
  buscar(texto: string): Promise<SetPreguntas[]>;
  obtener(id: string): Promise<SetPreguntas | undefined>;
  crear(datos: DatosSet): Promise<SetPreguntas>;
  actualizar(id: string, datos: DatosSet): Promise<SetPreguntas>;
  /** Soft-deletes the set and all of its questions. */
  eliminar(id: string): Promise<void>;
  /** Deep copy (set + non-deleted questions) with new ids and a " (copia)" name. */
  duplicar(id: string): Promise<SetPreguntas>;
}

export interface CriteriosBusquedaPreguntas {
  setId?: string;
  /** Matched against the question text, case and accent insensitive. */
  texto?: string;
  /** Exact topic. */
  tema?: string;
}

export interface RepositorioPreguntas {
  /** Non-deleted questions of a set in creation order. */
  listarPorSet(setId: string): Promise<Pregunta[]>;
  buscar(criterios: CriteriosBusquedaPreguntas): Promise<Pregunta[]>;
  /** Distinct non-empty topics of a set, sorted. */
  listarTemas(setId: string): Promise<string[]>;
  /** Number of non-deleted questions per set id (sets without questions are omitted). */
  contarPorSet(): Promise<Record<string, number>>;
  obtener(id: string): Promise<Pregunta | undefined>;
  crear(setId: string, datos: DatosPregunta): Promise<Pregunta>;
  actualizar(id: string, datos: DatosPregunta): Promise<Pregunta>;
  eliminar(id: string): Promise<void>;
  /** Copy in the same set with a new id. */
  duplicar(id: string): Promise<Pregunta>;
}

export interface Repositorios {
  sets: RepositorioSets;
  preguntas: RepositorioPreguntas;
}

/** Injected so implementations stay deterministic under test. */
export interface DependenciasRepositorio {
  /** Current time in epoch milliseconds. */
  ahora: () => number;
  generarId: () => string;
}

export const dependenciasPredeterminadas: DependenciasRepositorio = {
  ahora: () => Date.now(),
  generarId: () => crypto.randomUUID(),
};

export class ErrorRegistroNoEncontrado extends Error {
  readonly entidad: 'set' | 'pregunta';
  readonly id: string;

  constructor(entidad: 'set' | 'pregunta', id: string) {
    super(
      entidad === 'set'
        ? 'No se encontró el set solicitado.'
        : 'No se encontró la pregunta solicitada.',
    );
    this.name = 'ErrorRegistroNoEncontrado';
    this.entidad = entidad;
    this.id = id;
  }
}
