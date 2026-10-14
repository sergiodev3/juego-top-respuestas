import { describe, expect, it } from 'vitest';

import { aplicar, crearEstadoInicial, deshacer, proyectarTablero, reducir, validar } from './index';
import type { EstadoJuego, Evento } from './index';
import { definido, jugar } from './prueba/fabricas';
import { partidaDosEquipos, RONDA_FINAL_DOS_EQUIPOS } from './prueba/partidas';

describe('scenario: complete 2-team game', () => {
  const { config, eventos } = partidaDosEquipos(200);
  const posicion = (tipo: Evento['tipo'], desde = 0) =>
    eventos.findIndex((evento, indice) => indice >= desde && evento.tipo === tipo);

  it('round 1: face-off, play, three strikes and a successful steal', () => {
    const robo = posicion('ROBO_EXITOSO');
    const antesDelRobo = jugar(config, eventos.slice(0, robo));
    expect(antesDelRobo.fase).toBe('robo');
    expect(antesDelRobo.ronda).toMatchObject({ equipoControl: 1, equipoRobo: 0, tachas: 3 });
    const estado = jugar(config, eventos.slice(0, robo + 1));
    expect(estado.ronda).toMatchObject({ ganador: 0, puntosOtorgados: 92 });
    expect(estado.puntajes).toEqual([92, 0]);
  });

  it('round 2: PASAR after the face-off and a failed steal', () => {
    const fallido = posicion('ROBO_FALLIDO');
    const estado = jugar(config, eventos.slice(0, fallido + 1));
    expect(estado.ronda).toMatchObject({ indice: 1, ganador: 1, puntosOtorgados: 160 });
    expect(estado.puntajes).toEqual([92, 160]);
  });

  it('round 3: clearing the board, then the final round for the leader', () => {
    const inicioRf = eventos.length - RONDA_FINAL_DOS_EQUIPOS.length;
    const estado = jugar(config, eventos.slice(0, inicioRf));
    expect(estado.puntajes).toEqual([392, 165]);
    expect(estado.fase).toBe('rondaFinal');
    expect(estado.rondaFinal?.equipo).toBe(0);
  });

  it('final round: rejects a repeated answer and hides player 1 during player 2', () => {
    const cambio = posicion('RF_SIGUIENTE_JUGADOR');
    const estado = jugar(config, eventos.slice(0, cambio + 1));
    expect(
      validar(config, estado, {
        tipo: 'RF_RESPUESTA',
        jugador: 2,
        pregunta: 0,
        indice: 0,
        texto: 'lo mismo',
      }),
    ).toMatchObject({ ok: false, codigo: 'RESPUESTA_REPETIDA' });
    expect(proyectarTablero(config, estado).rondaFinal?.jugadores[0]?.oculto).toBe(true);
  });

  it('ends above the goal', () => {
    const estado = jugar(config, eventos);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.rondaFinal?.resultado).toEqual({ total: 260, meta: 200, superoMeta: true });
    expect(estado.puntajes).toEqual([392, 165]);
  });

  it('ends below a higher goal', () => {
    const alta = partidaDosEquipos(300);
    expect(jugar(alta.config, alta.eventos).rondaFinal?.resultado).toEqual({
      total: 260,
      meta: 300,
      superoMeta: false,
    });
  });

  it('undo by replay returns the exact previous state at every step', () => {
    const vistos: EstadoJuego[] = [];
    let actual = crearEstadoInicial(config);
    for (const evento of eventos) {
      vistos.push(actual);
      actual = aplicar(config, actual, evento);
    }
    let log = [...eventos];
    for (let paso = eventos.length - 1; paso >= 0; paso -= 1) {
      log = deshacer(log);
      expect(reducir(config, log)).toEqual(definido(vistos[paso]));
    }
  });
});
