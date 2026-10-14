import { useRef, useState, type DragEvent } from 'react';

import { cx } from '@/shared/utils/cx';
import { CLASE_BOTON_PRIMARIO } from '@/shared/ui/clases';

import { EXTENSIONES_ADMITIDAS } from './dominio';

interface ZonaArchivoProps {
  ocupado: boolean;
  onArchivo: (archivo: File) => void;
}

/**
 * Drop zone plus an "Elegir archivo" button. The hidden file input is driven by the button,
 * so keyboard users never depend on drag and drop.
 */
export function ZonaArchivo({ ocupado, onArchivo }: ZonaArchivoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    const archivo = evento.dataTransfer.files[0];
    if (archivo && !ocupado) {
      onArchivo(archivo);
    }
  }

  return (
    <div
      onDragOver={(evento) => {
        evento.preventDefault();
        evento.dataTransfer.dropEffect = 'copy';
        setArrastrando(true);
      }}
      onDragLeave={() => {
        setArrastrando(false);
      }}
      onDrop={alSoltar}
      className={cx(
        'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        arrastrando ? 'border-slate-900 bg-slate-100' : 'border-slate-400 bg-white',
      )}
    >
      <p className="text-lg font-semibold text-slate-900">Arrastra aquí tu archivo</p>
      <p className="text-sm text-slate-700">
        Formatos admitidos: {EXTENSIONES_ADMITIDAS.join(', ')}. Se lee solo la primera hoja.
      </p>
      <button
        type="button"
        className={CLASE_BOTON_PRIMARIO}
        disabled={ocupado}
        onClick={() => entrada.current?.click()}
      >
        Elegir archivo
      </button>
      <input
        ref={entrada}
        type="file"
        accept={EXTENSIONES_ADMITIDAS.join(',')}
        aria-label="Archivo de preguntas"
        tabIndex={-1}
        className="sr-only"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          // Reset so choosing the same file again still triggers a change.
          evento.target.value = '';
          if (archivo) {
            onArchivo(archivo);
          }
        }}
      />
      {ocupado && (
        <p role="status" className="text-sm text-slate-700">
          Leyendo archivo…
        </p>
      )}
    </div>
  );
}
