import { describe, expect, it } from 'vitest';

import { aplicar, crearEstadoInicial, validar } from '../index';
import type { ConfigPartida, Evento } from '../index';
import { caraACaraGanado, congelar, crearConfig, crearPregunta, jugar } from '../prueba/fabricas';

const config = crearConfig();

function rechazoTras(cfg: ConfigPartida, eventos: Evento[], evento: Evento) {
  return validar(cfg, jugar(cfg, eventos), evento);
}

describe('cara a cara: ASIGNAR_TURNO', () => {
  it('makes the team that buzzed the responder', () => {
    const estado = jugar(config, [{ tipo: 'ASIGNAR_TURNO', equipo: 1 }]);
    expect(estado.fase).toBe('caraACara');
    expect(estado.ronda?.caraACara.respondedor).toBe(1);
  });

  it('replaces a responder that has not answered yet', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
    ]);
    expect(estado.ronda?.caraACara.respondedor).toBe(0);
    expect(estado.ronda?.caraACara.intentos).toEqual([]);
  });

  it.each([-1, 2, 0.5, Number.NaN])('rejects team %s', (equipo) => {
    expect(rechazoTras(config, [], { tipo: 'ASIGNAR_TURNO', equipo })).toMatchObject({
      ok: false,
      codigo: 'EQUIPO_INVALIDO',
    });
  });

  it('after resolution, corrects the face-off winner', () => {
    const estado = jugar(config, [...caraACaraGanado(0), { tipo: 'ASIGNAR_TURNO', equipo: 1 }]);
    expect(estado.ronda?.caraACara.ganador).toBe(1);
    expect(
      jugar(config, [
        ...caraACaraGanado(0),
        { tipo: 'ASIGNAR_TURNO', equipo: 1 },
        { tipo: 'JUGAR' },
      ]).ronda?.equipoControl,
    ).toBe(1);
  });
});

describe('cara a cara: REVELAR and TACHE', () => {
  it('requires a responder', () => {
    expect(rechazoTras(config, [], { tipo: 'REVELAR', indice: 0 })).toMatchObject({
      codigo: 'SIN_RESPONDEDOR',
    });
    expect(rechazoTras(config, [], { tipo: 'TACHE' })).toMatchObject({
      codigo: 'SIN_RESPONDEDOR',
    });
  });

  it('resolves immediately when the responder reveals the top answer', () => {
    const estado = jugar(config, caraACaraGanado(1));
    expect(estado.ronda).toMatchObject({
      bolsa: 40,
      respuestas: ['revelada', 'oculta', 'oculta', 'oculta', 'oculta'],
      caraACara: { intentos: [{ equipo: 1, indice: 0 }], respondedor: null, ganador: 1 },
    });
  });

  it('waits for a second attempt after a hit that is not the top answer', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 2 },
    ]);
    expect(estado.ronda?.caraACara).toEqual({
      intentos: [{ equipo: 0, indice: 2 }],
      respondedor: null,
      ganador: null,
    });
    expect(estado.ronda?.bolsa).toBe(15);
  });

  it('gives the win to the highest-points hit', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 1 },
    ]);
    expect(estado.ronda?.caraACara.ganador).toBe(1);
    expect(estado.ronda?.bolsa).toBe(40);
  });

  it('keeps the first hit as winner when the second attempt misses', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'TACHE' },
    ]);
    expect(estado.ronda?.caraACara.ganador).toBe(1);
    expect(estado.ronda?.caraACara.intentos).toEqual([
      { equipo: 1, indice: 3 },
      { equipo: 0, indice: null },
    ]);
  });

  it('breaks point ties in favor of the earliest attempt', () => {
    const empate: ConfigPartida = congelar({
      ...config,
      rondas: [{ pregunta: crearPregunta('E', [40, 20, 20, 5]), multiplicador: 1 }],
    });
    const estado = jugar(empate, [
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 1 },
    ]);
    expect(estado.ronda?.caraACara.ganador).toBe(1);
  });

  it('keeps going while every attempt misses, without counting strikes', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'TACHE' },
    ]);
    expect(estado.fase).toBe('caraACara');
    expect(estado.ronda?.caraACara.ganador).toBeNull();
    expect(estado.ronda?.caraACara.intentos).toHaveLength(3);
    expect(estado.ronda?.tachas).toBe(0);
  });

  it('resolves on a later attempt after earlier misses', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 4 },
    ]);
    expect(estado.ronda?.caraACara.ganador).toBe(1);
  });

  it('rejects unknown and already revealed answers', () => {
    const eventos: Evento[] = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    ];
    expect(rechazoTras(config, eventos, { tipo: 'REVELAR', indice: 2 })).toMatchObject({
      codigo: 'RESPUESTA_YA_REVELADA',
    });
    expect(rechazoTras(config, eventos, { tipo: 'REVELAR', indice: 5 })).toMatchObject({
      codigo: 'RESPUESTA_INVALIDA',
    });
    expect(rechazoTras(config, eventos, { tipo: 'REVELAR', indice: -1 })).toMatchObject({
      codigo: 'RESPUESTA_INVALIDA',
    });
  });

  it('rejects more answers once resolved', () => {
    const eventos = [...caraACaraGanado(0), { tipo: 'ASIGNAR_TURNO', equipo: 1 } as const];
    expect(rechazoTras(config, caraACaraGanado(0), { tipo: 'TACHE' })).toMatchObject({
      codigo: 'CARA_A_CARA_RESUELTO',
    });
    expect(rechazoTras(config, eventos, { tipo: 'REVELAR', indice: 1 })).toMatchObject({
      codigo: 'CARA_A_CARA_RESUELTO',
    });
  });
});

