import { useId, useMemo, useState } from 'react';

import { proyectarTablero } from '@/engine';
import type { EntornoVentanas } from '@/shared/pantallas';
import { useSonidos } from '@/shared/sonido';
import { usePublicadorTablero, type DatosTablero } from '@/shared/sync';
import { AvisoError } from '@/shared/ui/AvisoError';

import { guiaPanel } from '../dominio';
import { AccionesRonda } from './AccionesRonda';
import { DialogoAjustarPuntos } from './DialogoAjustarPuntos';
import { EncabezadoPanel } from './EncabezadoPanel';
import { FinDeJuego } from './FinDeJuego';
import { MarcadorPanel } from './MarcadorPanel';
import { PanelRondaFinal } from './PanelRondaFinal';
import { PreguntaActual } from './PreguntaActual';
import { useAbrirTablero } from './useAbrirTablero';
import { useAccionesPanel } from './useAccionesPanel';
import type { PartidaCargada, PartidaEnCurso } from './usePartidaEnCurso';
import { useTemporizador, type RelojTemporizador } from './useTemporizador';

export interface DependenciasPanel {
  /** Window used to open the board (tests inject a fake). */
  entornoVentanas?: EntornoVentanas;
  /** Clock for the final-round timer (tests inject a manual one). */
  relojTemporizador?: RelojTemporizador;
}

interface PanelPartidaProps extends DependenciasPanel {
  partida: PartidaCargada;
  control: PartidaEnCurso;
}

function textoAdvertencias(cantidad: number): string {
  return cantidad === 1
    ? 'Se omitió 1 acción guardada que no era válida.'
    : `Se omitieron ${String(cantidad)} acciones guardadas que no eran válidas.`;
}

function Guia({ texto }: { texto: string }) {
  const id = useId();
  return (
    <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <p id={id} className="text-sm font-semibold text-amber-900">
        Siguiente paso
      </p>
      <p role="status" aria-labelledby={id} className="text-lg font-semibold text-slate-900">
        {texto}
      </p>
    </section>
  );
}

/** The conductor panel for a loaded partida; publishes the board projection on every change. */
export function PanelPartida({
  partida,
  control,
  entornoVentanas,
  relojTemporizador,
}: PanelPartidaProps) {
  const { config, estado } = partida;
  const acciones = useAccionesPanel(partida, control);
  const tablero = useAbrirTablero(entornoVentanas);
  // Mute switch; T5.2's `M` shortcut calls the same `alternarSilencio` via `useSonidos()`.
  const { silenciado, alternarSilencio } = useSonidos();
  const [ajustando, setAjustando] = useState(false);

  const jugador = estado.rondaFinal?.jugadorActual ?? 1;
  const segundos = config.rondaFinal?.segundos ?? [0, 0];
  const temporizador = useTemporizador(
    jugador === 1 ? segundos[0] : segundos[1],
    relojTemporizador,
    jugador,
  );
  const enRondaFinal = estado.fase === 'rondaFinal';
  const { restante, total, corriendo } = temporizador.temporizador;

  const vista = useMemo(() => proyectarTablero(config, estado), [config, estado]);
  const datosTablero = useMemo<DatosTablero>(
    () => ({
      partidaId: partida.id,
      vista,
      temporizador: enRondaFinal ? { restante, total, corriendo } : null,
    }),
    [partida.id, vista, enRondaFinal, restante, total, corriendo],
  );
  const { tableroConectado } = usePublicadorTablero(datosTablero);

  const terminado = partida.terminada || estado.fase === 'juegoTerminado';
  const advertencias = estado.advertencias.length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <EncabezadoPanel
        config={config}
        estado={estado}
        tableroConectado={tableroConectado}
        tableroAbierto={tablero.abierto}
        onAbrirTablero={() => void tablero.abrir()}
        silenciado={silenciado}
        onAlternarSilencio={alternarSilencio}
        deshacer={acciones.deshacer}
        terminar={acciones.terminarJuego}
      />
      {tablero.avisos}
      {advertencias > 0 && (
        <p className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {textoAdvertencias(advertencias)}
        </p>
      )}
      {control.error !== null && <AvisoError>{control.error}</AvisoError>}
      {terminado ? (
        <FinDeJuego partida={partida} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Guia texto={guiaPanel(config, estado)} />
            {enRondaFinal && vista.rondaFinal !== null ? (
              <PanelRondaFinal
                config={config}
                estado={estado}
                vista={vista.rondaFinal}
                acciones={acciones}
                control={temporizador}
              />
            ) : (
              <>
                <PreguntaActual config={config} estado={estado} vista={vista} acciones={acciones} />
                <section
                  aria-label="Acciones de la ronda"
                  className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
                >
                  <AccionesRonda config={config} estado={estado} acciones={acciones} />
                </section>
              </>
            )}
          </div>
          <MarcadorPanel
            config={config}
            estado={estado}
            ajustar={acciones.ajustarPuntos(0, 1)}
            onAjustar={() => {
              setAjustando(true);
            }}
          />
        </div>
      )}
      {acciones.dialogo}
      <DialogoAjustarPuntos
        abierto={ajustando}
        config={config}
        acciones={acciones}
        onCerrar={() => {
          setAjustando(false);
        }}
      />
    </div>
  );
}
