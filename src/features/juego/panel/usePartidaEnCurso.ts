import { useCallback, useEffect, useRef, useState } from 'react';

import { useRepositorios } from '@/db/contextoRepositorios';
import { ErrorPartidaTerminada, ErrorRegistroNoEncontrado } from '@/db/repositorios';
import { reducir, validar, type ConfigPartida, type EstadoJuego, type Evento } from '@/engine';

import { cargarPartida } from '../dominio';

/** A partida rebuilt from its snapshot and log, ready to play. */
export interface PartidaCargada {
  readonly id: string;
  readonly juegoId: string;
  /** Validated snapshot returned by the engine; use it for every engine call. */
  readonly config: ConfigPartida;
  /** The saved log (the source of truth); `estado` is always `reducir(config, eventos)`. */
  readonly eventos: readonly Evento[];
  readonly estado: EstadoJuego;
  /** Stored as `terminada`: no more writes are possible. */
  readonly terminada: boolean;
}

export type CargaPartida =
  | { readonly tipo: 'cargando' }
  | {
      readonly tipo: 'noDisponible';
      readonly errores: readonly string[];
      /** Whether there is a stored record that "Terminar partida" can end. */
      readonly existe: boolean;
      readonly terminada: boolean;
    }
  | { readonly tipo: 'lista'; readonly partida: PartidaCargada };

const ERROR_GUARDAR = 'No se pudo guardar la acción. El juego sigue como estaba; intente de nuevo.';

function mensajeError(causa: unknown): string {
  if (causa instanceof ErrorPartidaTerminada) {
    return 'La partida ya terminó. Vuelva al inicio para iniciar otra.';
  }
  if (causa instanceof ErrorRegistroNoEncontrado) {
    return causa.message;
  }
  return ERROR_GUARDAR;
}

/**
 * Loads a partida and drives it: every dispatch is validated by the engine, saved, and only
 * then applied (the state is rebuilt from the saved log). One write at a time: calls made while
 * a save is in flight are ignored, so double clicks never store an event twice. When the game
 * ends the partida is marked `terminada`.
 */
export function usePartidaEnCurso(partidaId: string) {
  const { partidas } = useRepositorios();
  const [carga, setCarga] = useState<CargaPartida>({ tipo: 'cargando' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enVuelo = useRef(false);
  const actual = useRef(carga);

  useEffect(() => {
    actual.current = carga;
  });

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const registro = await partidas.obtener(partidaId);
        const resultado = cargarPartida(registro);
        if (!vigente) {
          return;
        }
        if (registro === undefined || !resultado.ok) {
          setCarga({
            tipo: 'noDisponible',
            errores: resultado.ok ? [] : resultado.errores,
            existe: registro !== undefined,
            terminada: registro?.estado === 'terminada',
          });
          return;
        }
        const terminada = registro.estado === 'terminada';
        if (!terminada && resultado.estado.fase === 'juegoTerminado') {
          // The game ended but the record was not closed (e.g. the window closed mid-save).
          // Best effort: the end screen does not depend on it.
          void partidas.terminar(partidaId).catch(() => undefined);
        }
        setCarga({
          tipo: 'lista',
          partida: {
            id: registro.id,
            juegoId: registro.juegoId,
            config: resultado.config,
            eventos: registro.eventos,
            estado: resultado.estado,
            terminada: terminada || resultado.estado.fase === 'juegoTerminado',
          },
        });
      } catch {
        if (vigente) {
          setCarga({
            tipo: 'noDisponible',
            errores: ['No se pudo leer la partida. Recargue la página para intentar de nuevo.'],
            existe: false,
            terminada: false,
          });
        }
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [partidas, partidaId]);

  /** Runs one write at a time and applies the saved log it returns. */
  const escribir = useCallback(
    async (operacion: (id: string) => Promise<Evento[]>): Promise<boolean> => {
      const vigente = actual.current;
      if (enVuelo.current || vigente.tipo !== 'lista') {
        return false;
      }
      const { partida } = vigente;
      enVuelo.current = true;
      setGuardando(true);
      setError(null);
      try {
        const eventos = await operacion(partida.id);
        const estado = reducir(partida.config, eventos);
        let { terminada } = partida;
        if (estado.fase === 'juegoTerminado' && !terminada) {
          // The event is saved; if closing the record fails, the next load closes it.
          terminada = await partidas.terminar(partida.id).then(
            () => true,
            () => false,
          );
        }
        setCarga({ tipo: 'lista', partida: { ...partida, eventos, estado, terminada } });
        return true;
      } catch (causa) {
        setError(mensajeError(causa));
        return false;
      } finally {
        enVuelo.current = false;
        setGuardando(false);
      }
    },
    [partidas],
  );

  const despachar = useCallback(
    async (evento: Evento): Promise<boolean> => {
      const vigente = actual.current;
      if (vigente.tipo !== 'lista') {
        return false;
      }
      const resultado = validar(vigente.partida.config, vigente.partida.estado, evento);
      if (!resultado.ok) {
        setError(resultado.motivo);
        return false;
      }
      return escribir((id) => partidas.agregarEvento(id, evento));
    },
    [escribir, partidas],
  );

  const deshacer = useCallback(() => escribir((id) => partidas.deshacer(id)), [escribir, partidas]);

  /** Ends a partida that cannot be rebuilt, so a new one can start. */
  const terminarNoDisponible = useCallback(async (): Promise<boolean> => {
    const vigente = actual.current;
    if (vigente.tipo !== 'noDisponible' || !vigente.existe || enVuelo.current) {
      return false;
    }
    enVuelo.current = true;
    setGuardando(true);
    setError(null);
    try {
      await partidas.terminar(partidaId);
      setCarga({ ...vigente, terminada: true });
      return true;
    } catch (causa) {
      setError(mensajeError(causa));
      return false;
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }, [partidas, partidaId]);

  return { carga, guardando, error, despachar, deshacer, terminarNoDisponible };
}

export type PartidaEnCurso = ReturnType<typeof usePartidaEnCurso>;

/** Undo is possible while the partida is open and its log is not empty. */
export function motivoSinDeshacer(partida: PartidaCargada): string | null {
  if (partida.terminada) {
    return 'La partida ya terminó.';
  }
  return partida.eventos.length === 0 ? 'No hay acciones para deshacer.' : null;
}
