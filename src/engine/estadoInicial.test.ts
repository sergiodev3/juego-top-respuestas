import { describe, expect, it } from 'vitest';

import { crearEstadoInicial, validarConfig } from './index';
import type { ConfigPartida } from './index';
import { congelar, crearConfig, crearPregunta, definido } from './prueba/fabricas';

const base = crearConfig({ rondaFinal: true });

function con(cambios: Partial<ConfigPartida>): ConfigPartida {
  return congelar({ ...base, ...cambios });
}

describe('crearEstadoInicial', () => {
  it('starts round 1 face-off with every score at 0', () => {
    expect(crearEstadoInicial(crearConfig({ equipos: 4 }))).toEqual({
      fase: 'caraACara',
      puntajes: [0, 0, 0, 0],
      ronda: {
        indice: 0,
        respuestas: ['oculta', 'oculta', 'oculta', 'oculta', 'oculta'],
        bolsa: 0,
        tachas: 0,
        caraACara: { intentos: [], respondedor: null, ganador: null },
        equipoControl: null,
        equipoRobo: null,
        ganador: null,
        puntosOtorgados: null,
      },
      rondaFinal: null,
      advertencias: [],
    });
  });

  it('is JSON-serializable', () => {
    const estado = crearEstadoInicial(base);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });

  it('throws for an invalid config', () => {
    expect(() => crearEstadoInicial(con({ rondas: [] }))).toThrow(
      'La partida necesita al menos una ronda.',
    );
  });
});

describe('validarConfig', () => {
  it('accepts a valid config', () => {
    expect(validarConfig(base)).toEqual([]);
    expect(validarConfig(crearConfig({ equipos: 4 }))).toEqual([]);
  });

  it('requires 2-4 teams', () => {
    const mensaje = 'La partida necesita entre 2 y 4 equipos.';
    expect(validarConfig(con({ equipos: base.equipos.slice(0, 1) }))).toEqual([mensaje]);
    const cinco = [...crearConfig({ equipos: 4 }).equipos, definido(base.equipos[0])];
    expect(validarConfig(con({ equipos: cinco }))).toEqual([mensaje]);
  });

  it('requires a positive integer strike limit', () => {
    expect(validarConfig(con({ tachasMaximas: 0 }))).toEqual([
      'Las tachas máximas deben ser un entero mayor o igual a 1.',
    ]);
    expect(validarConfig(con({ tachasMaximas: 2.5 }))).toHaveLength(1);
  });

  it('checks round multipliers and answers', () => {
    const errores = validarConfig(
      con({
        rondas: [
          { pregunta: crearPregunta('A', [10, 20]), multiplicador: 4 as 1 },
          { pregunta: crearPregunta('B', []), multiplicador: 1 },
          { pregunta: crearPregunta('C', [10, -1]), multiplicador: 1 },
          { pregunta: crearPregunta('D', [10, 2.5]), multiplicador: 2 },
        ],
      }),
    );
    expect(errores).toEqual([
      'El multiplicador de la ronda 1 debe ser x1, x2 o x3.',
      'La pregunta de la ronda 1: las respuestas deben estar ordenadas por puntos.',
      'La pregunta de la ronda 2 no tiene respuestas.',
      'La pregunta de la ronda 3: los puntos deben ser enteros mayores o iguales a 0.',
      'La pregunta de la ronda 4: los puntos deben ser enteros mayores o iguales a 0.',
    ]);
  });

  it('requires exactly five valid final-round questions', () => {
    const rondaFinal = definido(base.rondaFinal);
    expect(
      validarConfig(
        con({ rondaFinal: { ...rondaFinal, preguntas: rondaFinal.preguntas.slice(1) } }),
      ),
    ).toEqual(['La ronda final necesita exactamente 5 preguntas.']);
    expect(
      validarConfig(
        con({
          rondaFinal: {
            ...rondaFinal,
            preguntas: [...rondaFinal.preguntas.slice(1), crearPregunta('X', [])],
          },
        }),
      ),
    ).toEqual(['La pregunta 5 de la ronda final no tiene respuestas.']);
  });
});
