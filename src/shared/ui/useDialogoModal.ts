import { useEffect, useRef } from 'react';

/** Opens (`showModal`) and closes a native `<dialog>` to follow `abierto`. Attach the ref. */
export function useDialogoModal(abierto: boolean) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) {
      return;
    }
    if (abierto && !dialogo.open) {
      dialogo.showModal();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);
  return dialogoRef;
}
