import { useEffect, useId, useRef, type ReactNode } from 'react';

import { CLASE_BOTON_PELIGRO, CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from './clases';

interface DialogoConfirmacionProps {
  abierto: boolean;
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Styles the confirm button as destructive. Defaults to true. */
  peligroso?: boolean;
  /** Disables the buttons while the confirmed action runs. */
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmation built on the native modal `<dialog>` (focus trap, Escape, top layer).
 * Focus starts on the cancel button so Enter never confirms a destructive action by accident.
 */
export function DialogoConfirmacion({
  abierto,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligroso = true,
  ocupado = false,
  onConfirmar,
  onCancelar,
}: DialogoConfirmacionProps) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) {
      return;
    }
    if (abierto && !dialogo.open) {
      dialogo.showModal();
      cancelarRef.current?.focus();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={dialogoRef}
      aria-labelledby={idTitulo}
      aria-describedby={idDescripcion}
      onCancel={(evento) => {
        // Escape: let the parent decide (it closes the dialog by setting `abierto`).
        evento.preventDefault();
        if (!ocupado) {
          onCancelar();
        }
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60"
    >
      <h2 id={idTitulo} className="text-xl font-bold">
        {titulo}
      </h2>
      <div id={idDescripcion} className="mt-2 text-slate-700">
        {descripcion}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          ref={cancelarRef}
          type="button"
          className={CLASE_BOTON_SECUNDARIO}
          disabled={ocupado}
          onClick={onCancelar}
        >
          {textoCancelar}
        </button>
        <button
          type="button"
          className={peligroso ? CLASE_BOTON_PELIGRO : CLASE_BOTON_PRIMARIO}
          disabled={ocupado}
          onClick={onConfirmar}
        >
          {textoConfirmar}
        </button>
      </div>
    </dialog>
  );
}
