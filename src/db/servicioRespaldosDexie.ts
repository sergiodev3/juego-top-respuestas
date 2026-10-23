import {
  APP_RESPALDO,
  erroresDeIntegridad,
  esquemaRespaldo,
  VERSION_RESPALDO,
  type ConteoRestauracion,
  type DatosRespaldo,
} from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import {
  ErrorRespaldoInvalido,
  type DependenciasRepositorio,
  type ServicioRespaldos,
} from './repositorios';

/** The slice of a Dexie table the backup needs, so every data table fits one signature. */
interface Tabla<T> {
  toArray(): Promise<T[]>;
  clear(): Promise<void>;
  bulkGet(ids: string[]): Promise<(NoInfer<T> | undefined)[]>;
  bulkPut(registros: NoInfer<T>[]): Promise<unknown>;
}

interface Registro {
  id: string;
  creadoEn: number;
  actualizadoEn: number;
  eliminadoEn: number | null;
}

/** Oldest first, ties by id, so an export is stable and reads in creation order. */
function ordenarPorCreacion<T extends Registro>(registros: T[]): T[] {
  return registros.toSorted((a, b) => a.creadoEn - b.creadoEn || (a.id < b.id ? -1 : 1));
}

async function leerVigentes<T extends Registro>(tabla: Tabla<T>): Promise<T[]> {
  const registros = await tabla.toArray();
  return ordenarPorCreacion(registros.filter((registro) => registro.eliminadoEn === null));
}

/** Replace mode: the file becomes the table. */
async function reemplazar<T extends Registro>(
  tabla: Tabla<T>,
  entrantes: readonly T[],
): Promise<ConteoRestauracion> {
  await tabla.clear();
  await tabla.bulkPut([...entrantes]);
  return { agregados: entrantes.length, actualizados: 0, sinCambios: 0 };
}

/**
 * Merge mode: missing ids are added; for an id both sides have, the newer `actualizadoEn` wins
 * and a tie keeps the local copy. Local tombstones are records too, so a deletion made after
 * the backup is not undone, while a backup taken after the deletion does restore the record.
 */
async function combinar<T extends Registro>(
  tabla: Tabla<T>,
  entrantes: readonly T[],
): Promise<ConteoRestauracion> {
  const locales = await tabla.bulkGet(entrantes.map((registro) => registro.id));
  const conteo: ConteoRestauracion = { agregados: 0, actualizados: 0, sinCambios: 0 };
  const porEscribir: T[] = [];
  entrantes.forEach((entrante, indice) => {
    const local = locales[indice];
    if (!local) {
      conteo.agregados += 1;
      porEscribir.push(entrante);
    } else if (entrante.actualizadoEn > local.actualizadoEn) {
      conteo.actualizados += 1;
      porEscribir.push(entrante);
    } else {
      conteo.sinCambios += 1;
    }
  });
  await tabla.bulkPut(porEscribir);
  return conteo;
}

export function crearServicioRespaldos(
  db: BaseDatosTopRespuestas,
  { ahora }: DependenciasRepositorio,
): ServicioRespaldos {
  return {
    async exportar() {
      return db.transaction('r', db.sets, db.preguntas, db.juegos, db.partidas, async () => {
        const datos: DatosRespaldo = {
          sets: await leerVigentes(db.sets),
          preguntas: await leerVigentes(db.preguntas),
          juegos: await leerVigentes(db.juegos),
          partidas: await leerVigentes(db.partidas),
        };
        return { app: APP_RESPALDO, version: VERSION_RESPALDO, exportadoEn: ahora(), datos };
      });
    },

    async restaurar(respaldo, modo) {
      // Everything is checked before the first write, so a bad file never leaves a half restore.
      const datos: DatosRespaldo = esquemaRespaldo.parse(respaldo).datos;
      const errores = erroresDeIntegridad(datos);
      if (errores.length > 0) {
        throw new ErrorRespaldoInvalido(errores);
      }

      const escribir = <T extends Registro>(tabla: Tabla<T>, entrantes: readonly T[]) =>
        modo === 'reemplazar' ? reemplazar(tabla, entrantes) : combinar(tabla, entrantes);
      return db.transaction('rw', db.sets, db.preguntas, db.juegos, db.partidas, async () => ({
        modo,
        sets: await escribir(db.sets, datos.sets),
        preguntas: await escribir(db.preguntas, datos.preguntas),
        juegos: await escribir(db.juegos, datos.juegos),
        partidas: await escribir(db.partidas, datos.partidas),
      }));
    },
  };
}
