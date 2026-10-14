import { describe, expect, it } from 'vitest';

import type { Celda } from './celdas';
import {
  marcarDuplicadosEnSet,
  resumirValidacion,
  validarFilas,
  type FilaValidada,
} from './validarFilas';

const ENCABEZADO = ['Tema', 'Pregunta', 'R1', 'Pts1', 'R2', 'Pts2', 'R3', 'Pts3', 'Sinónimos'];

function filasDe(...datos: Celda[][]): FilaValidada[] {
  const resultado = validarFilas([ENCABEZADO, ...datos]);
  if (!resultado.ok) {
    throw new Error(resultado.error);
  }
  return resultado.filas;
}

function unaFila(...celdas: Celda[]): FilaValidada {
  const [fila] = filasDe(celdas);
  if (!fila) {
    throw new Error('No row returned');
  }
  return fila;
}

describe('validarFilas', () => {
  it('normalizes a valid row and sorts its answers by points', () => {
    const fila = unaFila(
      ' Escuela ',
      ' Menciona una materia ',
      'Historia',
      14,
      'Matemáticas',
      '32',
      'Español',
      ' 24 ',
    );

    expect(fila).toEqual({
      numeroFila: 2,
      estado: 'valida',
      errores: [],
      advertencias: [],
      tema: 'Escuela',
      texto: 'Menciona una materia',
      cantidadRespuestas: 3,
      pregunta: {
        tema: 'Escuela',
        texto: 'Menciona una materia',
        respuestas: [
          { texto: 'Matemáticas', puntos: 32, sinonimos: [] },
          { texto: 'Español', puntos: 24, sinonimos: [] },
          { texto: 'Historia', puntos: 14, sinonimos: [] },
        ],
      },
    });
  });

  it('maps synonyms to their answer before sorting', () => {
    const fila = unaFila(
      '',
      'Medio de transporte',
      'Camión',
      20,
      'Auto',
      50,
      'Celular',
      5,
      'R2: coche, carro; r1: autobús;',
    );

    expect(fila.estado).toBe('valida');
    expect(fila.estado === 'valida' && fila.pregunta.respuestas).toEqual([
      { texto: 'Auto', puntos: 50, sinonimos: ['coche', 'carro'] },
      { texto: 'Camión', puntos: 20, sinonimos: ['autobús'] },
      { texto: 'Celular', puntos: 5, sinonimos: [] },
    ]);
  });

  it('numbers rows as Excel shows them and skips empty rows silently', () => {
    const filas = filasDe(
      ['', 'Primera', 'A', 1],
      [null, '  ', undefined],
      [],
      ['', 'Segunda', 'B', 2],
    );

    expect(filas.map((f) => [f.numeroFila, f.texto])).toEqual([
      [2, 'Primera'],
      [5, 'Segunda'],
    ]);
  });

  it('accepts whole numbers written as numbers or text and rejects the rest', () => {
    const fila = unaFila('', 'Puntos', 'A', '25.0', 'B', 'abc', 'C', 25.5);

    expect(fila.estado).toBe('invalida');
    expect(fila.errores).toEqual([
      'Pts2 debe ser un número entero mayor o igual a 0 (valor: "abc").',
      'Pts3 debe ser un número entero mayor o igual a 0 (valor: "25.5").',
    ]);
  });

  it('rejects negative points', () => {
    expect(unaFila('', 'Negativos', 'A', '-5').errores).toEqual([
      'Pts1 debe ser un número entero mayor o igual a 0 (valor: "-5").',
    ]);
  });

  it('explains answers without points and points without answers', () => {
    const fila = unaFila('', 'Incompleta', 'A', 10, '', 30, 'C');

    expect(fila.errores).toEqual([
      'Pts2 tiene puntos pero R2 no tiene texto.',
      'R3 tiene texto pero no tiene puntos (Pts3).',
    ]);
  });

  it('reports a missing question text and a question without answers', () => {
    const fila = unaFila('Tema suelto');

    expect(fila).toMatchObject({
      numeroFila: 2,
      estado: 'invalida',
      errores: ['Falta el texto de la pregunta.', 'La pregunta necesita al menos una respuesta.'],
      tema: 'Tema suelto',
      texto: '',
      cantidadRespuestas: 0,
    });
  });

  it('applies the same length limits as the question bank', () => {
    const fila = unaFila('t'.repeat(61), 'p'.repeat(201), 'r'.repeat(81), 10);

    expect(fila.errores).toEqual([
      'La pregunta no puede tener más de 200 caracteres.',
      'El tema no puede tener más de 60 caracteres.',
      'R1: La respuesta no puede tener más de 80 caracteres.',
    ]);
  });

  it('reports synonyms for missing answers or with an unknown format', () => {
    const fila = unaFila('', 'Sinónimos malos', 'A', 10, '', '', '', '', 'R2: algo; R9: x; basura');

    expect(fila.errores).toEqual([
      'Sinónimos: "R9" no existe (usa R1 a R8).',
      'Sinónimos: formato no reconocido en "basura".',
      'Sinónimos: R2 no tiene respuesta.',
    ]);
  });

  it('warns about questions repeated in the file, ignoring case and accents', () => {
    const filas = filasDe(
      ['', '¿Qué país?', 'A', 1],
      ['', 'Otra', 'B', 1],
      ['', '¿QUE PAIS?', 'C', 1],
    );

    expect(filas.map((f) => [f.estado, f.advertencias])).toEqual([
      ['valida', []],
      ['valida', []],
      ['valida', ['La pregunta está repetida en el archivo (fila 2).']],
    ]);
  });

  it('fails for the whole file when there is no header row', () => {
    expect(validarFilas([])).toEqual({ ok: false, error: 'El archivo está vacío.' });
    expect(validarFilas([[null], ['  ']])).toEqual({
      ok: false,
      error: 'El archivo está vacío.',
    });
  });

  it('uses the first non-empty row as the header', () => {
    const resultado = validarFilas([[], ['Pregunta', 'R1', 'Pts1'], ['Hola', 'A', 3]]);

    expect(resultado.ok && resultado.filas.map((f) => [f.numeroFila, f.estado])).toEqual([
      [3, 'valida'],
    ]);
  });

  it('propagates header errors', () => {
    expect(
      validarFilas([
        ['Tema', 'R1'],
        ['x', 'y'],
      ]),
    ).toEqual({
      ok: false,
      error: 'No se encontró la columna «Pregunta». Encabezados encontrados: Tema, R1.',
    });
  });

  it('fails when the file has headers but no data rows', () => {
    expect(validarFilas([ENCABEZADO, []])).toEqual({
      ok: false,
      error: 'El archivo solo tiene encabezados; agrega al menos una pregunta.',
    });
  });
});

describe('marcarDuplicadosEnSet', () => {
  it('warns about questions that already exist in the target set without mutating the input', () => {
    const filas = filasDe(['', 'Menciona un PLANETA', 'A', 1], ['', 'Nueva', 'B', 1]);

    const marcadas = marcarDuplicadosEnSet(filas, ['menciona un planeta', 'Otra']);

    expect(marcadas.map((f) => f.advertencias)).toEqual([
      ['Ya existe una pregunta igual en el set destino.'],
      [],
    ]);
    expect(filas[0]?.advertencias).toEqual([]);
  });
});

describe('resumirValidacion', () => {
  it('counts valid rows, rows with errors and rows with warnings', () => {
    const filas = filasDe(['', 'A', 'x', 1], ['', 'a', 'x', 1], ['', '', 'x', 1]);

    expect(resumirValidacion(filas)).toEqual({ validas: 2, conErrores: 1, conAdvertencias: 1 });
  });
});
