import { useId, type ReactNode } from 'react';

import { CLASE_BOTON_PRIMARIO } from './clases';
import { useDialogoModal } from './useDialogoModal';

interface DialogoInformacionProps {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  textoCerrar?: string;
  onCerrar: () => void;
}

/** Modal notice with a single close button (native `<dialog>`; Escape also closes it). */
export function DialogoInformacion({
  abierto,
  titulo,
  children,
  textoCerrar = 'Entendido',
  onCerrar,
}: DialogoInformacionProps) {
  const dialogoRef = useDialogoModal(abierto);
  const idTitulo = useId();
  return (
    <dialog
      ref={dialogoRef}
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        onCerrar();
      }}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60"
    >
      <h2 id={idTitulo} className="text-xl font-bold">
        {titulo}
      </h2>
      <div className="mt-3 space-y-2 text-slate-700">{children}</div>
      <div className="mt-6 flex justify-end">
        <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={onCerrar}>
          {textoCerrar}
        </button>
      </div>
    </dialog>
  );
}
