import { describe, expect, it } from 'vitest';

import { reducir, type ConfigPartida, type Evento } from '@/engine';
import { configPrueba, preguntaSnapshotPrueba } from '@/test/fabricasPartida';

import { sonidoDeEvento } from './sonidos';

/** One regular round (40/25/15/12/8) and a final round whose first question has a 0-point answer. */
const CONFIG: ConfigPartida = configPrueba({
  rondas: [{ pregunta: preguntaSnapshotPrueba('R1'), multiplicador: 1 }],
  rondaFinal: {
    preguntas: [
      preguntaSnapshotPrueba('F1', [40, 25, 0]),
      ...['F2', 'F3', 'F4', 'F5'].map((clave) => preguntaSnapshotPrueba(clave)),
    ],
    segundos: [20, 25],
    meta: 200,
  },
});

/** Sound for `evento` saved after `previos` (the state passed is the one after the event). */
function sonidoTras(previos: readonly Evento[], evento: Evento) {
  return sonidoDeEvento(CONFIG, evento, reducir(CONFIG, [...previos, evento]));
}

const CARA_A_CARA_GANADO: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
];
const TRES_TACHES: Evento[] = [{ tipo: 'TACHE' }, { tipo: 'TACHE' }, { tipo: 'TACHE' }];
const EN_ROBO: Evento[] = [
  ...CARA_A_CARA_GANADO,
  ...TRES_TACHES,
  { tipo: 'ASIGNAR_TURNO', equipo: 1 },
];
const FIN_DE_RONDA: Evento[] = [...EN_ROBO, { tipo: 'ROBO_FALLIDO' }];
const RONDA_FINAL: Evento[] = [...FIN_DE_RONDA, { tipo: 'SIGUIENTE_RONDA' }];

function respuestaFinal(indice: number | null, pregunta = 0): Evento {
  return { tipo: 'RF_RESPUESTA', jugador: 1, pregunta, indice, texto: 'algo' };
}

describe('sonidoDeEvento', () => {
  it('plays acierto for an answer revealed with points, in the face-off and in play', () => {
    expect(sonidoTras([{ tipo: 'ASIGNAR_TURNO', equipo: 0 }], { tipo: 'REVELAR', indice: 0 })).toBe(
      'acierto',
    );
    expect(sonidoTras(CARA_A_CARA_GANADO, { tipo: 'REVELAR', indice: 1 })).toBe('acierto');
  });

  it('plays acierto for a successful steal', () => {
    expect(sonidoTras(EN_ROBO, { tipo: 'ROBO_EXITOSO', indice: 2 })).toBe('acierto');
  });

  it('plays tache for a face-off miss, a strike and a failed steal', () => {
    expect(sonidoTras([{ tipo: 'ASIGNAR_TURNO', equipo: 0 }], { tipo: 'TACHE' })).toBe('tache');
    expect(sonidoTras(CARA_A_CARA_GANADO, { tipo: 'TACHE' })).toBe('tache');
    expect(sonidoTras(EN_ROBO, { tipo: 'ROBO_FALLIDO' })).toBe('tache');
  });

  it('plays revelar when the remaining answers are shown without points', () => {
    expect(sonidoTras(FIN_DE_RONDA, { tipo: 'REVELAR_TODAS' })).toBe('revelar');
  });

  it('scores final-round reveals: acierto with points, revelar for 0 points, tache for no match', () => {
    const revelar: Evento = { tipo: 'RF_REVELAR', jugador: 1, pregunta: 0 };
    expect(sonidoTras([...RONDA_FINAL, respuestaFinal(1)], revelar)).toBe('acierto');
    expect(sonidoTras([...RONDA_FINAL, respuestaFinal(2)], revelar)).toBe('revelar');
    expect(sonidoTras([...RONDA_FINAL, respuestaFinal(null)], revelar)).toBe('tache');
  });

  it('plays ganador when the game ends, whatever the event', () => {
    expect(sonidoTras([...RONDA_FINAL, respuestaFinal(0)], { tipo: 'RF_TERMINAR' })).toBe(
      'ganador',
    );
    expect(sonidoTras(CARA_A_CARA_GANADO, { tipo: 'TERMINAR_JUEGO' })).toBe('ganador');
    const sinRondaFinal = configPrueba({ rondas: CONFIG.rondas });
    const eventos: Evento[] = [...FIN_DE_RONDA, { tipo: 'SIGUIENTE_RONDA' }];
    expect(
      sonidoDeEvento(sinRondaFinal, { tipo: 'SIGUIENTE_RONDA' }, reducir(sinRondaFinal, eventos)),
    ).toBe('ganador');
  });

  it('stays silent for turns, decisions, recorded final answers, adjustments and new rounds', () => {
    expect(sonidoTras([], { tipo: 'ASIGNAR_TURNO', equipo: 0 })).toBeNull();
    expect(sonidoTras(CARA_A_CARA_GANADO.slice(0, 2), { tipo: 'JUGAR' })).toBeNull();
    expect(sonidoTras(CARA_A_CARA_GANADO.slice(0, 2), { tipo: 'PASAR' })).toBeNull();
    expect(sonidoTras([], { tipo: 'AJUSTAR_PUNTOS', equipo: 0, delta: 5 })).toBeNull();
    expect(sonidoTras(FIN_DE_RONDA, { tipo: 'SIGUIENTE_RONDA' })).toBeNull();
    expect(sonidoTras(RONDA_FINAL, respuestaFinal(0))).toBeNull();
    expect(sonidoTras(RONDA_FINAL, { tipo: 'RF_SIGUIENTE_JUGADOR' })).toBeNull();
  });
});
