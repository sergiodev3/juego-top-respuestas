import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import {
  ErrorConfigPartida,
  type DatosNuevaPartida,
  type RepositorioPreguntas,
} from '@/db/repositorios';
import type { DatosJuego, Pregunta } from '@/shared/modelo';
import { rutaPanel } from '@/shared/rutas';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import { crearConfigPartida, type ResultadoConfigPartida } from './dominio';

/** Reads the game's current bank questions and builds the partida snapshot. */
export async function prepararConfigPartida(
  preguntas: RepositorioPreguntas,
  juego: DatosJuego,
): Promise<ResultadoConfigPartida> {
  const { rondaFinal } = juego.reglas;
  const ids = [
    ...juego.rondas.map((ronda) => ronda.preguntaId),
    ...(rondaFinal.activa ? rondaFinal.preguntaIds : []),
  ];
  const encontradas = await Promise.all(ids.map((id) => preguntas.obtener(id)));
  const porId = new Map<string, Pregunta>();
  for (const pregunta of encontradas) {
    if (pregunta !== undefined) {
      porId.set(pregunta.id, pregunta);
    }
  }
  return crearConfigPartida(juego, porId);
}

/**
 * Shared "start a partida" step: asks for confirmation when another partida is in progress
 * (the repository ends it when the new one is created), then opens the conductor panel.
 * Render `dialogo` once in the calling view.
 */
export function useIniciarPartida() {
  const { partidas } = useRepositorios();
  const navigate = useNavigate();
  const [pendiente, setPendiente] = useState<DatosNuevaPartida | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(datos: DatosNuevaPartida) {
    setOcupado(true);
    try {
      const partida = await partidas.crear(datos);
      void navigate(rutaPanel(partida.id));
    } catch (causa) {
      setError(
        causa instanceof ErrorConfigPartida
          ? causa.errores.join(' ')
          : 'No se pudo iniciar la partida. Intente de nuevo.',
      );
    } finally {
      setOcupado(false);
      setPendiente(null);
    }
  }

  async function iniciar(datos: DatosNuevaPartida) {
    setError(null);
    try {
      const enCurso = await partidas.obtenerEnCurso();
      if (enCurso === undefined) {
        await crear(datos);
      } else {
        setPendiente(datos);
      }
    } catch {
      setError('No se pudo iniciar la partida. Intente de nuevo.');
    }
  }

  const dialogo = (
    <DialogoConfirmacion
      abierto={pendiente !== null}
      titulo="¿Iniciar una nueva partida?"
      descripcion="Hay una partida en curso. Si inicia una nueva, la anterior se dará por terminada."
      textoConfirmar="Iniciar nueva partida"
      ocupado={ocupado}
      onConfirmar={() => {
        if (pendiente !== null) {
          void crear(pendiente);
        }
      }}
      onCancelar={() => {
        setPendiente(null);
      }}
    />
  );

  return { iniciar, dialogo, error, ocupado };
}
