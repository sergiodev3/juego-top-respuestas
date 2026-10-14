// Pure keyboard-shortcut mapping for the conductor panel: a key plus the game context gives an
// abstract command; the panel runs it through the same actions as its buttons.
import type { Fase } from '@/engine';

/** What a shortcut asks the panel to do. */
export type ComandoAtajo =
  | { readonly tipo: 'revelar'; readonly indice: number }
  | { readonly tipo: 'tache' }
  | { readonly tipo: 'roboFallido' }
  | { readonly tipo: 'asignarTurno'; readonly equipo: number }
  | { readonly tipo: 'deshacer' }
  | { readonly tipo: 'siguienteRonda' }
  | { readonly tipo: 'jugar' }
  | { readonly tipo: 'temporizador' }
  | { readonly tipo: 'revelarTodas' }
  | { readonly tipo: 'silenciar' }
  | { readonly tipo: 'ayuda' };

export interface ContextoAtajos {
  readonly fase: Fase;
  /** Answers of the current regular-round question. */
  readonly respuestas: number;
  readonly equipos: number;
  /** Whether "Jugar" is available, so the space bar can take it as the next step. */
  readonly jugarHabilitado: boolean;
}

const LETRAS_EQUIPOS = ['a', 'b', 'c', 'd'] as const;
const MAXIMO_RESPUESTAS = 8;

/** `KeyboardEvent.key` with letters in lower case and the space bar as `' '`. */
function normalizarTecla(tecla: string): string {
  if (tecla === 'Spacebar') {
    return ' ';
  }
  return tecla.length === 1 ? tecla.toLowerCase() : tecla;
}

/** The space bar: the phase's next step, if any. */
function siguientePaso(contexto: ContextoAtajos): ComandoAtajo | null {
  switch (contexto.fase) {
    case 'finDeRonda':
      return { tipo: 'siguienteRonda' };
    case 'rondaFinal':
      return { tipo: 'temporizador' };
    case 'caraACara':
      return contexto.jugarHabilitado ? { tipo: 'jugar' } : null;
    default:
      return null;
  }
}

/** Shortcuts of a regular round: answers, strikes, turns and "reveal all". */
function comandoDeRonda(tecla: string, contexto: ContextoAtajos): ComandoAtajo | null {
  const numero = Number(tecla);
  if (/^[1-9]$/u.test(tecla)) {
    return numero <= Math.min(contexto.respuestas, MAXIMO_RESPUESTAS)
      ? { tipo: 'revelar', indice: numero - 1 }
      : null;
  }
  const equipo = LETRAS_EQUIPOS.indexOf(tecla as (typeof LETRAS_EQUIPOS)[number]);
  if (equipo !== -1) {
    return equipo < contexto.equipos ? { tipo: 'asignarTurno', equipo } : null;
  }
  switch (tecla) {
    case 'x':
      return contexto.fase === 'robo' ? { tipo: 'roboFallido' } : { tipo: 'tache' };
    case 'r':
      return { tipo: 'revelarTodas' };
    default:
      return null;
  }
}

/**
 * The command for a key in the current context, or `null` when the key means nothing there.
 * Undo (`Z`), mute (`M`) and help (`?`) work in every phase; the final round only adds the
 * timer on the space bar (its answers are matched with the picker), and an ended game nothing.
 */
export function comandoDeTecla(tecla: string, contexto: ContextoAtajos): ComandoAtajo | null {
  const normalizada = normalizarTecla(tecla);
  switch (normalizada) {
    case 'z':
      return { tipo: 'deshacer' };
    case 'm':
      return { tipo: 'silenciar' };
    case '?':
      return { tipo: 'ayuda' };
    case ' ':
      return siguientePaso(contexto);
    default:
      break;
  }
  if (contexto.fase === 'rondaFinal' || contexto.fase === 'juegoTerminado') {
    return null;
  }
  return comandoDeRonda(normalizada, contexto);
}
