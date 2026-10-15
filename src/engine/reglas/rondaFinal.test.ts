import { describe, expect, it } from 'vitest';

import { validar } from '../index';
import type { Evento, Jugador } from '../index';
import { caraACaraGanado, crearConfig, jugar, tachas } from '../prueba/fabricas';

const config = crearConfig({ multiplicadores: [1], rondaFinal: true, meta: 100 });
/** Team B banks 40 on a failed steal, then the final round starts. */
const enRondaFinal: Evento[] = [
  ...caraACaraGanado(1),
  { tipo: 'JUGAR' },
  ...tachas(3),
  { tipo: 'ROBO_FALLIDO' },
  { tipo: 'SIGUIENTE_RONDA' },
];

function respuesta(
  jugador: Jugador,
  pregunta: number,
  indice: number | null,
  texto = `dijo ${String(jugador)}-${String(pregunta)}`,
): Evento {
  return { tipo: 'RF_RESPUESTA', jugador, pregunta, indice, texto };
}

function revelar(jugador: Jugador, pregunta: number): Evento {
  return { tipo: 'RF_REVELAR', jugador, pregunta };
}

function codigoTras(eventos: Evento[], evento: Evento) {
  return validar(config, jugar(config, eventos), evento);
}

describe('ronda final: start', () => {
  it('follows the last round and is played by the highest score', () => {
    const estado = jugar(config, enRondaFinal);
    expect(estado.fase).toBe('rondaFinal');
    expect(estado.ronda).toBeNull();
    expect(estado.rondaFinal).toEqual({
      equipo: 1,
      jugadorActual: 1,
      jugador1: [null, null, null, null, null],
      jugador2: [null, null, null, null, null],
      resultado: null,
    });
  });

  it('breaks score ties in favor of the lowest team index', () => {
    const estado = jugar(config, [
      ...enRondaFinal.slice(0, -1),
      { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 40 },
      { tipo: 'SIGUIENTE_RONDA' },
    ]);
    expect(estado.rondaFinal?.equipo).toBe(0);
  });

  it('picks the leader among 4 teams', () => {
    const cfg = crearConfig({ equipos: 4, multiplicadores: [1], rondaFinal: true });
    const estado = jugar(cfg, [
      ...caraACaraGanado(3),
      { tipo: 'PASAR', equipo: 2 },
      ...tachas(3),
      { tipo: 'ASIGNAR_TURNO', equipo: 3 },
      { tipo: 'ROBO_EXITOSO', indice: 4 },
      { tipo: 'SIGUIENTE_RONDA' },
    ]);
    expect(estado.puntajes).toEqual([0, 0, 0, 48]);
    expect(estado.rondaFinal?.equipo).toBe(3);
  });
});

