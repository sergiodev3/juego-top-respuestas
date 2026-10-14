import { useEffect, useId, useState } from 'react';

import type {
  ConfigPartida,
  EstadoJuego,
  Jugador,
  PreguntaSnapshot,
  RespuestaRondaFinal,
  VistaRondaFinal,
} from '@/engine';
import { useSonidos } from '@/shared/sonido';
import { CLASE_BOTON_SECUNDARIO, CLASE_CAMPO, CLASE_ETIQUETA } from '@/shared/ui/clases';

import { nombreEquipo } from '../dominio';
import { BotonAccion } from './BotonAccion';
import { MarcaVisibilidad } from './MarcaVisibilidad';
import type { AccionesPanel, AccionPanel } from './useAccionesPanel';
import type { ControlTemporizador } from './useTemporizador';

const SIN_ELEGIR = '';
const SIN_COINCIDENCIA = 'ninguna';

interface PanelRondaFinalProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  vista: VistaRondaFinal;
  acciones: AccionesPanel;
  control: ControlTemporizador;
}

function TemporizadorPanel({
  control,
  jugador,
}: {
  control: ControlTemporizador;
  jugador: Jugador;
}) {
  const id = useId();
  const { restante, corriendo } = control.temporizador;
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <p id={id} className="text-sm font-semibold text-slate-700">
        Tiempo del jugador {jugador}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p
          role="timer"
          aria-label="Tiempo restante"
          className="min-w-24 rounded-lg bg-slate-900 px-4 py-2 text-center text-3xl font-black text-amber-300 tabular-nums"
        >
          {restante} s
        </p>
        <button
          type="button"
          className={CLASE_BOTON_SECUNDARIO}
          disabled={corriendo || restante <= 0}
          onClick={control.iniciar}
        >
          Iniciar tiempo
        </button>
        <button
          type="button"
          className={CLASE_BOTON_SECUNDARIO}
          disabled={!corriendo}
          onClick={control.pausar}
        >
          Pausar tiempo
        </button>
        <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={control.reiniciar}>
          Reiniciar tiempo
        </button>
      </div>
    </div>
  );
}

function textoCoincidencia(pregunta: PreguntaSnapshot, respuesta: RespuestaRondaFinal): string {
  if (respuesta.indice === null) {
    return 'Sin coincidencia (0 pts)';
  }
  const coincide = pregunta.respuestas[respuesta.indice];
  return coincide === undefined
    ? 'Sin coincidencia (0 pts)'
    : `${String(respuesta.indice + 1)}. ${coincide.texto} (${String(coincide.puntos)} pts)`;
}

interface PreguntaFinalProps {
  indice: number;
  pregunta: PreguntaSnapshot;
  estado: EstadoJuego;
  vista: VistaRondaFinal;
  acciones: AccionesPanel;
}

