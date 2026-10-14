import { describe, expect, it } from 'vitest';

import { crearJuegoPorDefecto, type DatosJuego } from '@/shared/modelo';

import {
  agregarEquipo,
  elegirAlAzar,
  llenarRondaFinal,
  llenarRondas,
  moverRonda,
  preguntasEnUso,
  quitarEquipo,
  validarParaIniciar,
} from './edicionJuego';

/** Always picks the first remaining element. */
const primero = () => 0;

function juego(preguntaIds: string[] = ['p1', 'p2']): DatosJuego {
  return crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds });
}

function conRondaFinal(datos: DatosJuego, preguntaIds: string[]): DatosJuego {
  return {
    ...datos,
    reglas: {
      ...datos.reglas,
      rondaFinal: { ...datos.reglas.rondaFinal, activa: true, preguntaIds },
    },
  };
}

describe('agregarEquipo / quitarEquipo', () => {
  it('adds teams C and D with unused palette colors and unique ids, never more than 4', () => {
    const cuatro = agregarEquipo(agregarEquipo(juego()));

    expect(cuatro.equipos.map((e) => e.nombre)).toEqual([
      'Equipo A',
      'Equipo B',
      'Equipo C',
      'Equipo D',
    ]);
    expect(new Set(cuatro.equipos.map((e) => e.color)).size).toBe(4);
    expect(new Set(cuatro.equipos.map((e) => e.id)).size).toBe(4);
    expect(agregarEquipo(cuatro)).toBe(cuatro);
  });

  it('removes a team but keeps at least 2', () => {
    const tres = agregarEquipo(juego());

    expect(quitarEquipo(tres, 0).equipos.map((e) => e.nombre)).toEqual(['Equipo B', 'Equipo C']);
    const dos = juego();
    expect(quitarEquipo(dos, 0)).toBe(dos);
  });
});

describe('moverRonda', () => {
  it('swaps a round with its neighbour and ignores moves past the ends', () => {
    const datos = juego(['p1', 'p2', 'p3']);

    expect(moverRonda(datos, 2, -1).rondas.map((r) => r.preguntaId)).toEqual(['p1', 'p3', 'p2']);
    expect(moverRonda(datos, 0, 1).rondas.map((r) => r.preguntaId)).toEqual(['p2', 'p1', 'p3']);
    expect(moverRonda(datos, 0, -1)).toBe(datos);
    expect(moverRonda(datos, 2, 1)).toBe(datos);
  });
});

describe('elegirAlAzar', () => {
  it('picks distinct elements using the injected random source', () => {
    const valores = [0.99, 0, 0.5];
    let i = 0;
    const aleatorio = () => valores[i++] ?? 0;

    expect(elegirAlAzar(['a', 'b', 'c', 'd'], 3, aleatorio)).toEqual(['d', 'a', 'c']);
    expect(elegirAlAzar(['a', 'b'], 5, primero)).toEqual(['a', 'b']);
  });
});

describe('llenarRondas / llenarRondaFinal', () => {
  it('replaces the rounds with N random questions, default multipliers and no final-round repeats', () => {
    const datos = conRondaFinal(juego(['viejo']), ['p1']);

    const lleno = llenarRondas(datos, ['p1', 'p2', 'p3', 'p4', 'p5'], 4, primero);

    expect(lleno.rondas).toEqual([
      { preguntaId: 'p2', multiplicador: 1 },
      { preguntaId: 'p3', multiplicador: 1 },
      { preguntaId: 'p4', multiplicador: 2 },
      { preguntaId: 'p5', multiplicador: 3 },
    ]);
  });

  it('fills the final round with 5 questions not used in the rounds', () => {
    const datos = conRondaFinal(juego(['p1', 'p2']), []);

    const lleno = llenarRondaFinal(
      datos,
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
      primero,
    );

    expect(lleno.reglas.rondaFinal.preguntaIds).toEqual(['p3', 'p4', 'p5', 'p6', 'p7']);
    expect(preguntasEnUso(lleno)).toEqual(new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']));
  });
});

describe('validarParaIniciar', () => {
  it('accepts the defaults with at least one round', () => {
    expect(validarParaIniciar(juego())).toEqual([]);
  });

  it('lists every problem in Spanish', () => {
    const base = juego(['p1', 'p1']);
    const datos = conRondaFinal(
      {
        ...base,
        nombre: ' ',
        equipos: base.equipos.map((equipo) => ({ ...equipo, nombre: '', color: '#1d4ed8' })),
      },
      ['p2'],
    );

    expect(validarParaIniciar(datos)).toEqual([
      'Escribe el nombre del juego.',
      'Equipo A: Escribe el nombre del equipo.',
      'Equipo B: Escribe el nombre del equipo.',
      'Cada equipo necesita un color distinto.',
      'La ronda final necesita exactamente 5 preguntas.',
      'La ronda 2 repite una pregunta que ya está en el juego.',
    ]);
  });

  it('requires at least one round and flags final-round repeats', () => {
    const datos = conRondaFinal(juego([]), ['p1', 'p2', 'p3', 'p4', 'p1']);

    expect(validarParaIniciar(datos)).toEqual([
      'El juego necesita al menos una ronda.',
      'La pregunta 5 de la ronda final repite una pregunta que ya está en el juego.',
    ]);
  });
});
