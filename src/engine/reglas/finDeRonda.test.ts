import { describe, expect, it } from 'vitest';

import { validar } from '../index';
import type { Evento } from '../index';
import { caraACaraGanado, crearConfig, jugar, tachas } from '../prueba/fabricas';

const config = crearConfig({ multiplicadores: [1, 2] });
/** Round 1 ends on a failed steal: team 0 banks 40 + 25. */
const ronda1Terminada: Evento[] = [
  ...caraACaraGanado(0),
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 1 },
  ...tachas(3),
  { tipo: 'ROBO_FALLIDO' },
];

describe('fin de ronda: REVELAR_TODAS', () => {
  it('reveals the remaining answers without adding points', () => {
    const estado = jugar(config, [...ronda1Terminada, { tipo: 'REVELAR_TODAS' }]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.ronda).toMatchObject({
      bolsa: 65,
      puntosOtorgados: 65,
      respuestas: [
        'revelada',
        'revelada',
        'reveladaSinPuntos',
        'reveladaSinPuntos',
        'reveladaSinPuntos',
      ],
    });
    expect(estado.puntajes).toEqual([65, 0]);
  });

  it('is rejected when nothing is hidden', () => {
    const estado = jugar(config, [...ronda1Terminada, { tipo: 'REVELAR_TODAS' }]);
    expect(validar(config, estado, { tipo: 'REVELAR_TODAS' })).toMatchObject({
      codigo: 'SIN_RESPUESTAS_OCULTAS',
    });
  });
});

describe('fin de ronda: SIGUIENTE_RONDA', () => {
  it('starts the next face-off with a fresh round and keeps the scores', () => {
    const estado = jugar(config, [...ronda1Terminada, { tipo: 'SIGUIENTE_RONDA' }]);
    expect(estado.fase).toBe('caraACara');
    expect(estado.puntajes).toEqual([65, 0]);
    expect(estado.ronda).toEqual({
      indice: 1,
      respuestas: ['oculta', 'oculta', 'oculta', 'oculta', 'oculta'],
      bolsa: 0,
      tachas: 0,
      caraACara: { intentos: [], respondedor: null, ganador: null },
      equipoControl: null,
      equipoRobo: null,
      ganador: null,
      puntosOtorgados: null,
    });
  });

  it('ends the game after the last round when there is no final round', () => {
    const cfg = crearConfig({ multiplicadores: [1] });
    const estado = jugar(cfg, [...ronda1Terminada, { tipo: 'SIGUIENTE_RONDA' }]);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.ronda).toBeNull();
    expect(estado.rondaFinal).toBeNull();
    expect(estado.puntajes).toEqual([65, 0]);
  });

  it('is only valid at the end of a round', () => {
    expect(
      validar(config, jugar(config, caraACaraGanado(0)), { tipo: 'SIGUIENTE_RONDA' }),
    ).toMatchObject({ codigo: 'FASE_INVALIDA' });
  });
});

describe('fin de ronda: other events', () => {
  it.each<Evento>([
    { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    { tipo: 'REVELAR', indice: 2 },
    { tipo: 'TACHE' },
    { tipo: 'ROBO_FALLIDO' },
    { tipo: 'RF_TERMINAR' },
  ])('rejects $tipo with FASE_INVALIDA', (evento) => {
    expect(validar(config, jugar(config, ronda1Terminada), evento)).toMatchObject({
      codigo: 'FASE_INVALIDA',
    });
  });
});
