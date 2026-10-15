import { describe, expect, it } from 'vitest';

import { crearJuegoPorDefecto, type DatosJuego, type Pregunta } from '@/shared/modelo';
import { preguntaBancoPrueba } from '@/test/fabricasPartida';

import { agruparEnHojas, crearTarjetas, resumenImpresion } from './tarjetas';

function porId(preguntas: readonly Pregunta[]): ReadonlyMap<string, Pregunta> {
  return new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));
}

function juegoCon(cambios: Partial<DatosJuego> = {}): DatosJuego {
  return { ...crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: ['p1'] }), ...cambios };
}

const PREGUNTA_COMPLETA = preguntaBancoPrueba('0123456789abcdef', {
  tema: 'Transporte',
  texto: 'Menciona un medio de transporte',
  respuestas: [
    { texto: 'Auto', puntos: 40, sinonimos: ['coche', 'carro'] },
    { texto: 'Camión', puntos: 25, sinonimos: [] },
    { texto: 'Metro', puntos: 25, sinonimos: [] },
    { texto: 'Bici', puntos: 10, sinonimos: ['bicicleta'] },
  ],
});

describe('crearTarjetas from a set', () => {
  it('numbers the cards 1..N in bank order with a short id, tema, text and base points', () => {
    const tarjetas = crearTarjetas({
      tipo: 'set',
      preguntas: [PREGUNTA_COMPLETA, preguntaBancoPrueba('p2', { tema: '' })],
    });

    expect(tarjetas).toEqual([
      {
        tipo: 'pregunta',
        clave: '0123456789abcdef',
        etiqueta: 'Pregunta 1',
        idCorto: '01234567',
        tema: 'Transporte',
        texto: 'Menciona un medio de transporte',
        etiquetaPuntos: null,
        respuestas: [
          { texto: 'Auto', puntos: 40, sinonimos: ['coche', 'carro'] },
          { texto: 'Camión', puntos: 25, sinonimos: [] },
          { texto: 'Metro', puntos: 25, sinonimos: [] },
          { texto: 'Bici', puntos: 10, sinonimos: ['bicicleta'] },
        ],
      },
      {
        tipo: 'pregunta',
        clave: 'p2',
        etiqueta: 'Pregunta 2',
        idCorto: 'p2',
        tema: '',
        texto: 'Texto p2',
        etiquetaPuntos: null,
        respuestas: [
          { texto: 'Primera p2', puntos: 50, sinonimos: ['uno'] },
          { texto: 'Segunda p2', puntos: 30, sinonimos: [] },
        ],
      },
    ]);
  });

  it('skips deleted questions without leaving a gap in the numbering', () => {
    const tarjetas = crearTarjetas({
      tipo: 'set',
      preguntas: [
        preguntaBancoPrueba('p1'),
        preguntaBancoPrueba('p2', { eliminadoEn: 5 }),
        preguntaBancoPrueba('p3'),
      ],
    });

    expect(tarjetas.map((t) => [t.clave, t.etiqueta])).toEqual([
      ['p1', 'Pregunta 1'],
      ['p3', 'Pregunta 2'],
    ]);
  });
});

