import type { ConfigPartida, EstadoJuego } from '@/engine';
import { CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';
import { cx } from '@/shared/utils/cx';

import { ETIQUETAS_FASE } from '../dominio';
import { BotonAccion } from './BotonAccion';
import type { AccionPanel } from './useAccionesPanel';

interface EncabezadoPanelProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  tableroConectado: boolean;
  tableroAbierto: boolean;
  onAbrirTablero: () => void;
  silenciado: boolean;
  onAlternarSilencio: () => void;
  onAbrirAtajos: () => void;
  deshacer: AccionPanel;
  terminar: AccionPanel;
}

/**
 * Game name, round, multiplier, phase, board status, the mute switch, the shortcut sheet and the
 * always-present actions.
 */
export function EncabezadoPanel({
  config,
  estado,
  tableroConectado,
  tableroAbierto,
  onAbrirTablero,
  silenciado,
  onAlternarSilencio,
  onAbrirAtajos,
  deshacer,
  terminar,
}: EncabezadoPanelProps) {
  const ronda = estado.ronda;
  const rondaRegular = ronda !== null && estado.fase !== 'rondaFinal';
  return (
    <header className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{config.nombre}</h1>
          <ul aria-label="Estado del juego" className="flex flex-wrap gap-2 text-sm font-semibold">
            {rondaRegular && (
              <>
                <li className="rounded-full bg-slate-200 px-3 py-1 text-slate-900">
                  Ronda {ronda.indice + 1} de {config.rondas.length}
                </li>
                <li className="rounded-full bg-amber-300 px-3 py-1 text-slate-950">
                  Puntos x{config.rondas[ronda.indice]?.multiplicador ?? 1}
                </li>
              </>
            )}
            <li className="rounded-full bg-slate-900 px-3 py-1 text-white">
              Fase: {ETIQUETAS_FASE[estado.fase]}
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span
              aria-hidden="true"
              className={cx(
                'inline-block size-3 rounded-full border',
                tableroConectado
                  ? 'border-emerald-800 bg-emerald-600'
                  : 'border-slate-500 bg-transparent',
              )}
            />
            {tableroConectado ? 'Tablero conectado' : 'Tablero desconectado'}
          </p>
          <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={onAbrirTablero}>
            {tableroAbierto || tableroConectado
              ? 'Reconectar tablero'
              : 'Abrir tablero en el proyector'}
          </button>
          <button
            type="button"
            aria-pressed={silenciado}
            className={cx(
              CLASE_BOTON_SECUNDARIO,
              'aria-pressed:border-amber-700 aria-pressed:bg-amber-200 aria-pressed:hover:bg-amber-300',
            )}
            onClick={onAlternarSilencio}
          >
            Silenciar sonido
          </button>
          <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={onAbrirAtajos}>
            Atajos de teclado
          </button>
          <BotonAccion accion={deshacer}>Deshacer</BotonAccion>
          <BotonAccion accion={terminar} variante="peligro">
            Terminar partida
          </BotonAccion>
        </div>
      </div>
    </header>
  );
}
