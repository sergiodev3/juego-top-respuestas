import type { DatosJuego, Pregunta } from '@/shared/modelo';

/** Number of cards printed on each letter sheet. */
export type TarjetasPorHoja = 2 | 4;

export interface RespuestaTarjeta {
  texto: string;
  /** Points as printed: multiplied in x2/x3 game rounds, base points otherwise. */
  puntos: number;
  sinonimos: readonly string[];
}

/** A printable host card: a question with its answers, or a notice for a missing question. */
export type Tarjeta =
  | {
      tipo: 'pregunta';
      /** Stable key for rendering. */
      clave: string;
      /** "Pregunta 3", "Ronda 2" or "Ronda final · Pregunta 1". */
      etiqueta: string;
      /** First 8 characters of the question id, to cross-check against the bank. */
      idCorto: string;
      tema: string;
      texto: string;
      /** "Puntos x2" / "Puntos x3" when the points are multiplied, otherwise `null`. */
      etiquetaPuntos: string | null;
      respuestas: readonly RespuestaTarjeta[];
    }
  | { tipo: 'aviso'; clave: string; etiqueta: string; mensaje: string };

/** Where the cards come from: a whole set, or the questions of a saved game. */
export type FuenteTarjetas =
  | { tipo: 'set'; preguntas: readonly Pregunta[] }
  | { tipo: 'juego'; juego: DatosJuego; preguntasPorId: ReadonlyMap<string, Pregunta> };

const LARGO_ID_CORTO = 8;

function tarjetaDePregunta(
  pregunta: Pregunta,
  clave: string,
  etiqueta: string,
  multiplicador: number,
): Tarjeta {
  return {
    tipo: 'pregunta',
    clave,
    etiqueta,
    idCorto: pregunta.id.slice(0, LARGO_ID_CORTO),
    tema: pregunta.tema,
    texto: pregunta.texto,
    etiquetaPuntos: multiplicador > 1 ? `Puntos x${String(multiplicador)}` : null,
    // Stored answers are already sorted by points (stable on ties); keep that order.
    respuestas: pregunta.respuestas.map((respuesta) => ({
      texto: respuesta.texto,
      puntos: respuesta.puntos * multiplicador,
      sinonimos: [...respuesta.sinonimos],
    })),
  };
}

function vigente(preguntasPorId: ReadonlyMap<string, Pregunta>, id: string): Pregunta | undefined {
  const pregunta = preguntasPorId.get(id);
  return pregunta?.eliminadoEn === null ? pregunta : undefined;
}

/**
 * Builds the printable cards. A set gives one card per non-deleted question, numbered in bank
 * order with base points. A game gives one card per round (points as played, i.e. multiplied
 * in x2/x3 rounds, matching the board), then the final-round questions when it is active.
 * A game question that is no longer in the bank becomes a notice card instead of failing.
 */
export function crearTarjetas(fuente: FuenteTarjetas): Tarjeta[] {
  if (fuente.tipo === 'set') {
    return fuente.preguntas
      .filter((pregunta) => pregunta.eliminadoEn === null)
      .map((pregunta, indice) =>
        tarjetaDePregunta(pregunta, pregunta.id, `Pregunta ${String(indice + 1)}`, 1),
      );
  }

  const { juego, preguntasPorId } = fuente;
  const rondas = juego.rondas.map((ronda, indice): Tarjeta => {
    const numero = String(indice + 1);
    const clave = `ronda-${numero}`;
    const etiqueta = `Ronda ${numero}`;
    const pregunta = vigente(preguntasPorId, ronda.preguntaId);
    return pregunta === undefined
      ? {
          tipo: 'aviso',
          clave,
          etiqueta,
          mensaje: `La pregunta de la ronda ${numero} ya no está en el banco.`,
        }
      : tarjetaDePregunta(pregunta, clave, etiqueta, ronda.multiplicador);
  });

  const { rondaFinal } = juego.reglas;
  if (!rondaFinal.activa) {
    return rondas;
  }
  const final = rondaFinal.preguntaIds.map((preguntaId, indice): Tarjeta => {
    const numero = String(indice + 1);
    const clave = `final-${numero}`;
    const etiqueta = `Ronda final · Pregunta ${numero}`;
    const pregunta = vigente(preguntasPorId, preguntaId);
    return pregunta === undefined
      ? {
          tipo: 'aviso',
          clave,
          etiqueta,
          mensaje: `La pregunta ${numero} de la ronda final ya no está en el banco.`,
        }
      : tarjetaDePregunta(pregunta, clave, etiqueta, 1);
  });
  return [...rondas, ...final];
}

/** Splits the cards into letter sheets of `porHoja` cards; the last sheet may be partial. */
export function agruparEnHojas<T>(tarjetas: readonly T[], porHoja: TarjetasPorHoja): T[][] {
  const hojas: T[][] = [];
  for (let inicio = 0; inicio < tarjetas.length; inicio += porHoja) {
    hojas.push(tarjetas.slice(inicio, inicio + porHoja));
  }
  return hojas;
}

/** "12 tarjetas en 6 hojas" / "1 tarjeta en 1 hoja", plus " + hoja de marcador" when included. */
export function resumenImpresion(tarjetas: number, hojas: number, marcador = false): string {
  const textoTarjetas = tarjetas === 1 ? '1 tarjeta' : `${String(tarjetas)} tarjetas`;
  const textoHojas = hojas === 1 ? '1 hoja' : `${String(hojas)} hojas`;
  const textoMarcador = marcador ? ' + hoja de marcador' : '';
  return `${textoTarjetas} en ${textoHojas}${textoMarcador}`;
}
