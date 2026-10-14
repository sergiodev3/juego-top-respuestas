import { crearEstadoInicial } from './estadoInicial';
import {
  aceptar,
  esIndiceEquipo,
  EventoRechazadoError,
  rechazar,
  type Procesado,
} from './rechazos';
import { procesarCaraACara } from './reglas/caraACara';
import { procesarEnJuego } from './reglas/enJuego';
import { procesarFinDeRonda } from './reglas/finDeRonda';
import { procesarRobo } from './reglas/robo';
import { procesarRondaFinal } from './reglas/rondaFinal';
import type { ConfigPartida, EstadoJuego, Evento, ResultadoValidacion, TipoEvento } from './tipos';

const TIPOS_EVENTO: ReadonlySet<unknown> = new Set<TipoEvento>([
  'ASIGNAR_TURNO',
  'REVELAR',
  'TACHE',
  'JUGAR',
  'PASAR',
  'ROBO_EXITOSO',
  'ROBO_FALLIDO',
  'REVELAR_TODAS',
  'SIGUIENTE_RONDA',
  'AJUSTAR_PUNTOS',
  'TERMINAR_JUEGO',
  'RF_RESPUESTA',
  'RF_REVELAR',
  'RF_SIGUIENTE_JUGADOR',
  'RF_TERMINAR',
]);

/** Stored logs come from IndexedDB, so the event shape is checked at runtime too. */
function esEventoConocido(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null && TIPOS_EVENTO.has((valor as Evento).tipo);
}

function ajustarPuntos(
  config: ConfigPartida,
  estado: EstadoJuego,
  equipo: number,
  delta: number,
): Procesado {
  if (!esIndiceEquipo(config, equipo)) {
    return rechazar('EQUIPO_INVALIDO');
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return rechazar('DELTA_INVALIDO');
  }
  const puntajes = estado.puntajes.map((puntaje, i) => (i === equipo ? puntaje + delta : puntaje));
  return aceptar({ ...estado, puntajes });
}

/** Validates and applies one event in a single pass, so both can never disagree. */
function procesar(config: ConfigPartida, estado: EstadoJuego, evento: Evento): Procesado {
  if (!esEventoConocido(evento)) {
    return rechazar('EVENTO_DESCONOCIDO');
  }
  if (estado.fase === 'juegoTerminado') {
    return rechazar('JUEGO_TERMINADO');
  }
  if (evento.tipo === 'AJUSTAR_PUNTOS') {
    return ajustarPuntos(config, estado, evento.equipo, evento.delta);
  }
  if (evento.tipo === 'TERMINAR_JUEGO') {
    return aceptar({ ...estado, fase: 'juegoTerminado' });
  }
  const { ronda, rondaFinal } = estado;
  if (estado.fase === 'rondaFinal') {
    return rondaFinal === null
      ? rechazar('FASE_INVALIDA')
      : procesarRondaFinal(config, estado, rondaFinal, evento);
  }
  if (ronda === null) {
    return rechazar('FASE_INVALIDA');
  }
  switch (estado.fase) {
    case 'caraACara':
      return procesarCaraACara(config, estado, ronda, evento);
    case 'enJuego':
      return procesarEnJuego(config, estado, ronda, evento);
    case 'robo':
      return procesarRobo(config, estado, ronda, evento);
    case 'finDeRonda':
      return procesarFinDeRonda(config, estado, ronda, evento);
  }
}

/** Whether `evento` is allowed in `estado`; the panel uses it to enable or disable actions. */
export function validar(
  config: ConfigPartida,
  estado: EstadoJuego,
  evento: Evento,
): ResultadoValidacion {
  const resultado = procesar(config, estado, evento);
  return resultado.ok ? { ok: true } : resultado;
}

/** Applies a valid event. Throws `EventoRechazadoError` for an invalid one. */
export function aplicar(config: ConfigPartida, estado: EstadoJuego, evento: Evento): EstadoJuego {
  const resultado = procesar(config, estado, evento);
  if (!resultado.ok) {
    throw new EventoRechazadoError(resultado);
  }
  return resultado.estado;
}

/**
 * Replays a stored log from the initial state. Invalid events are skipped and listed in
 * `advertencias` (with their log index) instead of throwing, so a partida can always be recovered.
 */
export function reducir(config: ConfigPartida, eventos: readonly Evento[]): EstadoJuego {
  return eventos.reduce<EstadoJuego>((estado, evento, indice) => {
    const resultado = procesar(config, estado, evento);
    if (resultado.ok) {
      return resultado.estado;
    }
    const { codigo, motivo } = resultado;
    return { ...estado, advertencias: [...estado.advertencias, { indice, codigo, motivo }] };
  }, crearEstadoInicial(config));
}

/** Undo: the log without its last event. Replay it with `reducir` to get the previous state. */
export function deshacer(eventos: readonly Evento[]): Evento[] {
  return eventos.slice(0, -1);
}