/** One final-round question: all answers for the host, both players' answers, and the input. */
function PreguntaFinal({ indice, pregunta, estado, vista, acciones }: PreguntaFinalProps) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [coincidencia, setCoincidencia] = useState(SIN_ELEGIR);
  const { reproducir } = useSonidos();
  const rondaFinal = estado.rondaFinal;
  const jugador = rondaFinal?.jugadorActual ?? 1;
  const indiceElegido =
    coincidencia === SIN_ELEGIR || coincidencia === SIN_COINCIDENCIA ? null : Number(coincidencia);
  const responder = acciones.rfResponder(jugador, indice, indiceElegido, texto.trim());
  const repetida = coincidencia !== SIN_ELEGIR && responder.codigo === 'RESPUESTA_REPETIDA';

  useEffect(() => {
    // TV-show buzzer when the host picks an answer the other player already gave (UI only: the
    // engine rejects a repeat, so nothing is saved and no event sound plays).
    if (repetida) {
      reproducir('tache');
    }
  }, [repetida, reproducir]);

  if (rondaFinal === null) {
    return null;
  }
  const numero = indice + 1;
  const falta =
    texto.trim() === ''
      ? 'Escriba lo que respondió el jugador.'
      : coincidencia === SIN_ELEGIR
        ? 'Elija la respuesta que coincide o «Sin coincidencia».'
        : null;
  const registrar: AccionPanel = {
    ...responder,
    habilitada: responder.habilitada && falta === null,
    motivo: falta ?? responder.motivo,
    async ejecutar() {
      if (falta !== null) {
        return false;
      }
      const guardado = await responder.ejecutar();
      if (guardado) {
        setTexto('');
        setCoincidencia(SIN_ELEGIR);
      }
      return guardado;
    },
  };

  return (
    <li className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h3 id={id} className="text-lg font-bold text-slate-900">
        Pregunta {numero}: {pregunta.texto}
      </h3>
      <ol
        aria-label={`Respuestas de la pregunta ${String(numero)}`}
        className="grid gap-1 text-sm sm:grid-cols-2"
      >
        {pregunta.respuestas.map((respuesta, i) => (
          <li key={i} className="rounded bg-slate-100 px-2 py-1 text-slate-900">
            <span className="font-semibold">
              {i + 1}. {respuesta.texto}
            </span>{' '}
            ({respuesta.puntos} pts)
            {respuesta.sinonimos.length > 0 && (
              <span className="text-slate-700"> · Sinónimos: {respuesta.sinonimos.join(', ')}</span>
            )}
          </li>
        ))}
      </ol>
      <ul
        aria-label={`Respuestas registradas de la pregunta ${String(numero)}`}
        className="space-y-2"
      >
        {([1, 2] as const).map((deJugador) => {
          const registrada =
            (deJugador === 1 ? rondaFinal.jugador1 : rondaFinal.jugador2)[indice] ?? null;
          if (registrada === null) {
            return null;
          }
          const vistaJugador = vista.jugadores[deJugador - 1];
          const visible = vistaJugador?.respuestas[indice]?.revelada ?? false;
          const ocultoPorTurno = registrada.revelada && vistaJugador?.oculto === true;
          return (
            <li
              key={deJugador}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
            >
              <p className="flex-1 text-slate-900">
                <span className="font-semibold">Jugador {deJugador}:</span> «{registrada.texto}» →{' '}
                {textoCoincidencia(pregunta, registrada)}
              </p>
              <MarcaVisibilidad
                visible={visible}
                textoOculta={ocultoPorTurno ? 'Oculta mientras juega el jugador 2' : 'Oculta'}
              />
              {!registrada.revelada && (
                <BotonAccion
                  accion={acciones.rfRevelar(deJugador, indice)}
                  etiqueta={`Revelar la respuesta del jugador ${String(deJugador)} en la pregunta ${String(numero)}`}
                  variante="primario"
                >
                  Revelar
                </BotonAccion>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor={`${id}-texto`} className={CLASE_ETIQUETA}>
            Respuesta del jugador {jugador} a la pregunta {numero}
          </label>
          <input
            id={`${id}-texto`}
            value={texto}
            maxLength={80}
            autoComplete="off"
            onChange={(evento) => {
              setTexto(evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          />
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`${id}-coincidencia`} className={CLASE_ETIQUETA}>
            Coincidencia del jugador {jugador} en la pregunta {numero}
          </label>
          <select
            id={`${id}-coincidencia`}
            value={coincidencia}
            aria-invalid={repetida}
            onChange={(evento) => {
              setCoincidencia(evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          >
            <option value={SIN_ELEGIR}>Elija…</option>
            {pregunta.respuestas.map((respuesta, i) => (
              <option key={i} value={String(i)}>
                {`${String(i + 1)}. ${respuesta.texto} (${String(respuesta.puntos)} pts)`}
              </option>
            ))}
            <option value={SIN_COINCIDENCIA}>Sin coincidencia</option>
          </select>
        </div>
        <BotonAccion
          accion={registrar}
          etiqueta={`Registrar la respuesta de la pregunta ${String(numero)}`}
          variante="primario"
        >
          Registrar
        </BotonAccion>
      </div>
      {repetida && (
        <p
          role="alert"
          className="rounded-md border-2 border-red-700 bg-red-50 px-4 py-3 text-lg font-bold text-red-900"
        >
          Respuesta repetida: pida otra respuesta.
        </p>
      )}
    </li>
  );
}

/** Final round ("Respuesta rápida"): playing team, current player, timer, 5 questions. */
export function PanelRondaFinal({
  config,
  estado,
  vista,
  acciones,
  control,
}: PanelRondaFinalProps) {
  const id = useId();
  const rondaFinal = estado.rondaFinal;
  const configFinal = config.rondaFinal;
  if (rondaFinal === null || configFinal === null) {
    return null;
  }
  const iniciada = [...rondaFinal.jugador1, ...rondaFinal.jugador2].some((r) => r !== null);
  return (
    <div className="space-y-4">
      <section
        aria-labelledby={id}
        className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id={id} className="text-2xl font-bold">
          Ronda final
        </h2>
        <div className="flex flex-wrap gap-6 text-lg">
          <p>
            Juega: <strong>{nombreEquipo(config, rondaFinal.equipo)}</strong>
          </p>
          <p>
            Jugador en turno: <strong>{rondaFinal.jugadorActual}</strong>
          </p>
          <p className="font-semibold">
            Total: {vista.total} de {configFinal.meta} puntos
          </p>
        </div>
        {!iniciada && (
          <div
            role="group"
            aria-label="Equipo que juega la ronda final"
            className="flex flex-wrap gap-2"
          >
            {config.equipos.map((equipo, indice) => (
              <BotonAccion key={equipo.id} accion={acciones.asignarTurno(indice)}>
                Turno: {equipo.nombre}
              </BotonAccion>
            ))}
          </div>
        )}
        <TemporizadorPanel control={control} jugador={rondaFinal.jugadorActual} />
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <BotonAccion accion={acciones.rfSiguienteJugador}>Siguiente jugador</BotonAccion>
          <BotonAccion accion={acciones.rfTerminar} variante="peligro">
            Terminar ronda final
          </BotonAccion>
        </div>
      </section>
      <ol aria-label="Preguntas de la ronda final" className="space-y-4">
        {configFinal.preguntas.map((pregunta, indice) => (
          <PreguntaFinal
            key={`${pregunta.id}-${String(indice)}`}
            indice={indice}
            pregunta={pregunta}
            estado={estado}
            vista={vista}
            acciones={acciones}
          />
        ))}
      </ol>
    </div>
  );
}
