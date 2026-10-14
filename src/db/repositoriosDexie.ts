import {
  esquemaDatosPregunta,
  esquemaDatosSet,
  nombreDeCopia,
  type DatosPregunta,
  type DatosSet,
  type Pregunta,
  type SetPreguntas,
} from '@/shared/modelo';
import { contieneTexto } from '@/shared/utils/normalizarTexto';

import type { BaseDatosTopRespuestas } from './baseDatos';
import {
  dependenciasPredeterminadas,
  ErrorRegistroNoEncontrado,
  type CriteriosBusquedaPreguntas,
  type DependenciasRepositorio,
  type RepositorioPreguntas,
  type Repositorios,
  type RepositorioSets,
} from './repositorios';

const compararTexto = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

function estaVigente(registro: { eliminadoEn: number | null }): boolean {
  return registro.eliminadoEn === null;
}

function ordenarPorNombre(sets: SetPreguntas[]): SetPreguntas[] {
  return sets.toSorted((a, b) => compararTexto(a.nombre, b.nombre));
}

function ordenarPorCreacion(preguntas: Pregunta[]): Pregunta[] {
  return preguntas.toSorted((a, b) => a.creadoEn - b.creadoEn || (a.id < b.id ? -1 : 1));
}

function crearRepositorioSets(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): RepositorioSets {
  async function obtenerVigente(id: string): Promise<SetPreguntas> {
    const set = await db.sets.get(id);
    if (!set || !estaVigente(set)) {
      throw new ErrorRegistroNoEncontrado('set', id);
    }
    return set;
  }

  async function listar(): Promise<SetPreguntas[]> {
    const sets = await db.sets.toArray();
    return ordenarPorNombre(sets.filter(estaVigente));
  }

  return {
    listar,

    async buscar(texto) {
      const sets = await listar();
      return sets.filter((set) =>
        [set.nombre, set.materia, set.grupo].some((campo) => contieneTexto(campo, texto)),
      );
    },

    async obtener(id) {
      const set = await db.sets.get(id);
      return set && estaVigente(set) ? set : undefined;
    },

    async crear(datos: DatosSet) {
      const validos = esquemaDatosSet.parse(datos);
      const momento = ahora();
      const set: SetPreguntas = {
        id: generarId(),
        ...validos,
        creadoEn: momento,
        actualizadoEn: momento,
        eliminadoEn: null,
      };
      await db.sets.add(set);
      return set;
    },

    async actualizar(id, datos) {
      const validos = esquemaDatosSet.parse(datos);
      return db.transaction('rw', db.sets, async () => {
        const actual = await obtenerVigente(id);
        const actualizado: SetPreguntas = { ...actual, ...validos, actualizadoEn: ahora() };
        await db.sets.put(actualizado);
        return actualizado;
      });
    },

    async eliminar(id) {
      await db.transaction('rw', db.sets, db.preguntas, async () => {
        await obtenerVigente(id);
        const momento = ahora();
        await db.sets.update(id, { eliminadoEn: momento, actualizadoEn: momento });
        await db.preguntas
          .where('setId')
          .equals(id)
          .filter(estaVigente)
          .modify({ eliminadoEn: momento, actualizadoEn: momento });
      });
    },

    async duplicar(id) {
      return db.transaction('rw', db.sets, db.preguntas, async () => {
        const original = await obtenerVigente(id);
        const momento = ahora();
        const copia: SetPreguntas = {
          ...original,
          id: generarId(),
          nombre: nombreDeCopia(original.nombre),
          creadoEn: momento,
          actualizadoEn: momento,
          eliminadoEn: null,
        };
        const preguntas = ordenarPorCreacion(
          (await db.preguntas.where('setId').equals(id).toArray()).filter(estaVigente),
        );
        await db.sets.add(copia);
        await db.preguntas.bulkAdd(
          preguntas.map((pregunta, indice) => ({
            ...pregunta,
            id: generarId(),
            setId: copia.id,
            // Offsets keep the original order inside the copy.
            creadoEn: momento + indice,
            actualizadoEn: momento + indice,
            eliminadoEn: null,
          })),
        );
        return copia;
      });
    },
  };
}

