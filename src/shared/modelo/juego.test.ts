import { describe, expect, it } from 'vitest';

import { crearJuegoPorDefecto, esquemaDatosJuego } from './juego';

describe('crearJuegoPorDefecto', () => {
  it('creates two teams, 3 strikes and the final round turned off', () => {
    const juego = crearJuegoPorDefecto({ nombre: ' Repaso 2B ', preguntaIds: ['p1'] });

    expect(juego.nombre).toBe('Repaso 2B');
    expect(juego.equipos.map((e) => [e.id, e.nombre])).toEqual([
      ['equipo-1', 'Equipo A'],
      ['equipo-2', 'Equipo B'],
    ]);
    expect(new Set(juego.equipos.map((e) => e.color)).size).toBe(2);
    expect(juego.reglas).toEqual({
      tachasMaximas: 3,
      rondaFinal: { activa: false, preguntaIds: [], segundos: [20, 25], meta: 200 },
    });
  });

  it('uses up to 4 questions in the given order, x2 on round 3 and x3 on round 4', () => {
    const juego = crearJuegoPorDefecto({
      nombre: 'Juego',
      preguntaIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
    });

    expect(juego.rondas).toEqual([
      { preguntaId: 'p1', multiplicador: 1 },
      { preguntaId: 'p2', multiplicador: 1 },
      { preguntaId: 'p3', multiplicador: 2 },
      { preguntaId: 'p4', multiplicador: 3 },
    ]);
  });

  it('keeps every round at x1 when there are fewer than 4 rounds', () => {
    const juego = crearJuegoPorDefecto({ nombre: 'Juego', preguntaIds: ['p1', 'p2', 'p3'] });

    expect(juego.rondas.map((r) => r.multiplicador)).toEqual([1, 1, 1]);
  });

  it('produces data that passes the game schema', () => {
    const juego = crearJuegoPorDefecto({ nombre: 'Juego', preguntaIds: ['p1', 'p2'] });

    expect(esquemaDatosJuego.parse(juego)).toEqual(juego);
  });
});

describe('esquemaDatosJuego', () => {
  const base = crearJuegoPorDefecto({ nombre: 'Juego', preguntaIds: ['p1'] });

  it('requires between 2 and 4 teams', () => {
    const [equipo] = base.equipos;
    if (!equipo) {
      throw new Error('missing team');
    }
    const cinco = Array.from({ length: 5 }, (_, i) => ({ ...equipo, id: `e${String(i)}` }));

    expect(esquemaDatosJuego.safeParse({ ...base, equipos: [equipo] }).success).toBe(false);
    expect(esquemaDatosJuego.safeParse({ ...base, equipos: cinco }).success).toBe(false);
  });

  it('only accepts multipliers 1, 2 or 3 and a non-blank name', () => {
    expect(
      esquemaDatosJuego.safeParse({ ...base, rondas: [{ preguntaId: 'p1', multiplicador: 4 }] })
        .success,
    ).toBe(false);
    expect(esquemaDatosJuego.safeParse({ ...base, nombre: '  ' }).error?.issues[0]?.message).toBe(
      'Escribe el nombre del juego.',
    );
  });
});
