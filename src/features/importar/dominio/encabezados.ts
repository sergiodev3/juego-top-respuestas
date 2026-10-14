import { MAX_RESPUESTAS } from '@/shared/modelo';
import { normalizarTexto } from '@/shared/utils/normalizarTexto';

import { textoCelda, type FilaCruda } from './celdas';

/** Column index of each recognized header. Answer and points maps are keyed by 1-8. */
export interface ColumnasImportacion {
  tema?: number;
  pregunta: number;
  respuestas: Partial<Record<number, number>>;
  puntos: Partial<Record<number, number>>;
  sinonimos?: number;
}

export type ResultadoEncabezados =
  { ok: true; columnas: ColumnasImportacion } | { ok: false; error: string };

type Campo =
  | { tipo: 'tema' }
  | { tipo: 'pregunta' }
  | { tipo: 'sinonimos' }
  | { tipo: 'respuesta'; numero: number }
  | { tipo: 'puntos'; numero: number };

/** Lowercase, no accents, no whitespace: " Pts 1 " -> "pts1", "Sinónimos" -> "sinonimos". */
function claveEncabezado(texto: string): string {
  return normalizarTexto(texto).replace(/\s+/gu, '');
}

function reconocerCampo(clave: string): Campo | null {
  if (clave === 'tema' || clave === 'pregunta' || clave === 'sinonimos') {
    return { tipo: clave };
  }
  const coincidencia = /^(r|pts|puntos)(\d+)$/u.exec(clave);
  if (!coincidencia) {
    return null;
  }
  const numero = Number(coincidencia[2]);
  if (numero < 1 || numero > MAX_RESPUESTAS) {
    return null;
  }
  return coincidencia[1] === 'r' ? { tipo: 'respuesta', numero } : { tipo: 'puntos', numero };
}

/**
 * Maps the header row to column indexes. Matching ignores case, accents and spaces, and
 * columns may come in any order; unknown columns are ignored and the first repeated header
 * wins. Fails for the whole file when the Pregunta column or every answer column is missing.
 */
export function mapearEncabezados(fila: FilaCruda): ResultadoEncabezados {
  const columnas: ColumnasImportacion = { pregunta: -1, respuestas: {}, puntos: {} };
  const encontrados: string[] = [];

  fila.forEach((celda, indice) => {
    const texto = textoCelda(celda);
    if (texto === '') {
      return;
    }
    encontrados.push(texto);
    const campo = reconocerCampo(claveEncabezado(texto));
    if (!campo) {
      return;
    }
    switch (campo.tipo) {
      case 'tema':
        columnas.tema ??= indice;
        break;
      case 'pregunta':
        if (columnas.pregunta < 0) {
          columnas.pregunta = indice;
        }
        break;
      case 'sinonimos':
        columnas.sinonimos ??= indice;
        break;
      case 'respuesta':
        columnas.respuestas[campo.numero] ??= indice;
        break;
      case 'puntos':
        columnas.puntos[campo.numero] ??= indice;
        break;
    }
  });

  const lista = encontrados.length > 0 ? encontrados.join(', ') : 'ninguno';
  if (columnas.pregunta < 0) {
    return {
      ok: false,
      error: `No se encontró la columna «Pregunta». Encabezados encontrados: ${lista}.`,
    };
  }
  if (Object.keys(columnas.respuestas).length === 0) {
    return {
      ok: false,
      error: `No se encontraron columnas de respuestas (R1 a R8). Encabezados encontrados: ${lista}.`,
    };
  }
  return { ok: true, columnas };
}
