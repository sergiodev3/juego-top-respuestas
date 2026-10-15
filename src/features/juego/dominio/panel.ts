// Pure helpers for the conductor panel: action evaluation, phase labels and host guidance.
import {
  proyectarTablero,
  validar,
  type CodigoRechazo,
  type ConfigPartida,
  type EstadoJuego,
  type Evento,
  type Fase,
} from '@/engine';

export const ETIQUETAS_FASE: Readonly<Record<Fase, string>> = {
  caraACara: 'Cara a cara',
  enJuego: 'En juego',
  robo: 'Robo',
  finDeRonda: 'Fin de ronda',
  rondaFinal: 'Ronda final',
  juegoTerminado: 'Juego terminado',
};

/** One panel action: the event it dispatches and whether the engine accepts it right now. */
export interface EstadoAccion {
  readonly evento: Evento;
  readonly habilitada: boolean;
  /** Spanish reason from the engine when it is not available. */
  readonly motivo: string | null;
  /** Stable engine rejection code (e.g. `RESPUESTA_REPETIDA`), `null` when accepted. */
  readonly codigo: CodigoRechazo | null;
}

export function evaluarAccion(
  config: ConfigPartida,
  estado: EstadoJuego,
  evento: Evento,
): EstadoAccion {
  const resultado = validar(config, estado, evento);
  return resultado.ok
    ? { evento, habilitada: true, motivo: null, codigo: null }
    : { evento, habilitada: false, motivo: resultado.motivo, codigo: resultado.codigo };
}

/** "Revelar" on an answer: a steal attempt that hits during `robo`, a plain reveal otherwise. */
export function eventoRevelar(fase: Fase, indice: number): Evento {
  return fase === 'robo' ? { tipo: 'ROBO_EXITOSO', indice } : { tipo: 'REVELAR', indice };
}

export function nombreEquipo(config: ConfigPartida, indice: number | null): string {
  return indice === null ? '' : (config.equipos[indice]?.nombre ?? '');
}

/**
 * The final-round question the keyboard works on: the first one the player in turn has not
 * answered yet. `null` outside the final round or once that player answered all of them.
 */
export function preguntaActualRondaFinal(estado: EstadoJuego): number | null {
  const { rondaFinal } = estado;
  if (estado.fase !== 'rondaFinal' || rondaFinal === null) {
    return null;
  }
  const respuestas = rondaFinal.jugadorActual === 1 ? rondaFinal.jugador1 : rondaFinal.jugador2;
  const pregunta = respuestas.findIndex((respuesta) => respuesta === null);
  return pregunta === -1 ? null : pregunta;
}

function guiaRondaFinal(config: ConfigPartida, estado: EstadoJuego): string {
  const { rondaFinal } = estado;
  if (rondaFinal === null) {
    return '';
  }
  const { jugadorActual } = rondaFinal;
  const inicio = `Ronda final: juega ${nombreEquipo(config, rondaFinal.equipo)}.`;
  const pregunta = preguntaActualRondaFinal(estado);
  if (pregunta === null) {
    const despues = jugadorActual === 1 ? 'pasa al siguiente jugador' : 'termina la ronda final';
    const total = String(config.rondaFinal?.preguntas.length ?? 0);
    return `${inicio} El jugador ${String(jugadorActual)} ya respondió las ${total} preguntas: revela sus respuestas y ${despues}.`;
  }
  const respuestas = config.rondaFinal?.preguntas[pregunta]?.respuestas.length ?? 0;
  return `${inicio} Jugador ${String(jugadorActual)}, pregunta ${String(pregunta + 1)}: elige la coincidencia con 1–${String(respuestas)} (0 = sin coincidencia) y presiona Enter.`;
}

