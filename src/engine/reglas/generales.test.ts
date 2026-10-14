import { describe, expect, it } from 'vitest';

import { validar } from '../index';
import type { Evento } from '../index';
import { caraACaraGanado, crearConfig, definido, jugar, tachas } from '../prueba/fabricas';

const config = crearConfig({ equipos: 3, multiplicadores: [1] });

const PREFIJOS: Record<string, Evento[]> = {
  caraACara: [{ tipo: 'ASIGNAR_TURNO', equipo: 1 }],
  enJuego: [...caraACaraGanado(0), { tipo: 'JUGAR' }],
  robo: [...caraACaraGanado(0), { tipo: 'JUGAR' }, ...tachas(3)],
  finDeRonda: [
    ...caraACaraGanado(0),
    { tipo: 'JUGAR' },
    ...tachas(3),
    { tipo: 'ASIGNAR_TURNO', equipo: 2 },
    { tipo: 'ROBO_FALLIDO' },
  ],
};

describe('AJUSTAR_PUNTOS', () => {
  it.each(Object.entries(PREFIJOS))('adjusts a score during %s', (fase, prefijo) => {
    const antes = jugar(config, prefijo);
    const estado = jugar(config, [
      ...prefijo,
      { tipo: 'AJUSTAR_PUNTOS', equipo: 2, delta: 15 },
      { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: -7 },
    ]);
    expect(estado.fase).toBe(fase);
    expect(estado.puntajes).toEqual([antes.puntajes[0], -7, 15]);
    expect(estado.ronda).toEqual(antes.ronda);
  });

  it.each([0, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects delta %s', (delta) => {
    const estado = jugar(config, []);
    expect(validar(config, estado, { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta })).toMatchObject({
      codigo: 'DELTA_INVALIDO',
    });
  });

  it('rejects an unknown team', () => {
    const estado = jugar(config, []);
    expect(validar(config, estado, { tipo: 'AJUSTAR_PUNTOS', equipo: 3, delta: 5 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
  });
});

describe('TERMINAR_JUEGO', () => {
  it.each(Object.entries(PREFIJOS))('ends the game from %s', (_fase, prefijo) => {
    const antes = jugar(config, prefijo);
    const estado = jugar(config, [...prefijo, { tipo: 'TERMINAR_JUEGO' }]);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.puntajes).toEqual(antes.puntajes);
  });
});

describe('juego terminado', () => {
  const terminado = jugar(config, [...definido(PREFIJOS.finDeRonda), { tipo: 'TERMINAR_JUEGO' }]);

  it.each<Evento>([
    { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 5 },
    { tipo: 'TERMINAR_JUEGO' },
    { tipo: 'SIGUIENTE_RONDA' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'RF_TERMINAR' },
  ])('rejects $tipo', (evento) => {
    expect(validar(config, terminado, evento)).toMatchObject({
      ok: false,
      codigo: 'JUEGO_TERMINADO',
      motivo: 'El juego ya terminó.',
    });
  });
});

describe('unknown events', () => {
  it.each<unknown>([{ tipo: 'DESHACER' }, { tipo: 42 }, {}, null, 'TACHE'])(
    'rejects %j with EVENTO_DESCONOCIDO',
    (evento) => {
      expect(validar(config, jugar(config, []), evento as Evento)).toMatchObject({
        codigo: 'EVENTO_DESCONOCIDO',
      });
    },
  );
});
