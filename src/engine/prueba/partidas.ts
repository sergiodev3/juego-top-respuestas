// Test-only game logs shared by the scenario, undo and projection specs.
import { aplicar, crearEstadoInicial, validar } from '../index';
import type { ConfigPartida, EstadoJuego, Evento, Jugador } from '../index';
import { congelar, crearConfig, tachas } from './fabricas';

export interface Partida {
  readonly config: ConfigPartida;
  readonly eventos: readonly Evento[];
}

function rf(jugador: Jugador, pregunta: number, indice: number | null): Evento[] {
  return [
    {
      tipo: 'RF_RESPUESTA',
      jugador,
      pregunta,
      indice,
      texto: `DICHO_${String(jugador)}_${String(pregunta)}_`,
    },
    { tipo: 'RF_REVELAR', jugador, pregunta },
  ];
}

/** Three regular rounds before the final round of the complete 2-team game. */
const RONDAS_DOS_EQUIPOS: readonly Evento[] = [
  // Round 1 (x1): B beats A's #2 with the top answer, plays, strikes out; A steals with #4.
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'ASIGNAR_TURNO', equipo: 1 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 2 },
  ...tachas(3),
  { tipo: 'ROBO_EXITOSO', indice: 3 },
  { tipo: 'REVELAR_TODAS' },
  { tipo: 'SIGUIENTE_RONDA' },
  // Round 2 (x2): B misses, A hits #3 and passes; B strikes out and A's steal fails.
  { tipo: 'ASIGNAR_TURNO', equipo: 1 },
  { tipo: 'TACHE' },
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'PASAR' },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'REVELAR', indice: 1 },
  ...tachas(3),
  { tipo: 'ROBO_FALLIDO' },
  { tipo: 'SIGUIENTE_RONDA' },
  // Round 3 (x3): A wins the face-off and clears the board.
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'TACHE' },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
  { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 5 },
  { tipo: 'SIGUIENTE_RONDA' },
];

/** Final round: player 1 scores 145, player 2 scores 115 (total 260). */
export const RONDA_FINAL_DOS_EQUIPOS: readonly Evento[] = [
  ...rf(1, 0, 0),
  ...rf(1, 1, 1),
  ...rf(1, 2, null),
  ...rf(1, 3, 2),
  ...rf(1, 4, 0),
  { tipo: 'RF_SIGUIENTE_JUGADOR' },
  ...rf(2, 0, 1),
  ...rf(2, 1, 0),
  ...rf(2, 2, 3),
  ...rf(2, 3, null),
  ...rf(2, 4, 1),
  { tipo: 'RF_TERMINAR' },
];

export function partidaDosEquipos(meta: number): Partida {
  return {
    config: crearConfig({ rondaFinal: true, meta }),
    eventos: congelar([...RONDAS_DOS_EQUIPOS, ...RONDA_FINAL_DOS_EQUIPOS]),
  };
}

/** Deterministic pseudo-random generator (LCG) so property tests stay reproducible. */
function crearAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 2 ** 32;
  };
}

function candidatos(config: ConfigPartida, contador: number): Evento[] {
  const equipos = config.equipos.map((_, equipo) => equipo);
  const indices = [0, 1, 2, 3, 4];
  const lista: Evento[] = [
    ...equipos.map((equipo) => ({ tipo: 'ASIGNAR_TURNO', equipo }) as const),
    ...equipos.map((equipo) => ({ tipo: 'PASAR', equipo }) as const),
    ...indices.map((indice) => ({ tipo: 'REVELAR', indice }) as const),
    ...indices.map((indice) => ({ tipo: 'ROBO_EXITOSO', indice }) as const),
    { tipo: 'TACHE' },
    { tipo: 'TACHE' },
    { tipo: 'JUGAR' },
    { tipo: 'PASAR' },
    { tipo: 'ROBO_FALLIDO' },
    { tipo: 'REVELAR_TODAS' },
    { tipo: 'SIGUIENTE_RONDA' },
    { tipo: 'AJUSTAR_PUNTOS', equipo: contador % equipos.length, delta: (contador % 7) - 3 },
    { tipo: 'RF_SIGUIENTE_JUGADOR' },
  ];
  for (const jugador of [1, 2] as const) {
    for (const pregunta of indices) {
      lista.push(
        {
          tipo: 'RF_RESPUESTA',
          jugador,
          pregunta,
          indice: (contador + pregunta) % 5 === 4 ? null : (contador + pregunta) % 4,
          texto: `DICHO_${String(contador)}_`,
        },
        { tipo: 'RF_REVELAR', jugador, pregunta },
      );
    }
  }
  return lista;
}

/**
 * Walks a random but valid game: at each step one valid candidate is chosen. Ending events
 * (`TERMINAR_JUEGO`, `RF_TERMINAR`) are rare so games reach the final round.
 */
export function generarPartida(config: ConfigPartida, semilla: number, pasos: number): Evento[] {
  const aleatorio = crearAleatorio(semilla);
  const eventos: Evento[] = [];
  let estado: EstadoJuego = crearEstadoInicial(config);
  for (let contador = 0; contador < pasos && estado.fase !== 'juegoTerminado'; contador += 1) {
    const finales: Evento[] = aleatorio() < 0.03 ? [{ tipo: 'RF_TERMINAR' }] : [];
    if (aleatorio() < 0.005) {
      finales.push({ tipo: 'TERMINAR_JUEGO' });
    }
    const validos = [...candidatos(config, contador), ...finales].filter(
      (evento) => validar(config, estado, evento).ok,
    );
    const evento = validos[Math.floor(aleatorio() * validos.length)];
    if (evento === undefined) {
      break;
    }
    eventos.push(evento);
    estado = aplicar(config, estado, evento);
  }
  return eventos;
}
