import { describe, expect, it } from 'vitest';

import { reconstruir, reducir, validarConfig } from './index';
import type { ConfigPartida, Evento } from './index';
import { congelar, crearConfig, definido, jugar } from './prueba/fabricas';
import { partidaDosEquipos } from './prueba/partidas';

const config = crearConfig();
const INVALIDA = 'La configuración de la partida no es válida';

/** Clones the default config as plain JSON and applies `cambiar`, like a damaged stored record. */
function configDanada(cambiar: (copia: Record<string, unknown>) => void): unknown {
  const copia = JSON.parse(JSON.stringify(crearConfig({ rondaFinal: true }))) as Record<
    string,
    unknown
  >;
  cambiar(copia);
  return copia;
}

function errores(configGuardada: unknown, eventos: unknown = []): readonly string[] {
  const resultado = reconstruir(configGuardada, eventos);
  if (resultado.ok) {
    throw new Error('Expected reconstruir to fail.');
  }
  return resultado.errores;
}

describe('reconstruir: valid data', () => {
  it('rebuilds a complete game exactly like reducir', () => {
    const partida = partidaDosEquipos(200);
    const resultado = reconstruir(partida.config, partida.eventos);
    expect(resultado).toEqual({
      ok: true,
      config: partida.config,
      estado: jugar(partida.config, partida.eventos),
      advertencias: [],
    });
  });

  it('accepts a config read back as plain JSON and drops unknown keys', () => {
    const guardada = { ...JSON.parse(JSON.stringify(config)), version: 2 } as unknown;
    const resultado = reconstruir(guardada, []);
    expect(resultado.ok && resultado.config).toEqual(config);
  });
});

describe('reconstruir: stored logs', () => {
  it('skips malformed and rule-invalid events and reports their indices and codes', () => {
    const log: unknown[] = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: '0' },
      null,
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'DESHACER' },
      { tipo: 'ROBO_FALLIDO' },
      { tipo: 'JUGAR' },
      { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 0 },
      { tipo: 'AJUSTAR_PUNTOS', equipo: 3, delta: 5 },
      { tipo: 'REVELAR', indice: 1 },
    ];
    const resultado = reconstruir(config, congelar(log));
    if (!resultado.ok) {
      throw new Error('Expected a rebuilt game.');
    }
    const validos: Evento[] = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'REVELAR', indice: 1 },
    ];
    expect({ ...resultado.estado, advertencias: [] }).toEqual(jugar(config, validos));
    expect(resultado.estado.ronda?.bolsa).toBe(65);
    expect(resultado.advertencias).toBe(resultado.estado.advertencias);
    expect(resultado.advertencias.map(({ indice, codigo }) => [indice, codigo])).toEqual([
      [1, 'EVENTO_MALFORMADO'],
      [2, 'EVENTO_MALFORMADO'],
      [4, 'EVENTO_MALFORMADO'],
      [5, 'FASE_INVALIDA'],
      [7, 'EVENTO_MALFORMADO'],
      [8, 'EQUIPO_INVALIDO'],
    ]);
    expect(definido(resultado.advertencias[0])).toEqual({
      indice: 1,
      codigo: 'EVENTO_MALFORMADO',
      motivo: 'El evento guardado no tiene un formato válido.',
    });
  });

  it('matches reducir for the same log', () => {
    const log = [{ tipo: 'TACHE' }, { tipo: 'ASIGNAR_TURNO', equipo: 1 }, { tipo: 'TACHE' }];
    const resultado = reconstruir(config, log);
    expect(resultado.ok && resultado.estado).toEqual(reducir(config, log as Evento[]));
  });

  it.each<unknown>([null, undefined, {}, 'eventos', 42, { length: 1, 0: { tipo: 'TACHE' } }])(
    'fails for a log that is not a list: %j',
    (eventos) => {
      expect(reconstruir(config, eventos)).toEqual({
        ok: false,
        errores: ['El historial de eventos de la partida debe ser una lista.'],
      });
    },
  );
});

