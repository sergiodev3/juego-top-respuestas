import { useEffect, useId, useRef } from 'react';

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
import { cx } from '@/shared/utils/cx';

import { nombreEquipo } from '../dominio';
import { BotonAccion } from './BotonAccion';
import { MarcaVisibilidad } from './MarcaVisibilidad';
import type { AccionesPanel } from './useAccionesPanel';
import { SIN_COINCIDENCIA, SIN_ELEGIR, type BorradoresRondaFinal } from './useBorradoresRondaFinal';
import type { ControlTemporizador } from './useTemporizador';

interface PanelRondaFinalProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  vista: VistaRondaFinal;
  acciones: AccionesPanel;
  control: ControlTemporizador;
  borradores: BorradoresRondaFinal;
  /** Shows why Enter in a text field did not record (the keyboard notice). */
  onAviso: (motivo: string | null) => void;
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
  borradores: BorradoresRondaFinal;
  onAviso: (motivo: string | null) => void;
}

/** What a recorded answer said; typing is optional, so a blank one reads "Sin respuesta". */
function textoRegistrado(texto: string): string {
  return texto.trim() === '' ? 'Sin respuesta' : `«${texto}»`;
}

/** One final-round question: all answers for the host, both players' answers, and the input. */
function PreguntaFinal({
  indice,
  pregunta,
  estado,
  vista,
  acciones,
  borradores,
  onAviso,
}: PreguntaFinalProps) {
  const id = useId();
  const { reproducir } = useSonidos();
  const rondaFinal = estado.rondaFinal;
  const jugador = rondaFinal?.jugadorActual ?? 1;
  const { borrador, repetida, registrar } = borradores.registro(indice);
  const actual = borradores.actual === indice;
  const repetidaAntes = useRef(false);

  useEffect(() => {
    // TV-show buzzer when the host picks an answer the other player already gave (UI only: the
    // engine rejects a repeat, so nothing is saved and no event sound plays). Only the change
    // to repeated plays it, so a new `reproducir` (sound setup change) never replays it.
    if (repetida && !repetidaAntes.current) {
      reproducir('tache');
    }
    repetidaAntes.current = repetida;
  }, [repetida, reproducir]);

  if (rondaFinal === null) {
    return null;
  }
  const numero = indice + 1;

  return (
    <li
      data-pregunta-final={indice}
      tabIndex={-1}
      aria-current={actual ? 'step' : undefined}
      className={cx(
        'space-y-3 rounded-xl bg-white p-4 shadow-sm',
        actual ? 'border-4 border-amber-500' : 'border border-slate-300',
      )}
    >
      <h3 id={id} className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
        <span>
          Pregunta {numero}: {pregunta.texto}
        </span>
        {actual && (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-sm font-bold text-amber-950">
            Pregunta actual
          </span>
        )}
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
                <span className="font-semibold">Jugador {deJugador}:</span>{' '}
                {textoRegistrado(registrada.texto)} → {textoCoincidencia(pregunta, registrada)}
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
      <form
        aria-label={`Registrar la pregunta ${String(numero)}`}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          // Enter in the text field records the question (the window shortcut ignores fields).
          evento.preventDefault();
          if (registrar.habilitada) {
            onAviso(null);
            void registrar.ejecutar();
          } else {
            onAviso(registrar.motivo);
          }
        }}
      >
        <div className="min-w-48 flex-1">
          <label htmlFor={`${id}-texto`} className={CLASE_ETIQUETA}>
            Respuesta del jugador {jugador} a la pregunta {numero}
          </label>
          <input
            id={`${id}-texto`}
            value={borrador.texto}
            maxLength={80}
            autoComplete="off"
            placeholder="Opcional"
            onChange={(evento) => {
              borradores.cambiarTexto(indice, evento.target.value);
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
            value={borrador.coincidencia}
            aria-invalid={repetida}
            onChange={(evento) => {
              borradores.elegirValor(indice, evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          >
            <option value={SIN_ELEGIR}>Elige…</option>
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
      </form>
      {repetida && (
        <p
          role="alert"
          className="rounded-md border-2 border-red-700 bg-red-50 px-4 py-3 text-lg font-bold text-red-900"
        >
          Respuesta repetida: pide otra respuesta.
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
  borradores,
  onAviso,
}: PanelRondaFinalProps) {
  const id = useId();
  const lista = useRef<HTMLOListElement>(null);
  const actualAntes = useRef(borradores.actual);
  const { actual } = borradores;

  useEffect(() => {
    // Focus follows the current question (record, undo, next player), so the keyboard keeps
    // working there and `Enter` never lands on a button left behind. With every question
    // answered, focus rests on the list.
    if (actualAntes.current === actual) {
      return;
    }
    actualAntes.current = actual;
    const contenedor = lista.current;
    const destino =
      actual === null
        ? contenedor
        : contenedor?.querySelector<HTMLElement>(`[data-pregunta-final="${String(actual)}"]`);
    destino?.focus();
  }, [actual]);

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
      <ol ref={lista} tabIndex={-1} aria-label="Preguntas de la ronda final" className="space-y-4">
        {configFinal.preguntas.map((pregunta, indice) => (
          <PreguntaFinal
            key={`${pregunta.id}-${String(indice)}`}
            indice={indice}
            pregunta={pregunta}
            estado={estado}
            vista={vista}
            acciones={acciones}
            borradores={borradores}
            onAviso={onAviso}
          />
        ))}
      </ol>
    </div>
  );
}
