import { describe, expect, it } from 'vitest';

import { mapearEncabezados } from './encabezados';

describe('mapearEncabezados', () => {
  it('maps the template headers to column indexes', () => {
    const resultado = mapearEncabezados([
      'Tema',
      'Pregunta',
      'R1',
      'Pts1',
      'R2',
      'Pts2',
      'Sinónimos',
    ]);

    expect(resultado).toEqual({
      ok: true,
      columnas: {
        tema: 0,
        pregunta: 1,
        respuestas: { 1: 2, 2: 4 },
        puntos: { 1: 3, 2: 5 },
        sinonimos: 6,
      },
    });
  });

  it('ignores case, accents, surrounding and inner spaces, and column order', () => {
    const resultado = mapearEncabezados([
      ' PTS 1 ',
      'sinonimos',
      ' r1',
      'PREGUNTA ',
      'puntos2',
      'R 2',
    ]);

    expect(resultado).toEqual({
      ok: true,
      columnas: {
        pregunta: 3,
        respuestas: { 1: 2, 2: 5 },
        puntos: { 1: 0, 2: 4 },
        sinonimos: 1,
      },
    });
  });

  it('ignores unknown columns, answers beyond R8 and repeated headers (first wins)', () => {
    const resultado = mapearEncabezados(['Notas', 'Pregunta', 'R1', 'R1', 'R9', 'Pts9', 42, null]);

    expect(resultado).toEqual({
      ok: true,
      columnas: { pregunta: 1, respuestas: { 1: 2 }, puntos: {} },
    });
  });

  it('fails for the whole file when the Pregunta column is missing, listing the found headers', () => {
    expect(mapearEncabezados(['Tema', 'Texto', 'R1', 'Pts1'])).toEqual({
      ok: false,
      error:
        'No se encontró la columna «Pregunta». Encabezados encontrados: Tema, Texto, R1, Pts1.',
    });
  });

  it('fails when there is no answer column (R1 to R8)', () => {
    expect(mapearEncabezados(['Tema', 'Pregunta', 'Respuesta'])).toEqual({
      ok: false,
      error:
        'No se encontraron columnas de respuestas (R1 a R8). Encabezados encontrados: Tema, Pregunta, Respuesta.',
    });
  });

  it('says when the header row has no text at all', () => {
    expect(mapearEncabezados([null, '  '])).toEqual({
      ok: false,
      error: 'No se encontró la columna «Pregunta». Encabezados encontrados: ninguno.',
    });
  });
});
