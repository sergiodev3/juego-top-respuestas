import { useId } from 'react';

import { puntosVisibles, type ConfigPartida, type EstadoJuego } from '@/engine';

import { letraEquipo } from '../dominio';
import { BotonAccion } from './BotonAccion';
import type { AccionPanel } from './useAccionesPanel';

interface MarcadorPanelProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  /** Whether a manual adjustment is possible; the button opens the adjustment dialog. */
  ajustar: AccionPanel;
  onAjustar: () => void;
}

/** What each team is doing right now, in words (never color alone). */
function papeles(estado: EstadoJuego, equipo: number): string[] {
  const { ronda, rondaFinal } = estado;
  if (rondaFinal !== null) {
    return rondaFinal.equipo === equipo ? ['Juega la ronda final'] : [];
  }
  if (ronda === null) {
    return [];
  }
  const lista: string[] = [];
  if (estado.fase === 'caraACara') {
    if (ronda.caraACara.respondedor === equipo) {
      lista.push('Responde');
    }
    if (ronda.caraACara.ganador === equipo) {
      lista.push('Ganó el cara a cara');
    }
    return lista;
  }
  if (ronda.equipoControl === equipo) {
    lista.push('Control');
  }
  if (estado.fase === 'robo' && ronda.equipoRobo === equipo) {
    lista.push('Roba');
  }
  if (ronda.ganador === equipo) {
    lista.push('Ganó la ronda');
  }
  return lista;
}

/** Scores with keys A-D, team roles, strikes and the round pot (multiplied, as on the board). */
export function MarcadorPanel({ config, estado, ajustar, onAjustar }: MarcadorPanelProps) {
  const id = useId();
  const ronda = estado.rondaFinal === null ? estado.ronda : null;
  const abrirAjuste = {
    habilitada: ajustar.habilitada,
    motivo: ajustar.motivo,
    ejecutar() {
      onAjustar();
      return Promise.resolve(true);
    },
  };
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-xl font-bold">
          Marcador
        </h2>
        <BotonAccion accion={abrirAjuste}>Ajustar puntos</BotonAccion>
      </div>
      <ul aria-label="Marcador" className="space-y-2">
        {config.equipos.map((equipo, indice) => {
          const roles = papeles(estado, indice);
          return (
            <li
              key={equipo.id}
              className="flex items-center gap-3 rounded-lg border border-slate-300 px-3 py-2"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: equipo.color }}
                className="size-6 shrink-0 rounded-full border border-slate-900"
              />
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{equipo.nombre}</p>
                <p className="text-xs text-slate-600">Tecla {letraEquipo(indice)}</p>
                {roles.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {roles.map((rol) => (
                      <span
                        key={rol}
                        className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-950"
                      >
                        {rol}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {estado.puntajes[indice] ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
      {ronda !== null && estado.fase !== 'juegoTerminado' && (
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3">
          <p className="font-semibold text-slate-900">
            Tachas: {ronda.tachas} de {config.tachasMaximas}
          </p>
          <span aria-hidden="true" className="text-xl font-black text-red-700">
            {'X'.repeat(ronda.tachas)}
          </span>
          {/* Already multiplied, like the board: what the team wins if the round ends now. */}
          <p className="font-semibold text-slate-900">
            Puntos en juego: {puntosVisibles(config, ronda).bolsa}
          </p>
        </div>
      )}
    </section>
  );
}