describe('cara a cara: JUGAR and PASAR', () => {
  it('JUGAR gives control to the winner and keeps face-off answers and pot', () => {
    const estado = jugar(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
    ]);
    expect(estado.fase).toBe('enJuego');
    expect(estado.ronda).toMatchObject({
      equipoControl: 1,
      tachas: 0,
      bolsa: 52,
      respuestas: ['revelada', 'oculta', 'oculta', 'revelada', 'oculta'],
    });
  });

  it('JUGAR and PASAR need a face-off winner', () => {
    const eventos: Evento[] = [{ tipo: 'ASIGNAR_TURNO', equipo: 0 }];
    expect(rechazoTras(config, eventos, { tipo: 'JUGAR' })).toMatchObject({
      codigo: 'SIN_GANADOR_CARA_A_CARA',
    });
    expect(rechazoTras(config, eventos, { tipo: 'PASAR' })).toMatchObject({
      codigo: 'SIN_GANADOR_CARA_A_CARA',
    });
  });

  it('PASAR with 2 teams defaults to the other team', () => {
    expect(jugar(config, [...caraACaraGanado(0), { tipo: 'PASAR' }]).ronda?.equipoControl).toBe(1);
    expect(jugar(config, [...caraACaraGanado(1), { tipo: 'PASAR' }]).ronda?.equipoControl).toBe(0);
    const estado = jugar(config, [...caraACaraGanado(0), { tipo: 'PASAR', equipo: 1 }]);
    expect(estado.fase).toBe('enJuego');
    expect(estado.ronda?.equipoControl).toBe(1);
  });

  it('PASAR cannot target the winner or an unknown team', () => {
    expect(rechazoTras(config, caraACaraGanado(0), { tipo: 'PASAR', equipo: 0 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
    expect(rechazoTras(config, caraACaraGanado(0), { tipo: 'PASAR', equipo: 2 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
  });

  it('PASAR with 3-4 teams requires a team other than the winner', () => {
    for (const equipos of [3, 4]) {
      const cfg = crearConfig({ equipos });
      expect(rechazoTras(cfg, caraACaraGanado(2), { tipo: 'PASAR' })).toMatchObject({
        codigo: 'PASAR_REQUIERE_EQUIPO',
      });
      expect(rechazoTras(cfg, caraACaraGanado(2), { tipo: 'PASAR', equipo: 2 })).toMatchObject({
        codigo: 'EQUIPO_INVALIDO',
      });
      expect(
        rechazoTras(cfg, caraACaraGanado(2), { tipo: 'PASAR', equipo: equipos }),
      ).toMatchObject({ codigo: 'EQUIPO_INVALIDO' });
      const estado = jugar(cfg, [...caraACaraGanado(2), { tipo: 'PASAR', equipo: 0 }]);
      expect(estado.ronda?.equipoControl).toBe(0);
    }
  });
});

describe('cara a cara: board cleared during the face-off', () => {
  /** A two-answer question (40, 20) at x2: both answers are revealed by the face-off. */
  function corta(equipos: number): ConfigPartida {
    return congelar({
      ...crearConfig({ equipos }),
      rondas: [{ pregunta: crearPregunta('C', [40, 20]), multiplicador: 2 }],
    });
  }
  /** Team 0 hits #2, team 1 hits #1 and wins; nothing is left hidden (pot 60). */
  const tableroLimpio: Evento[] = [
    { tipo: 'ASIGNAR_TURNO', equipo: 0 },
    { tipo: 'REVELAR', indice: 1 },
    { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    { tipo: 'REVELAR', indice: 0 },
  ];

  it('JUGAR awards pot x multiplier to the winner and ends the round', () => {
    const estado = jugar(corta(2), [...tableroLimpio, { tipo: 'JUGAR' }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.puntajes).toEqual([0, 120]);
    expect(estado.ronda).toMatchObject({ equipoControl: 1, ganador: 1, puntosOtorgados: 120 });
  });

  it('PASAR with 2 teams awards the pot to the other team', () => {
    const estado = jugar(corta(2), [...tableroLimpio, { tipo: 'PASAR' }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.puntajes).toEqual([120, 0]);
    expect(estado.ronda).toMatchObject({ equipoControl: 0, ganador: 0, puntosOtorgados: 120 });
  });

  it('PASAR(equipo) with 3 teams awards the pot to the chosen team', () => {
    const estado = jugar(corta(3), [...tableroLimpio, { tipo: 'PASAR', equipo: 2 }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.puntajes).toEqual([0, 0, 120]);
    expect(estado.ronda).toMatchObject({ equipoControl: 2, ganador: 2, puntosOtorgados: 120 });
  });
});

describe('cara a cara: other events', () => {
  it.each<Evento>([
    { tipo: 'ROBO_EXITOSO', indice: 1 },
    { tipo: 'ROBO_FALLIDO' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'SIGUIENTE_RONDA' },
    { tipo: 'RF_SIGUIENTE_JUGADOR' },
    { tipo: 'RF_TERMINAR' },
  ])('rejects $tipo with FASE_INVALIDA', (evento) => {
    expect(validar(config, crearEstadoInicial(config), evento)).toMatchObject({
      ok: false,
      codigo: 'FASE_INVALIDA',
    });
  });

  it('aplicar throws for an invalid event and applies a valid one', () => {
    const inicial = congelar(crearEstadoInicial(config));
    expect(() => aplicar(config, inicial, { tipo: 'JUGAR' })).toThrow(
      'El cara a cara todavía no tiene ganador.',
    );
    expect(
      aplicar(config, inicial, { tipo: 'ASIGNAR_TURNO', equipo: 0 }).ronda?.caraACara,
    ).toMatchObject({ respondedor: 0 });
  });
});
