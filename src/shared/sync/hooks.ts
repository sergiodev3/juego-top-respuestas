import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import type { VistaTablero } from '@/engine';

import { useCanalSync } from './contextoCanal';
import { VERSION_PROTOCOLO, type MensajeSync, type Temporizador } from './mensajes';
import {
  crearContadorSecuencia,
  ESTADO_TABLERO_INICIAL,
  INTERVALO_LATIDO_MS,
  reducirEstadoTablero,
  tableroConectado,
  type EstadoTablero,
} from './protocolo';

/** What the panel shows on the board right now. */
export interface DatosTablero {
  partidaId: string;
  /** Always `proyectarTablero(config, estado)`; never build it by hand. */
  vista: VistaTablero;
  temporizador: Temporizador | null;
}

export interface OpcionesPublicador {
  /** Clock in epoch ms (tests). */
  ahora?: () => number;
}

const SIN_PARTIDA: MensajeSync = { v: VERSION_PROTOCOLO, tipo: 'SIN_PARTIDA' };
const INTERVALO_PRESENCIA_MS = 1000;
const relojSistema = () => Date.now();

/**
 * Panel side. Publishes `ESTADO_TABLERO` whenever `datos` changes (by value; identical data is
 * not resent) or `SIN_PARTIDA` when it is `null`, answers `SOLICITAR_ESTADO`, and sends
 * `SIN_PARTIDA` on unmount. `tableroConectado` is true while a board message is at most 5 s old.
 */
export function usePublicadorTablero(
  datos: DatosTablero | null,
  { ahora = relojSistema }: OpcionesPublicador = {},
): { tableroConectado: boolean } {
  const canal = useCanalSync();
  const contador = useMemo(() => crearContadorSecuencia(ahora), [ahora]);
  const actuales = useRef(datos);
  const [ultimoLatido, setUltimoLatido] = useState<number | null>(null);
  const [momento, setMomento] = useState(() => ahora());

  useEffect(() => {
    actuales.current = datos;
  });

  const publicarActual = useCallback(() => {
    const vigentes = actuales.current;
    canal.publicar(
      vigentes === null
        ? SIN_PARTIDA
        : {
            v: VERSION_PROTOCOLO,
            tipo: 'ESTADO_TABLERO',
            partidaId: vigentes.partidaId,
            secuencia: contador.siguiente(),
            vista: vigentes.vista,
            temporizador: vigentes.temporizador,
          },
    );
  }, [canal, contador]);

  const clave = datos === null ? null : JSON.stringify(datos);
  useEffect(() => {
    publicarActual();
  }, [clave, publicarActual]);

  useEffect(
    () =>
      canal.suscribir((mensaje) => {
        if (mensaje.tipo === 'SOLICITAR_ESTADO' || mensaje.tipo === 'TABLERO_PRESENTE') {
          setUltimoLatido(ahora());
        }
        if (mensaje.tipo === 'SOLICITAR_ESTADO') {
          publicarActual();
        }
      }),
    [canal, ahora, publicarActual],
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setMomento(ahora());
    }, INTERVALO_PRESENCIA_MS);
    return () => {
      clearInterval(intervalo);
    };
  }, [ahora]);

  useEffect(
    () => () => {
      canal.publicar(SIN_PARTIDA);
    },
    [canal],
  );

  return {
    tableroConectado: tableroConectado(ultimoLatido, Math.max(momento, ultimoLatido ?? momento)),
  };
}

/**
 * Board side. Asks for the state on mount and whenever the window becomes visible or regains
 * focus, sends a heartbeat every 2 s, and keeps the newest valid view (stale ones are ignored).
 */
export function useSuscriptorTablero(): EstadoTablero {
  const canal = useCanalSync();
  const [estado, despachar] = useReducer(reducirEstadoTablero, ESTADO_TABLERO_INICIAL);

  useEffect(() => {
    const cancelar = canal.suscribir(despachar);
    const solicitar = () => {
      canal.publicar({ v: VERSION_PROTOCOLO, tipo: 'SOLICITAR_ESTADO' });
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        solicitar();
      }
    };
    solicitar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('focus', solicitar);
    const latido = setInterval(() => {
      canal.publicar({ v: VERSION_PROTOCOLO, tipo: 'TABLERO_PRESENTE' });
    }, INTERVALO_LATIDO_MS);
    return () => {
      cancelar();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('focus', solicitar);
      clearInterval(latido);
    };
  }, [canal]);

  return estado;
}
