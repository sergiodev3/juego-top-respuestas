import { useId, useState } from 'react';

import type { ConfigPartida } from '@/engine';
import { CLASE_BOTON_SECUNDARIO, CLASE_CAMPO, CLASE_ETIQUETA } from '@/shared/ui/clases';
import { useDialogoModal } from '@/shared/ui/useDialogoModal';

import { BotonAccion } from './BotonAccion';
import type { AccionesPanel } from './useAccionesPanel';

interface DialogoAjustarPuntosProps {
  abierto: boolean;
  config: ConfigPartida;
  acciones: AccionesPanel;
  onCerrar: () => void;
}

/** Manual score correction (`AJUSTAR_PUNTOS`): a team and a non-zero whole number. */
export function DialogoAjustarPuntos({
  abierto,
  config,
  acciones,
  onCerrar,
}: DialogoAjustarPuntosProps) {
  const dialogoRef = useDialogoModal(abierto);
  const id = useId();
  const [equipo, setEquipo] = useState(0);
  const [delta, setDelta] = useState('');

  function cerrar() {
    setDelta('');
    onCerrar();
  }

  const valor = delta.trim() === '' ? Number.NaN : Number(delta);
  const accion = acciones.ajustarPuntos(equipo, valor);
  const aplicar = {
    habilitada: accion.habilitada,
    motivo: delta.trim() === '' ? 'Escribe cuántos puntos sumar o restar.' : accion.motivo,
    async ejecutar() {
      const guardado = await accion.ejecutar();
      if (guardado) {
        cerrar();
      }
      return guardado;
    },
  };

  return (
    <dialog
      ref={dialogoRef}
      aria-labelledby={`${id}-titulo`}
      onCancel={(evento) => {
        evento.preventDefault();
        cerrar();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60"
    >
      <h2 id={`${id}-titulo`} className="text-xl font-bold">
        Ajustar puntos
      </h2>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={`${id}-equipo`} className={CLASE_ETIQUETA}>
            Equipo
          </label>
          <select
            id={`${id}-equipo`}
            value={equipo}
            onChange={(evento) => {
              setEquipo(Number(evento.target.value));
            }}
            className={`${CLASE_CAMPO} mt-1`}
          >
            {config.equipos.map((opcion, indice) => (
              <option key={opcion.id} value={indice}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-delta`} className={CLASE_ETIQUETA}>
            Puntos a sumar o restar
          </label>
          <input
            id={`${id}-delta`}
            type="number"
            step={1}
            value={delta}
            aria-describedby={`${id}-ayuda`}
            onChange={(evento) => {
              setDelta(evento.target.value);
            }}
            className={`${CLASE_CAMPO} mt-1`}
          />
          <p id={`${id}-ayuda`} className="mt-1 text-sm text-slate-600">
            Usa un número negativo para restar (por ejemplo, -10).
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={cerrar}>
          Cancelar
        </button>
        <BotonAccion accion={aplicar} variante="primario">
          Aplicar ajuste
        </BotonAccion>
      </div>
    </dialog>
  );
}
