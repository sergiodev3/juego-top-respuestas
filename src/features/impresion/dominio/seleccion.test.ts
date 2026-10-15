import { describe, expect, it } from 'vitest';

import { rutaImpresion } from '@/shared/rutas';

import { leerSeleccion } from './seleccion';

function leer(consulta: string) {
  return leerSeleccion(new URLSearchParams(consulta));
}

describe('leerSeleccion', () => {
  it('reads a set or a game as the source', () => {
    expect(leer('set=s1')).toEqual({
      fuente: { tipo: 'set', id: 's1' },
      porHoja: 2,
      marcador: false,
    });
    expect(leer('juego=j1&por-hoja=4')).toEqual({
      fuente: { tipo: 'juego', id: 'j1' },
      porHoja: 4,
      marcador: false,
    });
  });

  it('has no source without a usable id', () => {
    expect(leer('')).toEqual({ fuente: null, porHoja: 2, marcador: false });
    expect(leer('set=%20&por-hoja=2').fuente).toBeNull();
  });

  it('falls back to 2 cards per sheet for any other layout value', () => {
    expect(leer('set=s1&por-hoja=3').porHoja).toBe(2);
    expect(leer('set=s1&por-hoja=cuatro').porHoja).toBe(2);
  });

  it('prefers the set when both a set and a game are given', () => {
    expect(leer('juego=j1&set=s1').fuente).toEqual({ tipo: 'set', id: 's1' });
  });

  it('includes the scoreboard sheet only with marcador=1', () => {
    expect(leer('juego=j1&marcador=1').marcador).toBe(true);
    expect(leer('juego=j1&marcador=0').marcador).toBe(false);
    expect(leer('juego=j1&marcador=si').marcador).toBe(false);
  });
});

describe('rutaImpresion', () => {
  it('writes only the non-default options', () => {
    expect(rutaImpresion()).toBe('/impresion');
    expect(rutaImpresion({ set: 's1', porHoja: 2, marcador: false })).toBe('/impresion?set=s1');
    expect(rutaImpresion({ juego: 'j1', porHoja: 4, marcador: true })).toBe(
      '/impresion?juego=j1&por-hoja=4&marcador=1',
    );
  });

  it('round-trips through leerSeleccion', () => {
    const ruta = rutaImpresion({ juego: 'j 1', porHoja: 4, marcador: true });
    expect(leerSeleccion(new URL(ruta, 'http://localhost').searchParams)).toEqual({
      fuente: { tipo: 'juego', id: 'j 1' },
      porHoja: 4,
      marcador: true,
    });
  });
});