/** One sentence telling the host what to do next. */
export function guiaPanel(config: ConfigPartida, estado: EstadoJuego): string {
  const { ronda } = estado;
  switch (estado.fase) {
    case 'juegoTerminado':
      return 'El juego terminó.';
    case 'rondaFinal':
      return guiaRondaFinal(config, estado);
    default:
      break;
  }
  if (ronda === null) {
    return '';
  }
  const { caraACara } = ronda;
  switch (estado.fase) {
    case 'caraACara':
      if (caraACara.ganador !== null) {
        return `${nombreEquipo(config, caraACara.ganador)} gana el cara a cara. Pregúntale si juega o pasa.`;
      }
      if (caraACara.respondedor !== null) {
        return `Responde ${nombreEquipo(config, caraACara.respondedor)}. Revela su respuesta o marca tache si no está en el tablero.`;
      }
      return caraACara.intentos.length === 0
        ? 'Cara a cara: asigna el turno al equipo que presionó primero el botón.'
        : 'Asigna el turno al siguiente equipo que presionó el botón.';
    case 'enJuego':
      return `${nombreEquipo(config, ronda.equipoControl)} tiene el control. Revela cada acierto o marca tache.`;
    case 'robo':
      return ronda.equipoRobo === null
        ? 'Robo: asigna el turno al equipo que intentará robar.'
        : `${nombreEquipo(config, ronda.equipoRobo)} intenta robar. Si acierta, revela esa respuesta; si no, marca «Robo fallido».`;
    default:
      return `${nombreEquipo(config, ronda.ganador)} gana ${String(ronda.puntosOtorgados ?? 0)} puntos. Puedes revelar las respuestas restantes y pasar a la siguiente ronda.`;
  }
}

/** Label of the "next" button at the end of a round. */
export function accionSiguienteRonda(config: ConfigPartida, estado: EstadoJuego): string {
  const indice = estado.ronda?.indice ?? 0;
  if (indice < config.rondas.length - 1) {
    return 'Siguiente ronda';
  }
  return config.rondaFinal === null ? 'Terminar juego' : 'Ir a la ronda final';
}

export function respuestasOcultas(estado: EstadoJuego): number {
  return estado.ronda?.respuestas.filter((respuesta) => respuesta === 'oculta').length ?? 0;
}

/** Leading team(s) and their score; several names mean a tie. */
export function ganadoresJuego(
  config: ConfigPartida,
  estado: EstadoJuego,
): { nombres: string[]; puntaje: number } {
  const puntaje = Math.max(...estado.puntajes);
  const nombres = config.equipos
    .filter((_, indice) => estado.puntajes[indice] === puntaje)
    .map((equipo) => equipo.nombre);
  return { nombres, puntaje };
}

/** Text of the confirmation dialog an action needs before it runs. */
export interface Confirmacion {
  readonly titulo: string;
  readonly descripcion: string;
  readonly textoConfirmar: string;
}

/**
 * Destructive actions ask first: ending the game (it cannot be undone once the partida is
 * closed), the final-round end, and moving on while answers are still hidden.
 */
export function confirmacionPara(
  config: ConfigPartida,
  estado: EstadoJuego,
  evento: Evento,
): Confirmacion | null {
  switch (evento.tipo) {
    case 'TERMINAR_JUEGO':
      return {
        titulo: '¿Terminar la partida?',
        descripcion:
          'Se mostrará el resultado final. Después ya no podrás continuar ni deshacer acciones.',
        textoConfirmar: 'Terminar partida',
      };
    case 'RF_TERMINAR': {
      const total = proyectarTotalRondaFinal(config, estado) ?? 0;
      return {
        titulo: '¿Terminar la ronda final?',
        descripcion: `Se sumarán ${String(total)} puntos a ${nombreEquipo(config, estado.rondaFinal?.equipo ?? null)} y el juego terminará.`,
        textoConfirmar: 'Terminar ronda final',
      };
    }
    case 'SIGUIENTE_RONDA': {
      const textoConfirmar = accionSiguienteRonda(config, estado);
      const ocultas = respuestasOcultas(estado) > 0;
      if (textoConfirmar === 'Terminar juego') {
        return {
          titulo: '¿Terminar el juego?',
          descripcion: `${ocultas ? 'Hay respuestas sin revelar. ' : ''}Era la última ronda: se mostrará el resultado final y ya no podrás deshacer acciones.`,
          textoConfirmar,
        };
      }
      return ocultas
        ? {
            titulo: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
            descripcion:
              'Las respuestas ocultas no se mostrarán. Puedes usar «Revelar todas» antes de continuar.',
            textoConfirmar,
          }
        : null;
    }
    default:
      return null;
  }
}

/** Running final-round total (the same value the board shows), or `null` outside it. */
export function proyectarTotalRondaFinal(
  config: ConfigPartida,
  estado: EstadoJuego,
): number | null {
  return proyectarTablero(config, estado).rondaFinal?.total ?? null;
}
