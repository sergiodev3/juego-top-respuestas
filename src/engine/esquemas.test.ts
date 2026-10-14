import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import { esquemaConfigPartida, esquemaEvento } from './index';
import type { ConfigPartida, Evento } from './index';
import { crearConfig } from './prueba/fabricas';
import { generarPartida, partidaDosEquipos } from './prueba/partidas';

const VALIDOS: readonly Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 3 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'TACHE' },
  { tipo: 'JUGAR' },
  { tipo: 'PASAR' },
  { tipo: 'PASAR', equipo: 2 },
  { tipo: 'ROBO_EXITOSO', indice: 7 },
  { tipo: 'ROBO_FALLIDO' },
  { tipo: 'REVELAR_TODAS' },
  { tipo: 'SIGUIENTE_RONDA' },
  { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: -15 },
  { tipo: 'TERMINAR_JUEGO' },
  { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 2, texto: 'perro' },
  { tipo: 'RF_RESPUESTA', jugador: 2, pregunta: 4, indice: null, texto: '' },
  { tipo: 'RF_REVELAR', jugador: 2, pregunta: 4 },
  { tipo: 'RF_SIGUIENTE_JUGADOR' },
  { tipo: 'RF_TERMINAR' },
];

/** One or more malformed shapes per event type, plus values that are not events at all. */
const MALFORMADOS: readonly (readonly [string, unknown])[] = [
  ['ASIGNAR_TURNO without equipo', { tipo: 'ASIGNAR_TURNO' }],
  ['ASIGNAR_TURNO with a text equipo', { tipo: 'ASIGNAR_TURNO', equipo: '1' }],
  ['ASIGNAR_TURNO with equipo 4', { tipo: 'ASIGNAR_TURNO', equipo: 4 }],
  ['ASIGNAR_TURNO with equipo -1', { tipo: 'ASIGNAR_TURNO', equipo: -1 }],
  ['ASIGNAR_TURNO with a fractional equipo', { tipo: 'ASIGNAR_TURNO', equipo: 1.5 }],
  ['REVELAR without indice', { tipo: 'REVELAR' }],
  ['REVELAR with a text indice', { tipo: 'REVELAR', indice: '0' }],
  ['REVELAR with indice -1', { tipo: 'REVELAR', indice: -1 }],
  ['REVELAR with a null indice', { tipo: 'REVELAR', indice: null }],
  ['PASAR with a null equipo', { tipo: 'PASAR', equipo: null }],
  ['PASAR with equipo 4', { tipo: 'PASAR', equipo: 4 }],
  ['ROBO_EXITOSO without indice', { tipo: 'ROBO_EXITOSO' }],
  ['ROBO_EXITOSO with a fractional indice', { tipo: 'ROBO_EXITOSO', indice: 0.5 }],
  ['AJUSTAR_PUNTOS without delta', { tipo: 'AJUSTAR_PUNTOS', equipo: 0 }],
  ['AJUSTAR_PUNTOS without equipo', { tipo: 'AJUSTAR_PUNTOS', delta: 5 }],
  ['AJUSTAR_PUNTOS with delta 0', { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 0 }],
  ['AJUSTAR_PUNTOS with a fractional delta', { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 1.5 }],
  ['AJUSTAR_PUNTOS with a text delta', { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: '5' }],
  ['AJUSTAR_PUNTOS with a NaN delta', { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: Number.NaN }],
  ['AJUSTAR_PUNTOS with equipo 4', { tipo: 'AJUSTAR_PUNTOS', equipo: 4, delta: 5 }],
  ['RF_RESPUESTA without texto', { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0 }],
  [
    'RF_RESPUESTA with a numeric texto',
    { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0, texto: 5 },
  ],
  [
    'RF_RESPUESTA without indice',
    { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, texto: 'perro' },
  ],
  [
    'RF_RESPUESTA with a fractional indice',
    { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 1.5, texto: 'perro' },
  ],
  [
    'RF_RESPUESTA with jugador 3',
    { tipo: 'RF_RESPUESTA', jugador: 3, pregunta: 0, indice: 0, texto: 'perro' },
  ],
  [
    'RF_RESPUESTA with a text jugador',
    { tipo: 'RF_RESPUESTA', jugador: '1', pregunta: 0, indice: 0, texto: 'perro' },
  ],
  [
    'RF_RESPUESTA with pregunta 5',
    { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 5, indice: 0, texto: 'perro' },
  ],
  ['RF_REVELAR without jugador', { tipo: 'RF_REVELAR', pregunta: 0 }],
  ['RF_REVELAR without pregunta', { tipo: 'RF_REVELAR', jugador: 1 }],
  ['RF_REVELAR with jugador 0', { tipo: 'RF_REVELAR', jugador: 0, pregunta: 0 }],
  ['RF_REVELAR with pregunta -1', { tipo: 'RF_REVELAR', jugador: 1, pregunta: -1 }],
  ['an unknown tipo', { tipo: 'NO_EXISTE' }],
  ['DESHACER, which is never stored', { tipo: 'DESHACER' }],
  ['a numeric tipo', { tipo: 42 }],
  ['an object without tipo', {}],
  ['null', null],
  ['undefined', undefined],
  ['a string', 'TACHE'],
  ['a number', 7],
  ['an array', [{ tipo: 'TACHE' }]],
];

describe('esquemaEvento', () => {
  it.each(VALIDOS)('accepts $tipo', (evento) => {
    expect(esquemaEvento.safeParse(evento)).toEqual({ success: true, data: evento });
  });

  it.each(MALFORMADOS)('rejects %s', (_descripcion, valor) => {
    expect(esquemaEvento.safeParse(valor).success).toBe(false);
  });

  it('drops unknown keys', () => {
    expect(esquemaEvento.parse({ tipo: 'TACHE', equipo: 1 })).toEqual({ tipo: 'TACHE' });
  });

  it('accepts every event of valid games, so stored logs always replay in full', () => {
    const logs = [
      partidaDosEquipos(200).eventos,
      ...[2, 3, 4].map((equipos) =>
        generarPartida(crearConfig({ equipos, rondaFinal: true }), 7 * equipos, 220),
      ),
    ];
    for (const evento of logs.flat()) {
      expect(esquemaEvento.safeParse(evento)).toEqual({ success: true, data: evento });
    }
  });

  it('matches the Evento type in both directions', () => {
    expectTypeOf<z.output<typeof esquemaEvento>>().toExtend<Evento>();
    expectTypeOf<Evento>().toExtend<z.output<typeof esquemaEvento>>();
  });
});

describe('esquemaConfigPartida', () => {
  it.each([crearConfig(), crearConfig({ equipos: 4, rondaFinal: true })])(
    'accepts a config snapshot',
    (config) => {
      expect(esquemaConfigPartida.parse(config)).toEqual(config);
    },
  );

  it('matches the ConfigPartida type', () => {
    expectTypeOf<z.output<typeof esquemaConfigPartida>>().toExtend<ConfigPartida>();
  });
});
