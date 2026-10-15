import { useRef, useState } from 'react';

import { crearGestorTablero, type EntornoVentanas, type GestorTablero } from '@/shared/pantallas';
import { RUTAS } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { DialogoInformacion } from '@/shared/ui/DialogoInformacion';

/**
 * "Abrir tablero en el proyector" / "Reconectar tablero": opens the board window on the second
 * screen when possible, otherwise explains how to move it there. Render `avisos` once.
 */
export function useAbrirTablero(entorno?: EntornoVentanas) {
  const gestor = useRef<GestorTablero | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<'instrucciones' | 'bloqueado' | null>(null);

  /** Call from a click handler: the popup and the screen permission need the user gesture. */
  async function abrir() {
    gestor.current ??= crearGestorTablero(entorno);
    setAviso(null);
    const resultado = await gestor.current.reconectar(RUTAS.tablero);
    if (resultado.modo === 'bloqueado') {
      setAviso('bloqueado');
      return;
    }
    setAbierto(true);
    if (resultado.requiereInstrucciones) {
      setAviso('instrucciones');
    }
  }

  const avisos = (
    <>
      {aviso === 'bloqueado' && (
        <AvisoError>
          El navegador bloqueó la ventana del tablero. Permite las ventanas emergentes para este
          sitio (icono en la barra de direcciones) y presiona de nuevo «Abrir tablero en el
          proyector».
        </AvisoError>
      )}
      <DialogoInformacion
        abierto={aviso === 'instrucciones'}
        titulo="Coloca el tablero en el proyector"
        onCerrar={() => {
          setAviso(null);
        }}
      >
        <ol className="list-decimal space-y-1 pl-6">
          <li>Arrastra la ventana del tablero a la pantalla del proyector.</li>
          <li>Dentro del tablero, haz clic en «Pantalla completa».</li>
          <li>Regresa a esta ventana para conducir el juego.</li>
        </ol>
      </DialogoInformacion>
    </>
  );

  return { abrir, abierto, avisos };
}
