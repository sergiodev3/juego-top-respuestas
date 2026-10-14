import { reconstruir, type ConfigPartida, type PreguntaSnapshot } from '@/engine';
import {
  crearJuegoPorDefecto,
  MAX_RONDAS_PREDETERMINADAS,
  type DatosJuego,
  type Pregunta,
  type SetPreguntas,
} from '@/shared/modelo';

export type ResultadoConfigPartida =
  | { readonly ok: true; readonly config: ConfigPartida }
  | { readonly ok: false; readonly errores: readonly string[] };

/** Deep copy of a bank question, so later bank edits never reach a started partida. */
function snapshot(pregunta: Pregunta): PreguntaSnapshot {
  return {
    id: pregunta.id,
    tema: pregunta.tema,
    texto: pregunta.texto,
    respuestas: pregunta.respuestas.map((respuesta) => ({
      texto: respuesta.texto,
      puntos: respuesta.puntos,
      sinonimos: [...respuesta.sinonimos],
    })),
  };
}

/**
 * Builds the immutable `ConfigPartida` for a new partida from a saved game and the current bank
 * questions. Missing or deleted questions and engine rule problems come back as Spanish
 * `errores`; the config is checked exactly like a stored one (`esquemaConfigPartida` +
 * `validarConfig`), so a partida that starts always rebuilds.
 */
export function crearConfigPartida(
  juego: DatosJuego,
  preguntasPorId: ReadonlyMap<string, Pregunta>,
): ResultadoConfigPartida {
  const errores: string[] = [];
  const buscar = (id: string, etiqueta: string): PreguntaSnapshot | null => {
    const pregunta = preguntasPorId.get(id);
    if (pregunta === undefined || pregunta.eliminadoEn !== null) {
      errores.push(`${etiqueta} ya no está en el banco.`);
      return null;
    }
    return snapshot(pregunta);
  };

  const rondas = juego.rondas.flatMap((ronda, indice) => {
    const pregunta = buscar(ronda.preguntaId, `La pregunta de la ronda ${String(indice + 1)}`);
    return pregunta === null ? [] : [{ pregunta, multiplicador: ronda.multiplicador }];
  });
  const { rondaFinal } = juego.reglas;
  const preguntasFinal = rondaFinal.activa
    ? rondaFinal.preguntaIds.flatMap((id, indice) => {
        const pregunta = buscar(id, `La pregunta ${String(indice + 1)} de la ronda final`);
        return pregunta === null ? [] : [pregunta];
      })
    : [];
  if (errores.length > 0) {
    return { ok: false, errores };
  }

  const config: ConfigPartida = {
    nombre: juego.nombre,
    equipos: juego.equipos.map(({ id, nombre, color }) => ({ id, nombre, color })),
    rondas,
    tachasMaximas: juego.reglas.tachasMaximas,
    rondaFinal: rondaFinal.activa
      ? { preguntas: preguntasFinal, segundos: [...rondaFinal.segundos], meta: rondaFinal.meta }
      : null,
  };
  const revisada = reconstruir(config, []);
  return revisada.ok
    ? { ok: true, config: revisada.config }
    : { ok: false, errores: revisada.errores };
}

/**
 * "Nuevo juego rápido": the set's name, the default teams and rules, and up to 4 questions picked
 * at random from the set's non-deleted questions (x2 and x3 on rounds 3 and 4 when there are 4).
 * `aleatorio` returns a number in [0, 1) like `Math.random`; inject it for deterministic tests.
 */
export function crearJuegoRapido(
  set: SetPreguntas,
  preguntas: readonly Pregunta[],
  aleatorio: () => number,
): DatosJuego {
  const disponibles = preguntas
    .filter((pregunta) => pregunta.eliminadoEn === null)
    .map((pregunta) => pregunta.id);
  const elegidas: string[] = [];
  while (elegidas.length < MAX_RONDAS_PREDETERMINADAS && disponibles.length > 0) {
    const indice = Math.min(Math.floor(aleatorio() * disponibles.length), disponibles.length - 1);
    elegidas.push(...disponibles.splice(Math.max(indice, 0), 1));
  }
  return crearJuegoPorDefecto({ nombre: set.nombre, preguntaIds: elegidas });
}
