import { aceptar, esIndiceEquipo, rechazar, type Procesado } from '../rechazos';
import type {
  ConfigPartida,
  EstadoCaraACara,
  EstadoJuego,
  EstadoRonda,
  Evento,
  IntentoCaraACara,
  Rechazo,
  RespuestaSnapshot,
} from '../tipos';
import { conRonda, otorgarRonda, respuestasDe, revelar, verificarRespuestaOculta } from './comun';

/**
 * Winner of the face-off so far, or `null` while it is still open: the top answer wins at once;
 * otherwise, after at least two attempts with at least one hit, the highest-points hit wins
 * (ties go to the earliest attempt).
 */
function resolverGanador(
  intentos: readonly IntentoCaraACara[],
  respuestas: readonly RespuestaSnapshot[],
): number | null {
  const ultimo = intentos.at(-1);
  if (ultimo?.indice === 0) {
    return ultimo.equipo;
  }
  if (intentos.length < 2) {
    return null;
  }
  let mejor: { equipo: number; puntos: number } | null = null;
  for (const { equipo, indice } of intentos) {
    if (indice === null) {
      continue;
    }
    const puntos = respuestas[indice]?.puntos ?? 0;
    if (mejor === null || puntos > mejor.puntos) {
      mejor = { equipo, puntos };
    }
  }
  return mejor?.equipo ?? null;
}

/** The team allowed to answer now, or why nobody is. */
function respondedorActual(caraACara: EstadoCaraACara): number | Rechazo {
  if (caraACara.ganador !== null) {
    return rechazar('CARA_A_CARA_RESUELTO');
  }
  return caraACara.respondedor ?? rechazar('SIN_RESPONDEDOR');
}

function registrarIntento(
  config: ConfigPartida,
  ronda: EstadoRonda,
  equipo: number,
  indice: number | null,
): EstadoRonda {
  const intentos = [...ronda.caraACara.intentos, { equipo, indice }];
  return {
    ...ronda,
    caraACara: {
      intentos,
      respondedor: null,
      ganador: resolverGanador(intentos, respuestasDe(config, ronda)),
    },
  };
}

function tomarControl(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  equipo: number,
): Procesado {
  const conControl: EstadoRonda = { ...ronda, equipoControl: equipo };
  // If the face-off already revealed every answer, the team taking control wins the pot at once.
  if (conControl.respuestas.every((respuesta) => respuesta !== 'oculta')) {
    return aceptar(otorgarRonda(config, estado, conControl, equipo));
  }
  return aceptar(conRonda(estado, conControl, 'enJuego'));
}

function pasar(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  ganador: number,
  equipo: number | undefined,
): Procesado {
  if (equipo === undefined) {
    if (config.equipos.length > 2) {
      return rechazar('PASAR_REQUIERE_EQUIPO');
    }
    return tomarControl(config, estado, ronda, 1 - ganador);
  }
  if (!esIndiceEquipo(config, equipo)) {
    return rechazar('EQUIPO_INVALIDO');
  }
  if (equipo === ganador) {
    return rechazar(
      'EQUIPO_INVALIDO',
      'Pase el turno a un equipo distinto del que ganó el cara a cara.',
    );
  }
  return tomarControl(config, estado, ronda, equipo);
}

export function procesarCaraACara(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  evento: Evento,
): Procesado {
  const { caraACara } = ronda;
  switch (evento.tipo) {
    case 'ASIGNAR_TURNO': {
      if (!esIndiceEquipo(config, evento.equipo)) {
        return rechazar('EQUIPO_INVALIDO');
      }
      // Before resolution this names the responder; afterwards it corrects the winner.
      const siguiente: EstadoCaraACara =
        caraACara.ganador === null
          ? { ...caraACara, respondedor: evento.equipo }
          : { ...caraACara, ganador: evento.equipo };
      return aceptar(conRonda(estado, { ...ronda, caraACara: siguiente }));
    }
    case 'REVELAR': {
      const respondedor = respondedorActual(caraACara);
      if (typeof respondedor !== 'number') {
        return respondedor;
      }
      const rechazo = verificarRespuestaOculta(ronda, evento.indice);
      if (rechazo !== null) {
        return rechazo;
      }
      const revelada = revelar(config, ronda, evento.indice);
      return aceptar(
        conRonda(estado, registrarIntento(config, revelada, respondedor, evento.indice)),
      );
    }
    case 'TACHE': {
      const respondedor = respondedorActual(caraACara);
      if (typeof respondedor !== 'number') {
        return respondedor;
      }
      // A face-off miss never counts toward the round strikes.
      return aceptar(conRonda(estado, registrarIntento(config, ronda, respondedor, null)));
    }
    case 'JUGAR':
    case 'PASAR': {
      if (caraACara.ganador === null) {
        return rechazar('SIN_GANADOR_CARA_A_CARA');
      }
      return evento.tipo === 'JUGAR'
        ? tomarControl(config, estado, ronda, caraACara.ganador)
        : pasar(config, estado, ronda, caraACara.ganador, evento.equipo);
    }
    default:
      return rechazar('FASE_INVALIDA');
  }
}
