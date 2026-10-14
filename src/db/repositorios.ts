import type { ConfigPartida, Evento } from '@/engine';
import type {
  DatosJuego,
  DatosPregunta,
  DatosSet,
  Juego,
  Partida,
  Pregunta,
  SetPreguntas,
} from '@/shared/modelo';

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

export interface RepositorioJuegos {
  /** Non-deleted games, most recently updated first. */
  listar(): Promise<Juego[]>;
  obtener(id: string): Promise<Juego | undefined>;
  crear(datos: DatosJuego): Promise<Juego>;
}

export interface DatosNuevaPartida {
  juegoId: string;
  /** Snapshot built with `crearConfigPartida`; validated again before it is stored. */
  config: ConfigPartida;
}

/**
 * Matches (config snapshot + event log). Every write is one Dexie transaction, so the log on
 * disk always matches what the caller gets back. Writes to a missing or deleted partida reject
 * with `ErrorRegistroNoEncontrado`; writes to an ended one reject with `ErrorPartidaTerminada`.
 */
export interface RepositorioPartidas {
  /**
   * Starts a partida with an empty log. Any other in-progress partida is marked `terminada` in
   * the same transaction (the UI asks for confirmation first). Rejects with Spanish messages when
   * the config is invalid.
   */
  crear(datos: DatosNuevaPartida): Promise<Partida>;
  obtener(id: string): Promise<Partida | undefined>;
  /** The in-progress partida (most recently updated, if several), or `undefined`. */
  obtenerEnCurso(): Promise<Partida | undefined>;
  /** Appends a shape-valid event (rules are the caller's job) and returns the new log. */
  agregarEvento(id: string, evento: Evento): Promise<Evento[]>;
  /** Removes the last event (no-op on an empty log) and returns the new log. */
  deshacer(id: string): Promise<Evento[]>;
  /** Marks the partida `terminada`; ending an ended partida is a no-op. */
  terminar(id: string): Promise<void>;
}

/** Where imported questions go: a set created on the fly or an existing one. */
export type DestinoImportacion =
  { tipo: 'nuevo'; datos: DatosSet } | { tipo: 'existente'; setId: string };

export interface ResultadoImportacion {
  set: SetPreguntas;
  /** Created questions, in the same order they were given. */
  preguntas: Pregunta[];
}

export interface ResultadoImportarYJugar extends ResultadoImportacion {
  juego: Juego;
}

/** Bulk writes for the importer; each call is a single all-or-nothing transaction. */
export interface ServicioImportacion {
  /** Creates the set when it is new and inserts every question, keeping their order. */
  importarPreguntas(
    destino: DestinoImportacion,
    preguntas: readonly DatosPregunta[],
  ): Promise<ResultadoImportacion>;
  /** Imports into a new set and creates a default game with its first questions as rounds. */
  importarYJugar(
    datosSet: DatosSet,
    preguntas: readonly DatosPregunta[],
  ): Promise<ResultadoImportarYJugar>;
}

export interface Repositorios {
  sets: RepositorioSets;
  preguntas: RepositorioPreguntas;
  juegos: RepositorioJuegos;
  partidas: RepositorioPartidas;
  importacion: ServicioImportacion;
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

type EntidadRegistro = 'set' | 'pregunta' | 'partida';

const MENSAJES_NO_ENCONTRADO: Record<EntidadRegistro, string> = {
  set: 'No se encontró el set solicitado.',
  pregunta: 'No se encontró la pregunta solicitada.',
  partida: 'No se encontró la partida solicitada.',
};

export class ErrorRegistroNoEncontrado extends Error {
  readonly entidad: EntidadRegistro;
  readonly id: string;

  constructor(entidad: EntidadRegistro, id: string) {
    super(MENSAJES_NO_ENCONTRADO[entidad]);
    this.name = 'ErrorRegistroNoEncontrado';
    this.entidad = entidad;
    this.id = id;
  }
}

/** A write to a partida that already ended. */
export class ErrorPartidaTerminada extends Error {
  readonly id: string;

  constructor(id: string) {
    super('La partida ya terminó.');
    this.name = 'ErrorPartidaTerminada';
    this.id = id;
  }
}

/** A partida config that fails `esquemaConfigPartida` or `validarConfig`. */
export class ErrorConfigPartida extends Error {
  readonly errores: readonly string[];

  constructor(errores: readonly string[]) {
    super(errores.join(' '));
    this.name = 'ErrorConfigPartida';
    this.errores = errores;
  }
}
