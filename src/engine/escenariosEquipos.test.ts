import { describe, expect, it } from 'vitest';

import { aplicar, crearEstadoInicial, validar } from './index';
import type { ConfigPartida, EstadoJuego, Evento, ResultadoValidacion } from './index';
import { crearConfig, tachas } from './prueba/fabricas';

type Paso = Evento | { readonly rechazar: Evento; readonly codigo: string };

/** Plays a script step by step, checking that rejected actions leave the state untouched. */
function guion(config: ConfigPartida, pasos: readonly Paso[]): EstadoJuego {
  return pasos.reduce<EstadoJuego>((estado, paso) => {
    if ('rechazar' in paso) {
      const resultado: ResultadoValidacion = validar(config, estado, paso.rechazar);
      expect(resultado).toMatchObject({ ok: false, codigo: paso.codigo });
      return estado;
    }
    return aplicar(config, estado, paso);
  }, crearEstadoInicial(config));
}

describe('scenario: 3 teams', () => {
  const config = crearConfig({ equipos: 3 });

  it('plays three rounds with PASAR(equipo) and steals assigned by ASIGNAR_TURNO', () => {
    const estado = guion(config, [
      // Round 1 (x1): C misses, A hits #3 and wins the face-off, then passes to B.
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 2 },
      { rechazar: { tipo: 'PASAR' }, codigo: 'PASAR_REQUIERE_EQUIPO' },
      { rechazar: { tipo: 'PASAR', equipo: 0 }, codigo: 'EQUIPO_INVALIDO' },
      { tipo: 'PASAR', equipo: 1 },
      { tipo: 'REVELAR', indice: 1 },
      ...tachas(3),
      { rechazar: { tipo: 'ROBO_EXITOSO', indice: 0 }, codigo: 'SIN_EQUIPO_ROBO' },
      { rechazar: { tipo: 'ASIGNAR_TURNO', equipo: 1 }, codigo: 'EQUIPO_INVALIDO' },
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'ROBO_EXITOSO', indice: 0 },
      { tipo: 'REVELAR_TODAS' },
      { tipo: 'SIGUIENTE_RONDA' },
      // Round 2 (x2): B sweeps the board.
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'REVELAR', indice: 4 },
      { tipo: 'SIGUIENTE_RONDA' },
      // Round 3 (x3): A wins the face-off on points, strikes out, B's steal fails.
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'REVELAR', indice: 3 },
      { tipo: 'JUGAR' },
      ...tachas(3),
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'ROBO_FALLIDO' },
      { tipo: 'AJUSTAR_PUNTOS', equipo: 2, delta: -10 },
      { tipo: 'SIGUIENTE_RONDA' },
    ]);
    expect(estado.fase).toBe('juegoTerminado');
    // A: (25 + 12) x3; B: 100 x2; C: (15 + 25 + 40) x1 - 10.
    expect(estado.puntajes).toEqual([111, 200, 70]);
  });
});

describe('scenario: 4 teams', () => {
  const config = crearConfig({ equipos: 4, multiplicadores: [1, 2] });

  it('resolves a face-off after misses and lets the host pick any non-control thief', () => {
    const estado = guion(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 3 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'TACHE' },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { rechazar: { tipo: 'PASAR' }, codigo: 'PASAR_REQUIERE_EQUIPO' },
      { tipo: 'PASAR', equipo: 3 },
      { tipo: 'REVELAR', indice: 4 },
      ...tachas(3),
      { rechazar: { tipo: 'ASIGNAR_TURNO', equipo: 3 }, codigo: 'EQUIPO_INVALIDO' },
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'ROBO_EXITOSO', indice: 1 },
      { tipo: 'SIGUIENTE_RONDA' },
      // Round 2 (x2): D wins on points after B's lower hit, plays, and C steals.
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      { tipo: 'REVELAR', indice: 4 },
      { tipo: 'ASIGNAR_TURNO', equipo: 3 },
      { tipo: 'REVELAR', indice: 2 },
      { tipo: 'JUGAR' },
      ...tachas(3),
      { tipo: 'ASIGNAR_TURNO', equipo: 2 },
      { tipo: 'ROBO_EXITOSO', indice: 0 },
      { tipo: 'TERMINAR_JUEGO' },
      { rechazar: { tipo: 'SIGUIENTE_RONDA' }, codigo: 'JUEGO_TERMINADO' },
    ]);
    expect(estado.fase).toBe('juegoTerminado');
    // C: (40 + 8 + 25) x1 + (8 + 15 + 40) x2.
    expect(estado.puntajes).toEqual([0, 0, 199, 0]);
  });
});
