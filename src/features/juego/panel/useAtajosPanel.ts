import { useEffect, useRef, useState } from 'react';

import type { ConfigPartida, EstadoJuego } from '@/engine';

import { comandoDeTecla, type ComandoAtajo } from '../dominio';
import type { AccionesPanel, AccionPanel } from './useAccionesPanel';
import type { ControlTemporizador } from './useTemporizador';

const MOTIVO_SIN_TIEMPO = 'El tiempo terminó. Usa «Reiniciar tiempo» para empezar de nuevo.';
const MOTIVO_GUARDANDO = 'Espera un momento: se está guardando la jugada anterior.';
const CAMPOS_DE_TEXTO = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export interface OpcionesAtajos {
  config: ConfigPartida;
  estado: EstadoJuego;
  acciones: AccionesPanel;
  /** A save is in flight: shortcuts wait instead of queueing a second action. */
  guardando: boolean;
  temporizador: ControlTemporizador;
  alternarSilencio: () => void;
  ayudaAbierta: boolean;
  alternarAyuda: () => void;
}

function escribiendo(objetivo: EventTarget | null): boolean {
  return objetivo instanceof Element && objetivo.closest(CAMPOS_DE_TEXTO) !== null;
}

function esEspacio(tecla: string): boolean {
  return tecla === ' ' || tecla === 'Spacebar';
}

function accionDe(comando: ComandoAtajo, acciones: AccionesPanel): AccionPanel | null {
  switch (comando.tipo) {
    case 'revelar':
      return acciones.revelar(comando.indice);
    case 'tache':
      return acciones.tache;
    case 'roboFallido':
      return acciones.roboFallido;
    case 'asignarTurno':
      return acciones.asignarTurno(comando.equipo);
    case 'deshacer':
      return acciones.deshacer;
    case 'siguienteRonda':
      return acciones.siguienteRonda;
    case 'jugar':
      return acciones.jugar;
    case 'revelarTodas':
      return acciones.revelarTodas;
    default:
      return null;
  }
}

/**
 * Keyboard shortcuts for the conductor panel (see `comandoDeTecla`). Each shortcut runs the
 * same action as its button, so validation and confirmations stay identical; an unavailable
 * action puts its reason in `aviso` (render it in a polite live region).
 *
 * Ignored while typing in a field, while any dialog is open (`?` still closes the help sheet),
 * with Ctrl/Alt/Meta and on auto-repeat. While a save is in flight a shortcut does nothing and
 * `aviso` asks the host to wait. The space bar always belongs to the shortcut: it never
 * activates the focused button (Enter does).
 */
export function useAtajosPanel(opciones: OpcionesAtajos) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [estadoDelAviso, setEstadoDelAviso] = useState(opciones.estado);
  const actuales = useRef(opciones);
  if (estadoDelAviso !== opciones.estado) {
    // The game moved on: an old reason no longer applies.
    setEstadoDelAviso(opciones.estado);
    setAviso(null);
  }
  const espacioConsumido = useRef(false);

  useEffect(() => {
    actuales.current = opciones;
  });

  useEffect(() => {
    function ejecutar(comando: ComandoAtajo) {
      const { acciones, temporizador, alternarSilencio, alternarAyuda } = actuales.current;
      switch (comando.tipo) {
        case 'silenciar':
          alternarSilencio();
          return;
        case 'ayuda':
          alternarAyuda();
          return;
        case 'temporizador': {
          const { corriendo, restante } = temporizador.temporizador;
          if (corriendo) {
            temporizador.pausar();
          } else if (restante > 0) {
            temporizador.iniciar();
          } else {
            setAviso(MOTIVO_SIN_TIEMPO);
          }
          return;
        }
        default: {
          const accion = accionDe(comando, acciones);
          if (accion === null) {
            return;
          }
          if (accion.habilitada) {
            void accion.ejecutar();
          } else {
            setAviso(accion.motivo);
          }
        }
      }
    }

    function alPresionar(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || escribiendo(evento.target)) {
        return;
      }
      const { config, estado, acciones, guardando, ayudaAbierta, alternarAyuda } = actuales.current;
      if (document.querySelector('dialog[open]') !== null) {
        if (ayudaAbierta && evento.key === '?' && !evento.repeat) {
          evento.preventDefault();
          alternarAyuda();
        }
        return;
      }
      if (esEspacio(evento.key)) {
        // Never scroll the page or activate the focused button (it clicks on keyup).
        evento.preventDefault();
        espacioConsumido.current = true;
      }
      if (evento.repeat) {
        return;
      }
      const comando = comandoDeTecla(evento.key, {
        fase: estado.fase,
        respuestas: estado.ronda?.respuestas.length ?? 0,
        equipos: config.equipos.length,
        jugarHabilitado: acciones.jugar.habilitada,
      });
      if (comando === null) {
        return;
      }
      evento.preventDefault();
      // Mute and help never touch the saved log, so only game actions wait for the save.
      if (guardando && comando.tipo !== 'silenciar' && comando.tipo !== 'ayuda') {
        setAviso(MOTIVO_GUARDANDO);
        return;
      }
      setAviso(null);
      ejecutar(comando);
    }

    function alSoltar(evento: KeyboardEvent) {
      if (esEspacio(evento.key) && espacioConsumido.current) {
        espacioConsumido.current = false;
        evento.preventDefault();
      }
    }

    window.addEventListener('keydown', alPresionar);
    window.addEventListener('keyup', alSoltar);
    return () => {
      window.removeEventListener('keydown', alPresionar);
      window.removeEventListener('keyup', alSoltar);
    };
  }, []);

  return { aviso };
}
