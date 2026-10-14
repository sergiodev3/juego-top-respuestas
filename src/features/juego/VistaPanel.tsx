import { useLiveQuery } from 'dexie-react-hooks';
import { Link, Navigate, useParams } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { RUTAS, rutaPanel } from '@/shared/rutas';
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';

import { PanelPartida, type DependenciasPanel } from './panel/PanelPartida';
import { PartidaNoDisponible } from './panel/PartidaNoDisponible';
import { usePartidaEnCurso } from './panel/usePartidaEnCurso';

/** `/juego/panel` without an id: go to the partida in progress, or explain how to start one. */
function SinPartidaSeleccionada() {
  const { partidas } = useRepositorios();
  const resultado = useLiveQuery(
    async () => ({ partida: await partidas.obtenerEnCurso() }),
    [partidas],
  );
  if (resultado === undefined) {
    return <p className="text-slate-700">Buscando la partida en curso…</p>;
  }
  if (resultado.partida !== undefined) {
    return <Navigate to={rutaPanel(resultado.partida.id)} replace />;
  }
  return (
    <section aria-labelledby="titulo-panel" className="mx-auto max-w-3xl space-y-4">
      <h1 id="titulo-panel" className="text-3xl font-bold tracking-tight">
        Panel del conductor
      </h1>
      <p className="text-lg text-slate-700">No hay una partida en curso.</p>
      <div className="flex flex-wrap gap-3">
        <Link to={RUTAS.juegoRapido} className={CLASE_BOTON_PRIMARIO}>
          Nuevo juego rápido
        </Link>
        <Link to={RUTAS.configurarJuego} className={CLASE_BOTON_SECUNDARIO}>
          Configurar juego
        </Link>
      </div>
    </section>
  );
}

function PanelConductor({ partidaId, ...dependencias }: { partidaId: string } & DependenciasPanel) {
  const control = usePartidaEnCurso(partidaId);
  const { carga } = control;
  switch (carga.tipo) {
    case 'cargando':
      return <p className="text-slate-700">Cargando partida…</p>;
    case 'noDisponible':
      return (
        <PartidaNoDisponible
          carga={carga}
          guardando={control.guardando}
          error={control.error}
          onTerminar={control.terminarNoDisponible}
        />
      );
    case 'lista':
      return <PanelPartida partida={carga.partida} control={control} {...dependencias} />;
  }
}

/**
 * Conductor panel (`/juego/panel/:partidaId`), the single source of truth of a running game.
 * Remounts per partida so starting "Jugar de nuevo" begins from a clean state.
 */
export function VistaPanel(dependencias: DependenciasPanel) {
  const { partidaId } = useParams<{ partidaId: string }>();
  if (partidaId === undefined) {
    return <SinPartidaSeleccionada />;
  }
  return <PanelConductor key={partidaId} partidaId={partidaId} {...dependencias} />;
}
