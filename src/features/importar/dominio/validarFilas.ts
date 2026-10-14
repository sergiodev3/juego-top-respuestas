import {
  esquemaDatosPregunta,
  MAX_RESPUESTAS,
  MAX_TEMA,
  MAX_TEXTO_PREGUNTA,
  MAX_TEXTO_RESPUESTA,
  type DatosPregunta,
} from '@/shared/modelo';
import { normalizarTexto } from '@/shared/utils/normalizarTexto';

import { esFilaVacia, textoCelda, type Celda, type FilaCruda } from './celdas';
import { mapearEncabezados, type ColumnasImportacion } from './encabezados';
import { parsearSinonimos } from './sinonimos';

interface FilaBase {
  /** Row number as the user sees it in Excel (the header is usually row 1). */
  numeroFila: number;
  /** Blocking problems; a row with errors is not imported. */
  errores: string[];
  /** Non-blocking notes (e.g. duplicates); the row is still imported. */
  advertencias: string[];
  /** Raw trimmed values, shown in the preview even when the row is invalid. */
  tema: string;
  texto: string;
  /** Answers that have text in the row. */
  cantidadRespuestas: number;
}

export type FilaValidada =
  (FilaBase & { estado: 'valida'; pregunta: DatosPregunta }) | (FilaBase & { estado: 'invalida' });

export type ResultadoValidacion =
  { ok: true; filas: FilaValidada[] } | { ok: false; error: string };

export interface ResumenValidacion {
  validas: number;
  conErrores: number;
  conAdvertencias: number;
}

export const ADVERTENCIA_DUPLICADA_EN_SET = 'Ya existe una pregunta igual en el set destino.';

type Puntos =
  { tipo: 'vacio' } | { tipo: 'valido'; valor: number } | { tipo: 'invalido'; texto: string };

const ENTERO_TEXTO = /^\d+(?:\.0*)?$/u;

/** Accepts whole numbers >= 0 as numbers or text (" 25 ", "25.0"); rejects "25.5", "-5", "abc". */
function leerPuntos(celda: Celda): Puntos {
  if (typeof celda === 'number') {
    return Number.isInteger(celda) && celda >= 0
      ? { tipo: 'valido', valor: celda }
      : { tipo: 'invalido', texto: textoCelda(celda) };
  }
  const texto = textoCelda(celda);
  if (texto === '') {
    return { tipo: 'vacio' };
  }
  return ENTERO_TEXTO.test(texto)
    ? { tipo: 'valido', valor: Number.parseInt(texto, 10) }
    : { tipo: 'invalido', texto };
}

/** Comparison key for duplicate detection: ignores case, accents and repeated spaces. */
function claveDuplicado(texto: string): string {
  return normalizarTexto(texto).replace(/\s+/gu, ' ');
}

function celda(fila: FilaCruda, indice: number | undefined): Celda {
  return indice === undefined ? undefined : fila[indice];
}

