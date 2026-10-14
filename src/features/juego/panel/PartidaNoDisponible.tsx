import { useState } from 'react';
import { Link } from 'react-router';

import { RUTAS } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_PELIGRO, CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import type { CargaPartida } from './usePartidaEnCurso';

interface PartidaNoDisponibleProps {
  carga: Extract<CargaPartida, { tipo: 'noDisponible' }>;
  guardando: boolean;
  error: string | null;
  onTerminar: () => Promise<boolean>;
}

/** Friendly recovery screen for a missing or unrecoverable partida (never a crash). */
export function PartidaNoDisponible({
  carga,
  guardando,
  error,
  onTerminar,
}: PartidaNoDisponibleProps) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <section aria-labelledby="titulo-partida" className="mx-auto max-w-3xl space-y-4">
      <h1 id="titulo-partida" className="text-3xl font-bold tracking-tight">
        No se puede abrir la partida
      </h1>
      {carga.errores.length > 0 && (
        <ul className="list-disc space-y-1 rounded-lg border border-slate-300 bg-white py-3 pr-4 pl-8 text-slate-800">
          {carga.errores.map((mensaje) => (
            <li key={mensaje}>{mensaje}</li>
          ))}
        </ul>
      )}
      {carga.terminada ? (
        <p className="font-medium text-slate-800">La partida se dio por terminada.</p>
      ) : (
        carga.existe && (
          <p className="text-slate-700">
            Puede darla por terminada para iniciar otra partida desde el inicio.
          </p>
        )
      )}
      {error !== null && <AvisoError>{error}</AvisoError>}
      <div className="flex flex-wrap gap-3">
        {carga.existe && !carga.terminada && (
          <button
            type="button"
            className={CLASE_BOTON_PELIGRO}
            disabled={guardando}
            onClick={() => {
              setConfirmando(true);
            }}
          >
            Terminar partida
          </button>
        )}
        <Link to={RUTAS.inicio} className={CLASE_BOTON_SECUNDARIO}>
          Volver al inicio
        </Link>
      </div>
      <DialogoConfirmacion
        abierto={confirmando}
        titulo="¿Terminar esta partida?"
        descripcion="No se puede recuperar. Se dará por terminada para que pueda iniciar otra."
        textoConfirmar="Terminar partida"
        ocupado={guardando}
        onConfirmar={() => {
          setConfirmando(false);
          void onTerminar();
        }}
        onCancelar={() => {
          setConfirmando(false);
        }}
      />
    </section>
  );
}
