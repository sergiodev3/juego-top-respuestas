import { useState } from 'react';

import type { CodigoRechazo, Evento, Jugador } from '@/engine';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import { confirmacionPara, evaluarAccion, eventoRevelar, type Confirmacion } from '../dominio';
import { motivoSinDeshacer, type PartidaCargada, type PartidaEnCurso } from './usePartidaEnCurso';

/** A named panel action. Buttons (and, later, keyboard shortcuts) only call `ejecutar`. */
export interface AccionPanel {
  readonly habilitada: boolean;
  /** Why it is not available (engine reason, a save in progress, or an ended partida). */
  readonly motivo: string | null;
  readonly codigo: CodigoRechazo | null;
  /**
   * Runs the action (asking for confirmation first when it is destructive). Resolves `true`
   * once saved; `false` when unavailable, cancelled into a confirmation, or not saved.
   */
  ejecutar(): Promise<boolean>;
}

const MOTIVO_GUARDANDO = 'Guardando la acción anterior…';
const MOTIVO_TERMINADA = 'La partida ya terminó.';

interface Pendiente {
  evento: Evento;
  confirmacion: Confirmacion;
}

/**
 * Every conductor action with its availability: enabled only when `validar` accepts the event,
 * no save is in flight and the partida is still open. Render `dialogo` once.
 */
export function useAccionesPanel(
  partida: PartidaCargada,
  { guardando, despachar, deshacer }: Pick<PartidaEnCurso, 'guardando' | 'despachar' | 'deshacer'>,
) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const { config, estado } = partida;

  function accion(evento: Evento): AccionPanel {
    const evaluada = evaluarAccion(config, estado, evento);
    const bloqueo = partida.terminada ? MOTIVO_TERMINADA : guardando ? MOTIVO_GUARDANDO : null;
    const habilitada = evaluada.habilitada && bloqueo === null;
    return {
      habilitada,
      motivo: evaluada.motivo ?? bloqueo,
      codigo: evaluada.codigo,
      ejecutar() {
        if (!habilitada) {
          return Promise.resolve(false);
        }
        const confirmacion = confirmacionPara(config, estado, evento);
        if (confirmacion !== null) {
          setPendiente({ evento, confirmacion });
          return Promise.resolve(false);
        }
        return despachar(evento);
      },
    };
  }

  const sinDeshacer = motivoSinDeshacer(partida) ?? (guardando ? MOTIVO_GUARDANDO : null);

  const dialogo = (
    <DialogoConfirmacion
      abierto={pendiente !== null}
      titulo={pendiente?.confirmacion.titulo ?? ''}
      descripcion={pendiente?.confirmacion.descripcion ?? ''}
      textoConfirmar={pendiente?.confirmacion.textoConfirmar ?? 'Confirmar'}
      ocupado={guardando}
      onConfirmar={() => {
        if (pendiente !== null) {
          setPendiente(null);
          void despachar(pendiente.evento);
        }
      }}
      onCancelar={() => {
        setPendiente(null);
      }}
    />
  );

  return {
    asignarTurno: (equipo: number) => accion({ tipo: 'ASIGNAR_TURNO', equipo }),
    /** `REVELAR`, or `ROBO_EXITOSO` during a steal. */
    revelar: (indice: number) => accion(eventoRevelar(estado.fase, indice)),
    tache: accion({ tipo: 'TACHE' }),
    jugar: accion({ tipo: 'JUGAR' }),
    /** Without a team only with 2 teams (the other one takes control). */
    pasar: (equipo?: number) =>
      accion(equipo === undefined ? { tipo: 'PASAR' } : { tipo: 'PASAR', equipo }),
    roboFallido: accion({ tipo: 'ROBO_FALLIDO' }),
    revelarTodas: accion({ tipo: 'REVELAR_TODAS' }),
    siguienteRonda: accion({ tipo: 'SIGUIENTE_RONDA' }),
    terminarJuego: accion({ tipo: 'TERMINAR_JUEGO' }),
    ajustarPuntos: (equipo: number, delta: number) =>
      accion({ tipo: 'AJUSTAR_PUNTOS', equipo, delta }),
    rfResponder: (jugador: Jugador, pregunta: number, indice: number | null, texto: string) =>
      accion({ tipo: 'RF_RESPUESTA', jugador, pregunta, indice, texto }),
    rfRevelar: (jugador: Jugador, pregunta: number) =>
      accion({ tipo: 'RF_REVELAR', jugador, pregunta }),
    rfSiguienteJugador: accion({ tipo: 'RF_SIGUIENTE_JUGADOR' }),
    rfTerminar: accion({ tipo: 'RF_TERMINAR' }),
    deshacer: {
      habilitada: sinDeshacer === null,
      motivo: sinDeshacer,
      codigo: null,
      ejecutar: () => (sinDeshacer === null ? deshacer() : Promise.resolve(false)),
    } satisfies AccionPanel,
    dialogo,
  };
}

export type AccionesPanel = ReturnType<typeof useAccionesPanel>;