function validarFila(
  fila: FilaCruda,
  numeroFila: number,
  columnas: ColumnasImportacion,
): FilaValidada {
  const errores: string[] = [];
  const tema = textoCelda(celda(fila, columnas.tema));
  const texto = textoCelda(celda(fila, columnas.pregunta));

  if (texto === '') {
    errores.push('Falta el texto de la pregunta.');
  } else if (texto.length > MAX_TEXTO_PREGUNTA) {
    errores.push(`La pregunta no puede tener más de ${String(MAX_TEXTO_PREGUNTA)} caracteres.`);
  }
  if (tema.length > MAX_TEMA) {
    errores.push(`El tema no puede tener más de ${String(MAX_TEMA)} caracteres.`);
  }

  const respuestas: { numero: number; texto: string; puntos: number }[] = [];
  const conTexto = new Set<number>();
  for (let numero = 1; numero <= MAX_RESPUESTAS; numero += 1) {
    const textoRespuesta = textoCelda(celda(fila, columnas.respuestas[numero]));
    const puntos = leerPuntos(celda(fila, columnas.puntos[numero]));
    const r = `R${String(numero)}`;
    const pts = `Pts${String(numero)}`;

    if (textoRespuesta === '') {
      if (puntos.tipo !== 'vacio') {
        errores.push(`${pts} tiene puntos pero ${r} no tiene texto.`);
      }
      continue;
    }
    conTexto.add(numero);
    if (puntos.tipo === 'vacio') {
      errores.push(`${r} tiene texto pero no tiene puntos (${pts}).`);
    } else if (puntos.tipo === 'invalido') {
      errores.push(
        `${pts} debe ser un número entero mayor o igual a 0 (valor: "${puntos.texto}").`,
      );
    }
    if (textoRespuesta.length > MAX_TEXTO_RESPUESTA) {
      errores.push(
        `${r}: La respuesta no puede tener más de ${String(MAX_TEXTO_RESPUESTA)} caracteres.`,
      );
    }
    if (puntos.tipo === 'valido') {
      respuestas.push({ numero, texto: textoRespuesta, puntos: puntos.valor });
    }
  }
  if (conTexto.size === 0) {
    errores.push('La pregunta necesita al menos una respuesta.');
  }

  const sinonimos = parsearSinonimos(textoCelda(celda(fila, columnas.sinonimos)));
  errores.push(...sinonimos.errores);
  for (let numero = 1; numero <= MAX_RESPUESTAS; numero += 1) {
    if (sinonimos.porRespuesta[numero] !== undefined && !conTexto.has(numero)) {
      errores.push(`Sinónimos: R${String(numero)} no tiene respuesta.`);
    }
  }

  const base = { numeroFila, advertencias: [], tema, texto, cantidadRespuestas: conTexto.size };
  if (errores.length > 0) {
    return { ...base, estado: 'invalida', errores };
  }

  // Synonyms are attached to their answer before the schema sorts answers by points.
  const resultado = esquemaDatosPregunta.safeParse({
    texto,
    tema,
    respuestas: respuestas.map((r) => ({
      texto: r.texto,
      puntos: r.puntos,
      sinonimos: sinonimos.porRespuesta[r.numero] ?? [],
    })),
  });
  if (!resultado.success) {
    // Safety net: the checks above should already cover every schema rule.
    const mensajes = [...new Set(resultado.error.issues.map((issue) => issue.message))];
    return { ...base, estado: 'invalida', errores: mensajes };
  }
  return { ...base, estado: 'valida', errores, pregunta: resultado.data };
}

/** Adds a warning to every row whose question text already appeared in an earlier row. */
function marcarDuplicadosEnArchivo(filas: FilaValidada[]): FilaValidada[] {
  const primeraFila = new Map<string, number>();
  return filas.map((fila) => {
    if (fila.texto === '') {
      return fila;
    }
    const clave = claveDuplicado(fila.texto);
    const anterior = primeraFila.get(clave);
    if (anterior === undefined) {
      primeraFila.set(clave, fila.numeroFila);
      return fila;
    }
    return {
      ...fila,
      advertencias: [
        ...fila.advertencias,
        `La pregunta está repetida en el archivo (fila ${String(anterior)}).`,
      ],
    };
  });
}

/**
 * Validates a raw sheet (array of rows). The first non-empty row is the header; completely
 * empty rows are skipped. Each data row gets its errors and warnings with exact Spanish
 * reasons; valid rows carry normalized question data with answers sorted by points.
 */
export function validarFilas(matriz: readonly FilaCruda[]): ResultadoValidacion {
  const indiceEncabezado = matriz.findIndex((fila) => !esFilaVacia(fila));
  const encabezado = matriz[indiceEncabezado];
  if (indiceEncabezado < 0 || encabezado === undefined) {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  const mapeo = mapearEncabezados(encabezado);
  if (!mapeo.ok) {
    return mapeo;
  }

  const filas: FilaValidada[] = [];
  matriz.forEach((fila, indice) => {
    if (indice > indiceEncabezado && !esFilaVacia(fila)) {
      filas.push(validarFila(fila, indice + 1, mapeo.columnas));
    }
  });
  if (filas.length === 0) {
    return {
      ok: false,
      error: 'El archivo solo tiene encabezados; agrega al menos una pregunta.',
    };
  }
  return { ok: true, filas: marcarDuplicadosEnArchivo(filas) };
}

/** Returns copies of the rows with a warning when the question already exists in the target set. */
export function marcarDuplicadosEnSet(
  filas: readonly FilaValidada[],
  textosExistentes: readonly string[],
): FilaValidada[] {
  const existentes = new Set(textosExistentes.map(claveDuplicado));
  return filas.map((fila) =>
    fila.texto !== '' && existentes.has(claveDuplicado(fila.texto))
      ? { ...fila, advertencias: [...fila.advertencias, ADVERTENCIA_DUPLICADA_EN_SET] }
      : fila,
  );
}

export function resumirValidacion(filas: readonly FilaValidada[]): ResumenValidacion {
  return {
    validas: filas.filter((fila) => fila.estado === 'valida').length,
    conErrores: filas.filter((fila) => fila.estado === 'invalida').length,
    conAdvertencias: filas.filter((fila) => fila.advertencias.length > 0).length,
  };
}
