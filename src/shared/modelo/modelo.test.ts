import { describe, expect, it } from 'vitest';

import {
  esquemaDatosPregunta,
  esquemaDatosSet,
  esquemaRespuesta,
  esRespuestaVacia,
  MAX_RESPUESTAS,
  ordenarRespuestas,
} from './index';

function mensajes(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues.map((issue) => issue.message) ?? [];
}

describe('ordenarRespuestas', () => {
  it('sorts answers by points, highest first', () => {
    const ordenadas = ordenarRespuestas([
      { texto: 'B', puntos: 10, sinonimos: [] },
      { texto: 'A', puntos: 40, sinonimos: [] },
      { texto: 'C', puntos: 25, sinonimos: [] },
    ]);

    expect(ordenadas.map((r) => r.texto)).toEqual(['A', 'C', 'B']);
  });

  it('keeps the original order on ties and does not mutate the input', () => {
    const entrada = [
      { texto: 'Primera', puntos: 10, sinonimos: [] },
      { texto: 'Segunda', puntos: 30, sinonimos: [] },
      { texto: 'Tercera', puntos: 10, sinonimos: [] },
    ];

    const ordenadas = ordenarRespuestas(entrada);

    expect(ordenadas.map((r) => r.texto)).toEqual(['Segunda', 'Primera', 'Tercera']);
    expect(entrada.map((r) => r.texto)).toEqual(['Primera', 'Segunda', 'Tercera']);
  });
});

describe('esquemaRespuesta', () => {
  it('trims the text and the synonyms, dropping blank synonyms', () => {
    const resultado = esquemaRespuesta.parse({
      texto: '  Perro ',
      puntos: 12,
      sinonimos: [' Can ', '', '  '],
    });

    expect(resultado).toEqual({ texto: 'Perro', puntos: 12, sinonimos: ['Can'] });
  });

  it('defaults synonyms to an empty list', () => {
    expect(esquemaRespuesta.parse({ texto: 'Gato', puntos: 3 }).sinonimos).toEqual([]);
  });

  it('rejects empty text, text over 80 characters, negative and fractional points', () => {
    expect(mensajes(esquemaRespuesta.safeParse({ texto: '   ', puntos: 1 }))).toEqual([
      'Escribe el texto de la respuesta.',
    ]);
    expect(mensajes(esquemaRespuesta.safeParse({ texto: 'x'.repeat(81), puntos: 1 }))).toEqual([
      'La respuesta no puede tener más de 80 caracteres.',
    ]);
    expect(mensajes(esquemaRespuesta.safeParse({ texto: 'Sol', puntos: -1 }))).toEqual([
      'Los puntos no pueden ser negativos.',
    ]);
    expect(mensajes(esquemaRespuesta.safeParse({ texto: 'Sol', puntos: 2.5 }))).toEqual([
      'Los puntos deben ser un número entero.',
    ]);
    expect(mensajes(esquemaRespuesta.safeParse({ texto: 'Sol', puntos: Number.NaN }))).toEqual([
      'Escribe los puntos de la respuesta.',
    ]);
  });
});

describe('esRespuestaVacia', () => {
  it('detects rows the user left completely blank', () => {
    expect(esRespuestaVacia({ texto: '  ', puntos: Number.NaN, sinonimos: [' '] })).toBe(true);
    expect(esRespuestaVacia({ texto: '', puntos: 20, sinonimos: [] })).toBe(false);
    expect(esRespuestaVacia({ texto: 'Luna', puntos: Number.NaN, sinonimos: [] })).toBe(false);
  });
});

describe('esquemaDatosPregunta', () => {
  it('normalizes a question: trims, drops blank answers and sorts by points', () => {
    const datos = esquemaDatosPregunta.parse({
      texto: '  Menciona una fruta ',
      tema: ' Alimentos ',
      respuestas: [
        { texto: 'Pera', puntos: 10, sinonimos: [] },
        { texto: '', puntos: Number.NaN, sinonimos: [] },
        { texto: 'Manzana', puntos: 45, sinonimos: ['Manzanita'] },
      ],
    });

    expect(datos).toEqual({
      texto: 'Menciona una fruta',
      tema: 'Alimentos',
      respuestas: [
        { texto: 'Manzana', puntos: 45, sinonimos: ['Manzanita'] },
        { texto: 'Pera', puntos: 10, sinonimos: [] },
      ],
    });
  });

  it('allows an empty topic', () => {
    const datos = esquemaDatosPregunta.parse({
      texto: 'Pregunta',
      tema: '',
      respuestas: [{ texto: 'Sí', puntos: 1 }],
    });

    expect(datos.tema).toBe('');
  });

  it('requires question text and at least one answer', () => {
    const resultado = esquemaDatosPregunta.safeParse({
      texto: ' ',
      tema: '',
      respuestas: [{ texto: '', puntos: Number.NaN, sinonimos: [] }],
    });

    expect(mensajes(resultado)).toEqual([
      'Escribe el texto de la pregunta.',
      'Agrega al menos una respuesta.',
    ]);
  });

  it(`rejects more than ${String(MAX_RESPUESTAS)} answers`, () => {
    const respuestas = Array.from({ length: MAX_RESPUESTAS + 1 }, (_, i) => ({
      texto: `R${String(i)}`,
      puntos: i,
    }));

    const resultado = esquemaDatosPregunta.safeParse({ texto: 'P', tema: '', respuestas });

    expect(mensajes(resultado)).toEqual(['Una pregunta puede tener como máximo 8 respuestas.']);
  });

  it('reports the path of the invalid answer field', () => {
    const resultado = esquemaDatosPregunta.safeParse({
      texto: 'P',
      tema: '',
      respuestas: [
        { texto: 'Bien', puntos: 5 },
        { texto: 'Mal', puntos: -3 },
      ],
    });

    expect(resultado.error?.issues[0]?.path).toEqual(['respuestas', 1, 'puntos']);
  });
});

describe('esquemaDatosSet', () => {
  it('trims fields and defaults materia and grupo', () => {
    expect(esquemaDatosSet.parse({ nombre: '  Historia 2B ' })).toEqual({
      nombre: 'Historia 2B',
      materia: '',
      grupo: '',
    });
  });

  it('requires a name', () => {
    expect(mensajes(esquemaDatosSet.safeParse({ nombre: '  ', materia: 'Historia' }))).toEqual([
      'Escribe el nombre del set.',
    ]);
  });
});
