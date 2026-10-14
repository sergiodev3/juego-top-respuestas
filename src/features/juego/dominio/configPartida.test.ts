import { describe, expect, it } from 'vitest';

import {
  crearJuegoPorDefecto,
  type DatosJuego,
  type Pregunta,
  type SetPreguntas,
} from '@/shared/modelo';
import { preguntaBancoPrueba } from '@/test/fabricasPartida';

import { crearConfigPartida, crearJuegoRapido } from './configPartida';

function porId(preguntas: readonly Pregunta[]): ReadonlyMap<string, Pregunta> {
  return new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));
}

function juegoCon(cambios: Partial<DatosJuego> = {}): DatosJuego {
  return { ...crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: ['p1', 'p2'] }), ...cambios };
}

const SET: SetPreguntas = {
  id: 'set-1',
  nombre: 'Ciencias',
  materia: '',
  grupo: '',
  creadoEn: 1,
  actualizadoEn: 1,
  eliminadoEn: null,
};

describe('crearConfigPartida', () => {
  it('snapshots teams, rounds with their questions and multipliers, and strikes', () => {
    const resultado = crearConfigPartida(
      juegoCon({
        rondas: [
          { preguntaId: 'p2', multiplicador: 1 },
          { preguntaId: 'p1', multiplicador: 3 },
        ],
      }),
      porId([preguntaBancoPrueba('p1'), preguntaBancoPrueba('p2', { tema: 'Animales' })]),
    );

    expect(resultado).toEqual({
      ok: true,
      config: {
        nombre: 'Repaso',
        equipos: [
          { id: 'equipo-1', nombre: 'Equipo A', color: '#1d4ed8' },
          { id: 'equipo-2', nombre: 'Equipo B', color: '#b91c1c' },
        ],
        rondas: [
          {
            multiplicador: 1,
            pregunta: {
              id: 'p2',
              tema: 'Animales',
              texto: 'Texto p2',
              respuestas: [
                { texto: 'Primera p2', puntos: 50, sinonimos: ['uno'] },
                { texto: 'Segunda p2', puntos: 30, sinonimos: [] },
              ],
            },
          },
          {
            multiplicador: 3,
            pregunta: {
              id: 'p1',
              tema: 'General',
              texto: 'Texto p1',
              respuestas: [
                { texto: 'Primera p1', puntos: 50, sinonimos: ['uno'] },
                { texto: 'Segunda p1', puntos: 30, sinonimos: [] },
              ],
            },
          },
        ],
        tachasMaximas: 3,
        rondaFinal: null,
      },
    });
  });

  it('copies the questions, so later bank edits do not change the snapshot', () => {
    const pregunta = preguntaBancoPrueba('p1');
    const resultado = crearConfigPartida(
      juegoCon({ rondas: [{ preguntaId: 'p1', multiplicador: 1 }] }),
      porId([pregunta]),
    );
    pregunta.respuestas[0]?.sinonimos.push('cambio');
    pregunta.texto = 'Editada';

    expect(resultado.ok && resultado.config.rondas[0]?.pregunta).toMatchObject({
      texto: 'Texto p1',
      respuestas: [{ sinonimos: ['uno'] }, { sinonimos: [] }],
    });
  });

  it('includes the final round with its five questions, seconds and goal when active', () => {
    const ids = ['f1', 'f2', 'f3', 'f4', 'f5'];
    const juego = juegoCon();
    const resultado = crearConfigPartida(
      {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: { activa: true, preguntaIds: ids, segundos: [15, 30], meta: 180 },
        },
      },
      porId([...['p1', 'p2', ...ids].map((id) => preguntaBancoPrueba(id))]),
    );

    expect(resultado.ok).toBe(true);
    const rondaFinal = resultado.ok ? resultado.config.rondaFinal : null;
    expect(rondaFinal?.preguntas.map((p) => p.id)).toEqual(ids);
    expect(rondaFinal).toMatchObject({ segundos: [15, 30], meta: 180 });
  });

  it('reports missing or deleted questions in Spanish', () => {
    const juego = juegoCon({
      rondas: [
        { preguntaId: 'p1', multiplicador: 1 },
        { preguntaId: 'borrada', multiplicador: 1 },
        { preguntaId: 'no-existe', multiplicador: 1 },
      ],
    });
    const resultado = crearConfigPartida(
      {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: { ...juego.reglas.rondaFinal, activa: true, preguntaIds: ['x1'] },
        },
      },
      porId([preguntaBancoPrueba('p1'), preguntaBancoPrueba('borrada', { eliminadoEn: 5 })]),
    );

    expect(resultado).toEqual({
      ok: false,
      errores: [
        'La pregunta de la ronda 2 ya no está en el banco.',
        'La pregunta de la ronda 3 ya no está en el banco.',
        'La pregunta 1 de la ronda final ya no está en el banco.',
      ],
    });
  });

  it('reports engine rule problems (no rounds, final round without five questions)', () => {
    const juego = juegoCon({ rondas: [] });
    const resultado = crearConfigPartida(
      {
        ...juego,
        reglas: {
          ...juego.reglas,
          rondaFinal: { ...juego.reglas.rondaFinal, activa: true, preguntaIds: ['p1'] },
        },
      },
      porId([preguntaBancoPrueba('p1')]),
    );

    expect(resultado).toEqual({
      ok: false,
      errores: [
        'La partida necesita al menos una ronda.',
        'La ronda final necesita exactamente 5 preguntas.',
      ],
    });
  });
});

describe('crearJuegoRapido', () => {
  const preguntas = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => preguntaBancoPrueba(id));

  it('picks four random questions with x1, x1, x2, x3, two teams and no final round', () => {
    // Always picking the last remaining question takes the questions in reverse order.
    const juego = crearJuegoRapido(SET, preguntas, () => 0.99);

    expect(juego.nombre).toBe('Ciencias');
    expect(juego.equipos.map((e) => e.nombre)).toEqual(['Equipo A', 'Equipo B']);
    expect(juego.reglas.tachasMaximas).toBe(3);
    expect(juego.reglas.rondaFinal.activa).toBe(false);
    expect(juego.rondas).toEqual([
      { preguntaId: 'f', multiplicador: 1 },
      { preguntaId: 'e', multiplicador: 1 },
      { preguntaId: 'd', multiplicador: 2 },
      { preguntaId: 'c', multiplicador: 3 },
    ]);
  });

  it('is deterministic for a given random source and never repeats a question', () => {
    const secuencia = [0.5, 0.1, 0.9, 0.3];
    const fuente = () => {
      let i = 0;
      return () => secuencia[i++ % secuencia.length] ?? 0;
    };

    const primera = crearJuegoRapido(SET, preguntas, fuente());
    const segunda = crearJuegoRapido(SET, preguntas, fuente());

    expect(primera).toEqual(segunda);
    const ids = primera.rondas.map((r) => r.preguntaId);
    expect(new Set(ids).size).toBe(4);
  });

  it('uses every question of a small set (all x1) and skips deleted ones', () => {
    const pocas = [
      preguntaBancoPrueba('a'),
      preguntaBancoPrueba('b', { eliminadoEn: 3 }),
      preguntaBancoPrueba('c'),
    ];

    const juego = crearJuegoRapido(SET, pocas, () => 0);

    expect(juego.rondas).toEqual([
      { preguntaId: 'a', multiplicador: 1 },
      { preguntaId: 'c', multiplicador: 1 },
    ]);
  });
});