describe('reconstruir: invalid config', () => {
  it.each<unknown>([null, 'config', 42, [], true])('fails for a config that is %j', (valor) => {
    expect(errores(valor)).toEqual([`${INVALIDA}: debe ser un objeto.`]);
  });

  it('fails for a missing config', () => {
    expect(errores(undefined)).toEqual([`${INVALIDA}: falta este dato.`]);
  });

  it('lists every missing field of a partial config', () => {
    expect(errores({ nombre: 'Partida' })).toEqual([
      `${INVALIDA} en "equipos": falta este dato.`,
      `${INVALIDA} en "rondas": falta este dato.`,
      `${INVALIDA} en "tachasMaximas": falta este dato.`,
      `${INVALIDA} en "rondaFinal": falta este dato.`,
    ]);
  });

  it.each<[string, (copia: Record<string, unknown>) => void, string]>([
    ['a text strike limit', (c) => (c.tachasMaximas = '3'), '"tachasMaximas": debe ser un número'],
    ['teams that are not a list', (c) => (c.equipos = 'A, B'), '"equipos": debe ser una lista'],
    ['a team without name', (c) => delete definido(equipos(c)[1]).nombre, '"equipos[1].nombre"'],
    [
      'a numeric answer text',
      (c) => (respuestaRonda(c).texto = 5),
      '"rondas[0].pregunta.respuestas[1].texto": debe ser texto',
    ],
    [
      'a x4 multiplier',
      (c) => (definido(rondas(c)[0]).multiplicador = 4),
      '"rondas[0].multiplicador": tiene un valor no permitido',
    ],
    [
      'a final round that is not an object',
      (c) => (c.rondaFinal = 'sí'),
      '"rondaFinal": debe ser un objeto',
    ],
    [
      'one timer value',
      (c) => (rondaFinal(c).segundos = [20]),
      '"rondaFinal.segundos": tiene menos elementos de los necesarios',
    ],
    [
      'three timer values',
      (c) => (rondaFinal(c).segundos = [20, 25, 30]),
      '"rondaFinal.segundos": excede el máximo permitido',
    ],
    [
      'timers that are not a list',
      (c) => (rondaFinal(c).segundos = 20),
      '"rondaFinal.segundos": debe ser una lista',
    ],
    [
      'a fractional goal',
      (c) => (rondaFinal(c).meta = 1.5),
      '"rondaFinal.meta": debe ser un número entero',
    ],
    [
      'a negative goal',
      (c) => (rondaFinal(c).meta = -1),
      '"rondaFinal.meta": es menor que el mínimo permitido',
    ],
  ])('fails for %s', (_descripcion, cambiar, mensaje) => {
    const lista = errores(configDanada(cambiar));
    expect(lista).toHaveLength(1);
    expect(definido(lista[0])).toContain(`${INVALIDA} en ${mensaje}`);
  });

  it('reports the rule problems of a well-shaped config', () => {
    const unEquipo: ConfigPartida = { ...config, equipos: config.equipos.slice(0, 1), rondas: [] };
    expect(errores(unEquipo)).toEqual(validarConfig(unEquipo));
    expect(errores(unEquipo)).toEqual([
      'La partida necesita entre 2 y 4 equipos.',
      'La partida necesita al menos una ronda.',
    ]);
  });

  it('reports config problems before looking at the log', () => {
    expect(errores(null, 'no es una lista')).toEqual([`${INVALIDA}: debe ser un objeto.`]);
  });
});

describe('reconstruir: never throws', () => {
  it('turns an exception while reading the data into an error', () => {
    const trampa = Object.defineProperty({ ...config }, 'nombre', {
      enumerable: true,
      get() {
        throw new Error('broken getter');
      },
    });
    expect(reconstruir(trampa, [])).toEqual({
      ok: false,
      errores: ['No se pudo leer la partida guardada.'],
    });
  });

  it('survives any combination of garbage', () => {
    const basura: unknown[] = [null, undefined, 0, '', 'x', [], {}, [null], { tipo: 'TACHE' }];
    for (const configGuardada of [...basura, config]) {
      for (const eventos of [...basura, [[]], [{ tipo: 'ASIGNAR_TURNO', equipo: 9 }]]) {
        expect(() => reconstruir(configGuardada, eventos)).not.toThrow();
      }
    }
  });
});

function equipos(copia: Record<string, unknown>): Record<string, unknown>[] {
  return copia.equipos as Record<string, unknown>[];
}

function rondas(copia: Record<string, unknown>): Record<string, unknown>[] {
  return copia.rondas as Record<string, unknown>[];
}

function respuestaRonda(copia: Record<string, unknown>): Record<string, unknown> {
  const pregunta = definido(rondas(copia)[0]).pregunta as { respuestas: Record<string, unknown>[] };
  return definido(pregunta.respuestas[1]);
}

function rondaFinal(copia: Record<string, unknown>): Record<string, unknown> {
  return copia.rondaFinal as Record<string, unknown>;
}
