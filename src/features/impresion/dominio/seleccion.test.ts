import { describe, expect, it } from 'vitest';

import { leerSeleccion } from './seleccion';

function leer(consulta: string) {
  return leerSeleccion(new URLSearchParams(consulta));
}

describe('leerSeleccion', () => {
  it('reads a set or a game as the source', () => {
    expect(leer('set=s1')).toEqual({ fuente: { tipo: 'set', id: 's1' }, porHoja: 2 });
    expect(leer('juego=j1&por-hoja=4')).toEqual({
      fuente: { tipo: 'juego', id: 'j1' },
      porHoja: 4,
    });
  });

  it('has no source without a usable id', () => {
    expect(leer('')).toEqual({ fuente: null, porHoja: 2 });
    expect(leer('set=%20&por-hoja=2').fuente).toBeNull();
  });

  it('falls back to 2 cards per sheet for any other layout value', () => {
    expect(leer('set=s1&por-hoja=3').porHoja).toBe(2);
    expect(leer('set=s1&por-hoja=cuatro').porHoja).toBe(2);
  });

  it('prefers the set when both a set and a game are given', () => {
    expect(leer('juego=j1&set=s1').fuente).toEqual({ tipo: 'set', id: 's1' });
  });
});
