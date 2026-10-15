import { useState } from 'react';

import type { ConfigPartida, EstadoJuego } from '@/engine';

import { preguntaActualRondaFinal } from '../dominio';
import type { AccionesPanel, AccionPanel } from './useAccionesPanel';

/** The match picker value: nothing picked yet, no match, or an answer index as text. */
export const SIN_ELEGIR = '';
export const SIN_COINCIDENCIA = 'ninguna';

const MOTIVO_SIN_COINCIDENCIA = 'Elige la respuesta que coincide o «Sin coincidencia».';

/** What the host has entered for one question but not recorded yet. */
export interface Borrador {
  readonly texto: string;
  readonly coincidencia: string;
}

const VACIO: Borrador = { texto: '', coincidencia: SIN_ELEGIR };

/** One question's draft plus the action that records it. */
export interface RegistroPregunta {
  readonly borrador: Borrador;
  /** The picked match is the other player's answer (`RESPUESTA_REPETIDA`). */
  readonly repetida: boolean;
  /** Records the draft; on success the draft is cleared. */
  readonly registrar: AccionPanel;
}

/**
 * Unsaved final-round answers of the player in turn, one per question, shared by the question
 * forms and the keyboard. Typing is optional: with a match and no text, the survey answer's
 * text is recorded; without a match the text may stay blank. `actual` is the current question
 * (see `preguntaActualRondaFinal`), the one the keyboard works on.
 */
export function useBorradoresRondaFinal(
  config: ConfigPartida,
  estado: EstadoJuego,
  acciones: AccionesPanel,
) {
  const [borradores, setBorradores] = useState<Readonly<Record<string, Borrador>>>({});
  const jugador = estado.rondaFinal?.jugadorActual ?? 1;
  // Drafts belong to one player: the other player's start empty.
  const clave = (pregunta: number) => `${String(jugador)}-${String(pregunta)}`;

  function cambiar(pregunta: number, cambios: Partial<Borrador>) {
    setBorradores((actuales) => ({
      ...actuales,
      [clave(pregunta)]: { ...(actuales[clave(pregunta)] ?? VACIO), ...cambios },
    }));
  }

  function registro(pregunta: number): RegistroPregunta {
    const borrador = borradores[clave(pregunta)] ?? VACIO;
    const { coincidencia } = borrador;
    const indice =
      coincidencia === SIN_ELEGIR || coincidencia === SIN_COINCIDENCIA
        ? null
        : Number(coincidencia);
    const escrito = borrador.texto.trim();
    const sugerido =
      indice === null
        ? ''
        : (config.rondaFinal?.preguntas[pregunta]?.respuestas[indice]?.texto ?? '');
    const responder = acciones.rfResponder(
      jugador,
      pregunta,
      indice,
      escrito === '' ? sugerido : escrito,
    );
    const falta = coincidencia === SIN_ELEGIR ? MOTIVO_SIN_COINCIDENCIA : null;
    return {
      borrador,
      repetida: coincidencia !== SIN_ELEGIR && responder.codigo === 'RESPUESTA_REPETIDA',
      registrar: {
        ...responder,
        habilitada: responder.habilitada && falta === null,
        motivo: falta ?? responder.motivo,
        async ejecutar() {
          if (falta !== null) {
            return false;
          }
          const guardado = await responder.ejecutar();
          if (guardado) {
            setBorradores((actuales) =>
              Object.fromEntries(
                Object.entries(actuales).filter(([deClave]) => deClave !== clave(pregunta)),
              ),
            );
          }
          return guardado;
        },
      },
    };
  }

  return {
    actual: preguntaActualRondaFinal(estado),
    registro,
    cambiarTexto: (pregunta: number, texto: string) => {
      cambiar(pregunta, { texto });
    },
    /** `null` picks "no match". */
    elegir: (pregunta: number, indice: number | null) => {
      cambiar(pregunta, { coincidencia: indice === null ? SIN_COINCIDENCIA : String(indice) });
    },
    /** Raw picker value (from the select). */
    elegirValor: (pregunta: number, coincidencia: string) => {
      cambiar(pregunta, { coincidencia });
    },
  };
}

export type BorradoresRondaFinal = ReturnType<typeof useBorradoresRondaFinal>;