describe('crearTarjetas from a game', () => {
  it('makes one card per round in round order, with points multiplied in x2/x3 rounds', () => {
    const tarjetas = crearTarjetas({
      tipo: 'juego',
      juego: juegoCon({
        rondas: [
          { preguntaId: 'p2', multiplicador: 1 },
          { preguntaId: 'p1', multiplicador: 2 },
          { preguntaId: '0123456789abcdef', multiplicador: 3 },
        ],
      }),
      preguntasPorId: porId([
        preguntaBancoPrueba('p1'),
        preguntaBancoPrueba('p2'),
        PREGUNTA_COMPLETA,
      ]),
    });

    expect(tarjetas.map((t) => [t.clave, t.etiqueta])).toEqual([
      ['ronda-1', 'Ronda 1'],
      ['ronda-2', 'Ronda 2'],
      ['ronda-3', 'Ronda 3'],
    ]);
    const [x1, x2, x3] = tarjetas;
    expect(x1).toMatchObject({
      etiquetaPuntos: null,
      idCorto: 'p2',
      respuestas: [{ puntos: 50 }, { puntos: 30 }],
    });
    expect(x2).toMatchObject({
      etiquetaPuntos: 'Puntos x2',
      respuestas: [
        { texto: 'Primera p1', puntos: 100, sinonimos: ['uno'] },
        { texto: 'Segunda p1', puntos: 60, sinonimos: [] },
      ],
    });
    expect(x3).toMatchObject({
      etiquetaPuntos: 'Puntos x3',
      tema: 'Transporte',
      respuestas: [
        { texto: 'Auto', puntos: 120 },
        { texto: 'Camión', puntos: 75 },
        { texto: 'Metro', puntos: 75 },
        { texto: 'Bici', puntos: 30 },
      ],
    });
  });

  it('adds the final-round questions with base points when the final round is active', () => {
    const ids = ['f1', 'f2', 'f3', 'f4', 'f5'];
    const juego = juegoCon({ rondas: [{ preguntaId: 'p1', multiplicador: 3 }] });
    const tarjetas = crearTarjetas({
      tipo: 'juego',
      juego: {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: { ...juego.reglas.rondaFinal, activa: true, preguntaIds: ids },
        },
      },
      preguntasPorId: porId([
        preguntaBancoPrueba('p1'),
        ...ids.map((id) => preguntaBancoPrueba(id)),
      ]),
    });

    expect(tarjetas.map((t) => t.etiqueta)).toEqual([
      'Ronda 1',
      'Ronda final · Pregunta 1',
      'Ronda final · Pregunta 2',
      'Ronda final · Pregunta 3',
      'Ronda final · Pregunta 4',
      'Ronda final · Pregunta 5',
    ]);
    expect(tarjetas[1]).toMatchObject({
      clave: 'final-1',
      idCorto: 'f1',
      etiquetaPuntos: null,
      respuestas: [{ puntos: 50 }, { puntos: 30 }],
    });
  });

  it('leaves out the final-round questions when the final round is off', () => {
    const juego = juegoCon();
    const tarjetas = crearTarjetas({
      tipo: 'juego',
      juego: {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: { ...juego.reglas.rondaFinal, activa: false, preguntaIds: ['f1'] },
        },
      },
      preguntasPorId: porId([preguntaBancoPrueba('p1'), preguntaBancoPrueba('f1')]),
    });

    expect(tarjetas.map((t) => t.etiqueta)).toEqual(['Ronda 1']);
  });

  it('replaces a missing or deleted question with a notice card instead of failing', () => {
    const juego = juegoCon({
      rondas: [
        { preguntaId: 'p1', multiplicador: 1 },
        { preguntaId: 'borrada', multiplicador: 1 },
        { preguntaId: 'no-existe', multiplicador: 2 },
      ],
    });
    const tarjetas = crearTarjetas({
      tipo: 'juego',
      juego: {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: {
            ...juego.reglas.rondaFinal,
            activa: true,
            preguntaIds: ['p1', 'no-existe'],
          },
        },
      },
      preguntasPorId: porId([
        preguntaBancoPrueba('p1'),
        preguntaBancoPrueba('borrada', { eliminadoEn: 9 }),
      ]),
    });

    expect(tarjetas.slice(1)).toEqual([
      {
        tipo: 'aviso',
        clave: 'ronda-2',
        etiqueta: 'Ronda 2',
        mensaje: 'La pregunta de la ronda 2 ya no está en el banco.',
      },
      {
        tipo: 'aviso',
        clave: 'ronda-3',
        etiqueta: 'Ronda 3',
        mensaje: 'La pregunta de la ronda 3 ya no está en el banco.',
      },
      expect.objectContaining({ tipo: 'pregunta', etiqueta: 'Ronda final · Pregunta 1' }),
      {
        tipo: 'aviso',
        clave: 'final-2',
        etiqueta: 'Ronda final · Pregunta 2',
        mensaje: 'La pregunta 2 de la ronda final ya no está en el banco.',
      },
    ]);
  });
});

describe('agruparEnHojas', () => {
  const cinco = ['a', 'b', 'c', 'd', 'e'];

  it('puts two cards on each sheet, the last one partial', () => {
    expect(agruparEnHojas(cinco, 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('puts four cards on each sheet, the last one partial', () => {
    expect(agruparEnHojas(cinco, 4)).toEqual([['a', 'b', 'c', 'd'], ['e']]);
  });

  it('returns no sheets for no cards', () => {
    expect(agruparEnHojas([], 2)).toEqual([]);
  });
});

describe('resumenImpresion', () => {
  it('counts cards and sheets in Spanish, singular and plural', () => {
    expect(resumenImpresion(12, 6)).toBe('12 tarjetas en 6 hojas');
    expect(resumenImpresion(1, 1)).toBe('1 tarjeta en 1 hoja');
  });
});
