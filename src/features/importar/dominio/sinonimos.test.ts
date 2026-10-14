import { describe, expect, it } from 'vitest';

import { parsearSinonimos } from './sinonimos';

describe('parsearSinonimos', () => {
  it('maps each group to its answer number', () => {
    expect(parsearSinonimos('R1: auto, coche; R3: celular')).toEqual({
      porRespuesta: { 1: ['auto', 'coche'], 3: ['celular'] },
      errores: [],
    });
  });

  it('tolerates spaces, lowercase labels, a trailing semicolon and blank items', () => {
    expect(parsearSinonimos('  r2 :  pluma ,, bolígrafo ;  R 4:almuerzo ; ')).toEqual({
      porRespuesta: { 2: ['pluma', 'bolígrafo'], 4: ['almuerzo'] },
      errores: [],
    });
  });

  it('merges repeated groups and drops repeated synonyms ignoring case and accents', () => {
    expect(parsearSinonimos('R1: Fútbol, soccer; R1: futbol, Balompié')).toEqual({
      porRespuesta: { 1: ['Fútbol', 'soccer', 'Balompié'] },
      errores: [],
    });
  });

  it('returns nothing for an empty cell', () => {
    expect(parsearSinonimos('   ')).toEqual({ porRespuesta: {}, errores: [] });
  });

  it('reports answers outside R1 to R8', () => {
    expect(parsearSinonimos('R9: algo; r0: nada').errores).toEqual([
      'Sinónimos: "R9" no existe (usa R1 a R8).',
      'Sinónimos: "R0" no existe (usa R1 a R8).',
    ]);
  });

  it('reports groups it cannot read and keeps the valid ones', () => {
    expect(parsearSinonimos('auto, coche; R2: lápiz; Respuesta 3 - celular')).toEqual({
      porRespuesta: { 2: ['lápiz'] },
      errores: [
        'Sinónimos: formato no reconocido en "auto, coche".',
        'Sinónimos: formato no reconocido en "Respuesta 3 - celular".',
      ],
    });
  });
});
