import { useId, type ReactNode } from 'react';

import type { ConfigPartida, EstadoJuego } from '@/engine';

import { accionSiguienteRonda } from '../dominio';
import { BotonAccion } from './BotonAccion';
import type { AccionesPanel } from './useAccionesPanel';

interface AccionesRondaProps {
  config: ConfigPartida;
  estado: EstadoJuego;
  acciones: AccionesPanel;
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <p id={id} className="text-sm font-semibold text-slate-700">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Phase-aware actions of a regular round (the answers' "Revelar" lives on each answer). */
export function AccionesRonda({ config, estado, acciones }: AccionesRondaProps) {
  const { fase } = estado;
  const equipos = config.equipos;
  const asignarTurno = fase === 'caraACara' || (fase === 'robo' && equipos.length > 2);
  return (
    <div className="space-y-4">
      {asignarTurno && (
        <Grupo titulo={fase === 'robo' ? 'Equipo que intenta robar' : 'Turno (quién presionó)'}>
          {equipos.map((equipo, indice) => (
            <BotonAccion key={equipo.id} accion={acciones.asignarTurno(indice)}>
              Turno: {equipo.nombre}
            </BotonAccion>
          ))}
        </Grupo>
      )}
      {fase === 'caraACara' && (
        <>
          <Grupo titulo="Respuesta fuera del tablero">
            <BotonAccion accion={acciones.tache} variante="peligro">
              Tache
            </BotonAccion>
          </Grupo>
          <Grupo titulo="Decisión del ganador del cara a cara">
            <BotonAccion accion={acciones.jugar} variante="primario">
              Jugar
            </BotonAccion>
            {equipos.length === 2 ? (
              <BotonAccion accion={acciones.pasar()}>Pasar</BotonAccion>
            ) : (
              equipos.map((equipo, indice) => (
                <BotonAccion key={equipo.id} accion={acciones.pasar(indice)}>
                  Pasar a {equipo.nombre}
                </BotonAccion>
              ))
            )}
          </Grupo>
        </>
      )}
      {fase === 'enJuego' && (
        <Grupo titulo="Respuesta fuera del tablero">
          <BotonAccion accion={acciones.tache} variante="peligro">
            Tache
          </BotonAccion>
        </Grupo>
      )}
      {fase === 'robo' && (
        <Grupo titulo="Resultado del robo">
          <BotonAccion accion={acciones.roboFallido} variante="peligro">
            Robo fallido
          </BotonAccion>
        </Grupo>
      )}
      {fase === 'finDeRonda' && (
        <Grupo titulo="Cierre de la ronda">
          <BotonAccion accion={acciones.revelarTodas}>Revelar todas</BotonAccion>
          <BotonAccion accion={acciones.siguienteRonda} variante="primario">
            {accionSiguienteRonda(config, estado)}
          </BotonAccion>
        </Grupo>
      )}
    </div>
  );
}
