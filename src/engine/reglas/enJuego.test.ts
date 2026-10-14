import { describe, expect, it } from 'vitest';

import { validar } from '../index';
import type { Evento } from '../index';
import { caraACaraGanado, crearConfig, jugar, tachas } from '../prueba/fabricas';

const config = crearConfig({ multiplicadores: [2, 1] });
/** Team 0 wins the face-off with the top answer (40 in the pot) and plays. */
const enJuego: Evento[] = [...caraACaraGanado(0), { tipo: 'JUGAR' }];

describe('en juego: REVELAR', () => {
  it('reveals a hidden answer and adds its points to the pot', () => {
    const estado = jugar(config, [...enJuego, { tipo: 'REVELAR', indice: 3 }]);
    expect(estado.fase).toBe('enJuego');
    expect(estado.ronda).toMatchObject({
      bolsa: 52,
      respuestas: ['revelada', 'oculta', 'oculta', 'revelada', 'oculta'],
    });
    expect(estado.puntajes).toEqual([0, 0]);
  });

  it('awards pot x multiplier to the control team once every answer is revealed', () => {
    const estado = jugar(config, [
      ...enJuego,
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'TACHE' },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'REVELAR', indice: 4 },
    ]);
    expect(estado.fase).toBe('finDeRonda');
    expect(estado.puntajes).toEqual([200, 0]);
    expect(estado.ronda).toMatchObject({ bolsa: 100, ganador: 0, puntosOtorgados: 200, tachas: 1 });
  });

  it('rejects unknown and already revealed answers', () => {
    const estado = jugar(config, enJuego);
    expect(validar(config, estado, { tipo: 'REVELAR', indice: 0 })).toMatchObject({
      codigo: 'RESPUESTA_YA_REVELADA',
    });
    expect(validar(config, estado, { tipo: 'REVELAR', indice: 9 })).toMatchObject({
      codigo: 'RESPUESTA_INVALIDA',
    });
  });
});

describe('en juego: TACHE', () => {
  it('counts strikes until the maximum', () => {
    const estado = jugar(config, [...enJuego, ...tachas(2)]);
    expect(estado.fase).toBe('enJuego');
    expect(estado.ronda?.tachas).toBe(2);
  });

  it('with 2 teams, the third strike opens the steal for the other team', () => {
    const estado = jugar(config, [...enJuego, ...tachas(3)]);
    expect(estado.fase).toBe('robo');
    expect(estado.ronda).toMatchObject({ tachas: 3, equipoControl: 0, equipoRobo: 1 });
  });

  it('with 3-4 teams, the stealing team stays unset', () => {
    for (const equipos of [3, 4]) {
      const cfg = crearConfig({ equipos });
      const estado = jugar(cfg, [...enJuego, ...tachas(3)]);
      expect(estado.fase).toBe('robo');
      expect(estado.ronda?.equipoRobo).toBeNull();
    }
  });

  it('honors a custom strike limit', () => {
    const cfg = crearConfig({ tachasMaximas: 1 });
    expect(jugar(cfg, [...enJuego, ...tachas(1)]).fase).toBe('robo');
  });
});

describe('en juego: other events', () => {
  it.each<Evento>([
    { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    { tipo: 'JUGAR' },
    { tipo: 'PASAR' },
    { tipo: 'ROBO_EXITOSO', indice: 1 },
    { tipo: 'ROBO_FALLIDO' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'SIGUIENTE_RONDA' },
  ])('rejects $tipo with FASE_INVALIDA', (evento) => {
    expect(validar(config, jugar(config, enJuego), evento)).toMatchObject({
      codigo: 'FASE_INVALIDA',
    });
  });
});