describe('ronda final: ASIGNAR_TURNO', () => {
  it('changes the playing team before any answer', () => {
    expect(
      jugar(config, [...enRondaFinal, { tipo: 'ASIGNAR_TURNO', equipo: 0 }]).rondaFinal,
    ).toMatchObject({ equipo: 0 });
  });

  it('is rejected once an answer exists or for an unknown team', () => {
    expect(
      codigoTras([...enRondaFinal, respuesta(1, 0, 1)], { tipo: 'ASIGNAR_TURNO', equipo: 0 }),
    ).toMatchObject({ codigo: 'RONDA_FINAL_INICIADA' });
    expect(codigoTras(enRondaFinal, { tipo: 'ASIGNAR_TURNO', equipo: 2 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
  });
});

describe('ronda final: RF_RESPUESTA', () => {
  it('records what the player said, matched or not', () => {
    const estado = jugar(config, [
      ...enRondaFinal,
      respuesta(1, 0, 2, 'perro'),
      respuesta(1, 4, null, 'no sé'),
    ]);
    expect(estado.rondaFinal?.jugador1).toEqual([
      { indice: 2, texto: 'perro', revelada: false },
      null,
      null,
      null,
      { indice: null, texto: 'no sé', revelada: false },
    ]);
  });

  it('replaces a previous answer for the same player and question', () => {
    const estado = jugar(config, [
      ...enRondaFinal,
      respuesta(1, 1, 0, 'gato'),
      revelar(1, 1),
      respuesta(1, 1, 3, 'pez'),
    ]);
    expect(estado.rondaFinal?.jugador1[1]).toEqual({ indice: 3, texto: 'pez', revelada: false });
  });

  it('only accepts the player in turn', () => {
    expect(codigoTras(enRondaFinal, respuesta(2, 0, 1))).toMatchObject({
      codigo: 'JUGADOR_INVALIDO',
    });
    expect(
      codigoTras([...enRondaFinal, { tipo: 'RF_SIGUIENTE_JUGADOR' }], respuesta(1, 0, 1)),
    ).toMatchObject({ codigo: 'JUGADOR_INVALIDO' });
    expect(codigoTras(enRondaFinal, respuesta(3 as Jugador, 0, 1))).toMatchObject({
      codigo: 'JUGADOR_INVALIDO',
    });
  });

  it.each([-1, 5, 1.5])('rejects question %s', (pregunta) => {
    expect(codigoTras(enRondaFinal, respuesta(1, pregunta, 0))).toMatchObject({
      codigo: 'PREGUNTA_INVALIDA',
    });
  });

  it.each([-1, 4, 0.5])('rejects answer index %s', (indice) => {
    expect(codigoTras(enRondaFinal, respuesta(1, 0, indice))).toMatchObject({
      codigo: 'RESPUESTA_INVALIDA',
    });
  });

  it('rejects a missing text', () => {
    const evento = { tipo: 'RF_RESPUESTA', jugador: 1, pregunta: 0, indice: 0 } as Evento;
    expect(codigoTras(enRondaFinal, evento)).toEqual({
      ok: false,
      codigo: 'TEXTO_INVALIDO',
      motivo: 'Escribe lo que respondió el jugador.',
    });
  });

  it("rejects player 2 repeating player 1's matched answer on the same question", () => {
    const eventos: Evento[] = [
      ...enRondaFinal,
      respuesta(1, 0, 1),
      respuesta(1, 1, null),
      { tipo: 'RF_SIGUIENTE_JUGADOR' },
    ];
    expect(codigoTras(eventos, respuesta(2, 0, 1))).toEqual({
      ok: false,
      codigo: 'RESPUESTA_REPETIDA',
      motivo: 'El primer jugador ya dio esa respuesta. Pide otra.',
    });
    expect(codigoTras(eventos, respuesta(2, 0, 2))).toEqual({ ok: true });
    expect(codigoTras(eventos, respuesta(2, 2, 1))).toEqual({ ok: true });
    expect(codigoTras(eventos, respuesta(2, 1, null))).toEqual({ ok: true });
  });
});

describe('ronda final: RF_REVELAR', () => {
  it('reveals an existing answer', () => {
    const estado = jugar(config, [...enRondaFinal, respuesta(1, 2, 0), revelar(1, 2)]);
    expect(estado.rondaFinal?.jugador1[2]).toMatchObject({ revelada: true });
  });

  it("can reveal player 1's answers while player 2 plays", () => {
    const estado = jugar(config, [
      ...enRondaFinal,
      respuesta(1, 2, 0),
      { tipo: 'RF_SIGUIENTE_JUGADOR' },
      revelar(1, 2),
    ]);
    expect(estado.rondaFinal?.jugador1[2]).toMatchObject({ revelada: true });
  });

  it('requires an existing, hidden answer from a valid player and question', () => {
    const eventos: Evento[] = [...enRondaFinal, respuesta(1, 2, 0), revelar(1, 2)];
    expect(codigoTras(eventos, revelar(1, 3))).toMatchObject({ codigo: 'SIN_RESPUESTA' });
    expect(codigoTras(eventos, revelar(2, 2))).toMatchObject({ codigo: 'SIN_RESPUESTA' });
    expect(codigoTras(eventos, revelar(1, 2))).toMatchObject({ codigo: 'RESPUESTA_YA_REVELADA' });
    expect(codigoTras(eventos, revelar(1, 7))).toMatchObject({ codigo: 'PREGUNTA_INVALIDA' });
    expect(codigoTras(eventos, revelar(0 as Jugador, 2))).toMatchObject({
      codigo: 'JUGADOR_INVALIDO',
    });
  });
});

describe('ronda final: RF_SIGUIENTE_JUGADOR', () => {
  it('switches from player 1 to player 2 only once', () => {
    const eventos: Evento[] = [...enRondaFinal, { tipo: 'RF_SIGUIENTE_JUGADOR' }];
    expect(jugar(config, eventos).rondaFinal?.jugadorActual).toBe(2);
    expect(codigoTras(eventos, { tipo: 'RF_SIGUIENTE_JUGADOR' })).toMatchObject({
      codigo: 'JUGADOR_INVALIDO',
    });
  });
});

describe('ronda final: RF_TERMINAR', () => {
  const jugada: Evento[] = [
    ...enRondaFinal,
    respuesta(1, 0, 0),
    revelar(1, 0),
    respuesta(1, 1, 3),
    revelar(1, 1),
    respuesta(1, 2, null),
    revelar(1, 2),
    respuesta(1, 3, 1),
    { tipo: 'RF_SIGUIENTE_JUGADOR' },
    respuesta(2, 0, 1),
    revelar(2, 0),
    respuesta(2, 3, 2),
    revelar(2, 3),
  ];

  it('sums only revealed answers, compares with the goal and adds the total to the team', () => {
    // Revealed: 50 + 5 + 0 (no match) + 30 + 15; player 1's unrevealed 30 does not count.
    const estado = jugar(config, [...jugada, { tipo: 'RF_TERMINAR' }]);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.rondaFinal?.resultado).toEqual({ total: 100, meta: 100, superoMeta: true });
    // Team B played the final round with 40 points.
    expect(estado.puntajes).toEqual([0, 140]);
  });

  it('adds the total even when it is below the goal', () => {
    const estado = jugar(config, [...jugada.slice(0, -1), { tipo: 'RF_TERMINAR' }]);
    expect(estado.rondaFinal?.resultado).toEqual({ total: 85, meta: 100, superoMeta: false });
    expect(estado.puntajes).toEqual([0, 125]);
  });

  it('adds the total to the team assigned with ASIGNAR_TURNO', () => {
    const estado = jugar(config, [
      ...enRondaFinal,
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      respuesta(1, 0, 1),
      revelar(1, 0),
      { tipo: 'RF_TERMINAR' },
    ]);
    expect(estado.puntajes).toEqual([30, 40]);
  });

  it('TERMINAR_JUEGO ends the final round without a result and adds nothing', () => {
    const estado = jugar(config, [...jugada, { tipo: 'TERMINAR_JUEGO' }]);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.rondaFinal?.resultado).toBeNull();
    expect(estado.puntajes).toEqual([0, 40]);
  });
});

describe('ronda final: other events', () => {
  it('allows score adjustments', () => {
    const estado = jugar(config, [
      ...enRondaFinal,
      { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 10 },
    ]);
    expect(estado.puntajes).toEqual([10, 40]);
    expect(estado.fase).toBe('rondaFinal');
  });

  it.each<Evento>([
    { tipo: 'REVELAR', indice: 0 },
    { tipo: 'TACHE' },
    { tipo: 'JUGAR' },
    { tipo: 'ROBO_FALLIDO' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'SIGUIENTE_RONDA' },
  ])('rejects $tipo with FASE_INVALIDA', (evento) => {
    expect(codigoTras(enRondaFinal, evento)).toMatchObject({ codigo: 'FASE_INVALIDA' });
  });

  it.each<Evento>([respuesta(1, 0, 0), revelar(1, 0)])(
    'rejects $tipo outside the final round',
    (evento) => {
      expect(codigoTras(caraACaraGanado(0), evento)).toMatchObject({ codigo: 'FASE_INVALIDA' });
    },
  );
});
