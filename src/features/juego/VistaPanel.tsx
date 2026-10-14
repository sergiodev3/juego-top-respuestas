import { useParams } from 'react-router';

import { VistaEnConstruccion } from '@/shared/ui/VistaEnConstruccion';

/** Placeholder until the conductor panel lands (T4.3); it already receives the partida id. */
export function VistaPanel() {
  const { partidaId } = useParams<{ partidaId: string }>();
  return (
    <VistaEnConstruccion
      titulo="Panel del conductor"
      descripcion="Controla la partida: revela respuestas, marca taches y asigna turnos."
    >
      {partidaId !== undefined && <p className="text-slate-700">Partida: {partidaId}</p>}
    </VistaEnConstruccion>
  );
}