function crearRepositorioPreguntas(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): RepositorioPreguntas {
  async function obtenerVigente(id: string): Promise<Pregunta> {
    const pregunta = await db.preguntas.get(id);
    if (!pregunta || !estaVigente(pregunta)) {
      throw new ErrorRegistroNoEncontrado('pregunta', id);
    }
    return pregunta;
  }

  async function listarPorSet(setId: string): Promise<Pregunta[]> {
    const preguntas = await db.preguntas.where('setId').equals(setId).toArray();
    return ordenarPorCreacion(preguntas.filter(estaVigente));
  }

  return {
    listarPorSet,

    async buscar({ setId, texto, tema }: CriteriosBusquedaPreguntas) {
      const base =
        setId === undefined
          ? ordenarPorCreacion((await db.preguntas.toArray()).filter(estaVigente))
          : await listarPorSet(setId);
      return base.filter(
        (pregunta) =>
          (tema === undefined || pregunta.tema === tema) &&
          (texto === undefined || contieneTexto(pregunta.texto, texto)),
      );
    },

    async listarTemas(setId) {
      const temas = new Set(
        (await listarPorSet(setId)).map((p) => p.tema).filter((tema) => tema !== ''),
      );
      return [...temas].toSorted(compararTexto);
    },

    async contarPorSet() {
      const conteo: Record<string, number> = {};
      await db.preguntas.each((pregunta) => {
        if (estaVigente(pregunta)) {
          conteo[pregunta.setId] = (conteo[pregunta.setId] ?? 0) + 1;
        }
      });
      return conteo;
    },

    async obtener(id) {
      const pregunta = await db.preguntas.get(id);
      return pregunta && estaVigente(pregunta) ? pregunta : undefined;
    },

    async crear(setId, datos: DatosPregunta) {
      const validos = esquemaDatosPregunta.parse(datos);
      return db.transaction('rw', db.sets, db.preguntas, async () => {
        const set = await db.sets.get(setId);
        if (!set || !estaVigente(set)) {
          throw new ErrorRegistroNoEncontrado('set', setId);
        }
        const momento = ahora();
        const pregunta: Pregunta = {
          id: generarId(),
          setId,
          ...validos,
          creadoEn: momento,
          actualizadoEn: momento,
          eliminadoEn: null,
        };
        await db.preguntas.add(pregunta);
        return pregunta;
      });
    },

    async actualizar(id, datos) {
      const validos = esquemaDatosPregunta.parse(datos);
      return db.transaction('rw', db.preguntas, async () => {
        const actual = await obtenerVigente(id);
        const actualizada: Pregunta = { ...actual, ...validos, actualizadoEn: ahora() };
        await db.preguntas.put(actualizada);
        return actualizada;
      });
    },

    async eliminar(id) {
      await db.transaction('rw', db.preguntas, async () => {
        await obtenerVigente(id);
        const momento = ahora();
        await db.preguntas.update(id, { eliminadoEn: momento, actualizadoEn: momento });
      });
    },

    async duplicar(id) {
      return db.transaction('rw', db.preguntas, async () => {
        const original = await obtenerVigente(id);
        const momento = ahora();
        const copia: Pregunta = {
          ...original,
          id: generarId(),
          creadoEn: momento,
          actualizadoEn: momento,
          eliminadoEn: null,
        };
        await db.preguntas.add(copia);
        return copia;
      });
    },
  };
}

/** Dexie-backed repositories. Pass `dependencias` for deterministic clocks and ids in tests. */
export function crearRepositoriosDexie(
  db: BaseDatosTopRespuestas,
  dependencias: DependenciasRepositorio = dependenciasPredeterminadas,
): Repositorios {
  return {
    sets: crearRepositorioSets(db, dependencias),
    preguntas: crearRepositorioPreguntas(db, dependencias),
  };
}
