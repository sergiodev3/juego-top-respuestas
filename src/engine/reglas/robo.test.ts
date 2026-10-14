import { describe, expect, it } from 'vitest';

import { validar } from '../index';
import type { Evento } from '../index';
import { caraACaraGanado, crearConfig, jugar, tachas } from '../prueba/fabricas';

const dosEquipos = crearConfig({ multiplicadores: [3] });
const tresEquipos = crearConfig({ equipos: 3, multiplicadores: [2] });
/** Team 0 controls with 40 + 15 in the pot and strikes out. */
const enRobo: Evento[] = [
  ...caraACaraGanado(0),
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 2 },
  ...tachas(3),
];

describe('robo: ASIGNAR_TURNO', () => {
  it('sets the stealing team with 3-4 teams', () => {
    const estado = jugar(tresEquipos, [...enRobo, { tipo: 'ASIGNAR_TURNO', equipo: 2 }]);
    expect(estado.ronda?.equipoRobo).toBe(2);
    const corregido = jugar(tresEquipos, [
      ...enRobo,
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    ]);
    expect(corregido.ronda?.equipoRobo).toBe(1);
  });

  it('rejects the control team and unknown teams', () => {
    const estado = jugar(tresEquipos, enRobo);
    expect(validar(tresEquipos, estado, { tipo: 'ASIGNAR_TURNO', equipo: 0 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
    expect(validar(tresEquipos, estado, { tipo: 'ASIGNAR_TURNO', equipo: 3 })).toMatchObject({
      codigo: 'EQUIPO_INVALIDO',
    });
  });

  it('accepts re-confirming the other team with 2 teams', () => {
    const estado = jugar(dosEquipos, [...enRobo, { tipo: 'ASIGNAR_TURNO', equipo: 1 }]);
    expect(estado.ronda?.equipoRobo).toBe(1);
  });
});

describe('robo: ROBO_EXITOSO', () => {
  it('reveals the answer and awards the whole pot x multiplier to the stealing team', () => {
    const estado = jugar(dosEquipos, [...enRobo, { tipo: 'ROBO_EXITOSO', indice: 1 }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.ronda).toMatchObject({
      bolsa: 80,
      ganador: 1,
      puntosOtorgados: 240,
      respuestas: ['revelada', 'revelada', 'revelada', 'oculta', 'oculta'],
    });
    expect(estado.puntajes).toEqual([0, 240]);
  });

  it('works with an assigned stealing team among 3 teams', () => {
    const estado = jugar(tresEquipos, [
      ...enRobo,
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'ROBO_EXITOSO', indice: 4 },
    ]);
    expect(estado.puntajes).toEqual([0, 0, 126]);
  });

  it('rejects hidden-answer violations', () => {
    const estado = jugar(dosEquipos, enRobo);
    expect(validar(dosEquipos, estado, { tipo: 'ROBO_EXITOSO', indice: 2 })).toMatchObject({
      codigo: 'RESPUESTA_YA_REVELADA',
    });
    expect(validar(dosEquipos, estado, { tipo: 'ROBO_EXITOSO', indice: 5 })).toMatchObject({
      codigo: 'RESPUESTA_INVALIDA',
    });
  });
});

describe('robo: ROBO_FALLIDO', () => {
  it('awards the pot x multiplier to the control team', () => {
    const estado = jugar(dosEquipos, [...enRobo, { tipo: 'ROBO_FALLIDO' }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.ronda).toMatchObject({ ganador: 0, puntosOtorgados: 165 });
    expect(estado.puntajes).toEqual([165, 0]);
  });
});

describe('robo: stealing team required', () => {
  it.each<Evento>([{ tipo: 'ROBO_EXITOSO', indice: 1 }, { tipo: 'ROBO_FALLIDO' }])(
    '$tipo needs a stealing team',
    (evento) => {
      expect(validar(tresEquipos, jugar(tresEquipos, enRobo), evento)).toMatchObject({
        codigo: 'SIN_EQUIPO_ROBO',
      });
    },
  );
});

describe('robo: other events', () => {
  it.each<Evento>([
    { tipo: 'REVELAR', indice: 1 },
    { tipo: 'TACHE' },
    { tipo: 'JUGAR' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'SIGUIENTE_RONDA' },
  ])('rejects $tipo with FASE_INVALIDA', (evento) => {
    expect(validar(dosEquipos, jugar(dosEquipos, enRobo), evento)).toMatchObject({
      codigo: 'FASE_INVALIDA',
    });
  });
});
