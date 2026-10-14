import {
  crearJuegoPorDefecto,
  esquemaDatosJuego,
  esquemaDatosPregunta,
  esquemaDatosSet,
  type DatosPregunta,
  type Juego,
  type Pregunta,
  type SetPreguntas,
} from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import {
  ErrorRegistroNoEncontrado,
  type DependenciasRepositorio,
  type DestinoImportacion,
  type ResultadoImportacion,
  type ServicioImportacion,
} from './repositorios';

/** Validates everything up front so a bad row never leaves a half-written import. */
function validarPreguntas(preguntas: readonly DatosPregunta[]): DatosPregunta[] {
  if (preguntas.length === 0) {
    throw new Error('No hay preguntas válidas para importar.');
  }
  return preguntas.map((pregunta) => esquemaDatosPregunta.parse(pregunta));
}

export function crearServicioImportacion(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): ServicioImportacion {
  /** Must run inside a transaction that includes `sets` and `preguntas`. */
  async function escribir(
    destino: DestinoImportacion,
    preguntas: readonly DatosPregunta[],
  ): Promise<ResultadoImportacion> {
    const momento = ahora();
    let set: SetPreguntas;
    if (destino.tipo === 'nuevo') {
      set = {
        id: generarId(),
        ...esquemaDatosSet.parse(destino.datos),
        creadoEn: momento,
        actualizadoEn: momento,
        eliminadoEn: null,
      };
      await db.sets.add(set);
    } else {
      const existente = await db.sets.get(destino.setId);
      if (!existente || existente.eliminadoEn !== null) {
        throw new ErrorRegistroNoEncontrado('set', destino.setId);
      }
      set = { ...existente, actualizadoEn: momento };
      await db.sets.put(set);
    }

    const creadas: Pregunta[] = preguntas.map((datos, indice) => ({
      id: generarId(),
      setId: set.id,
      ...datos,
      // Offsets keep the file order when sorting by creation time.
      creadoEn: momento + indice,
      actualizadoEn: momento + indice,
      eliminadoEn: null,
    }));
    await db.preguntas.bulkAdd(creadas);
    return { set, preguntas: creadas };
  }

  return {
    async importarPreguntas(destino, preguntas) {
      const validas = validarPreguntas(preguntas);
      return db.transaction('rw', db.sets, db.preguntas, () => escribir(destino, validas));
    },

    async importarYJugar(datosSet, preguntas) {
      const validas = validarPreguntas(preguntas);
      return db.transaction('rw', db.sets, db.preguntas, db.juegos, async () => {
        const resultado = await escribir({ tipo: 'nuevo', datos: datosSet }, validas);
        const datosJuego = esquemaDatosJuego.parse(
          crearJuegoPorDefecto({
            nombre: resultado.set.nombre,
            preguntaIds: resultado.preguntas.map((pregunta) => pregunta.id),
          }),
        );
        const momento = ahora();
        const juego: Juego = {
          id: generarId(),
          ...datosJuego,
          creadoEn: momento,
          actualizadoEn: momento,
          eliminadoEn: null,
        };
        await db.juegos.add(juego);
        return { ...resultado, juego };
      });
    },
  };
}
