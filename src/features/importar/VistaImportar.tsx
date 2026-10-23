import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';

import { RUTAS } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';
import { descargarArchivo } from '@/shared/utils/descargarArchivo';

import {
  ErrorLecturaArchivo,
  generarPlantillaCsv,
  generarPlantillaXlsx,
  leerArchivo,
  NOMBRE_PLANTILLA_CSV,
  NOMBRE_PLANTILLA_XLSX,
  validarFilas,
  type FilaValidada,
} from './dominio';
import { BotonCancelarArchivo, PanelImportacion } from './PanelImportacion';
import { ZonaArchivo } from './ZonaArchivo';

interface ArchivoLeido {
  nombre: string;
  filas: FilaValidada[];
  /** Number of the read that produced it; a new file always gets a fresh panel. */
  version: number;
}

const ERROR_LECTURA_GENERICO =
  'No se pudo leer el archivo. Verifica que sea un archivo de Excel o CSV válido.';

/** Import view: templates, file drop/picker, preview with validation and import actions. */
export function VistaImportar() {
  const [leyendo, setLeyendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);

  // Every read (and every reset) takes a new number; only the latest read may show its result.
  const lecturaActual = useRef(0);
  // Set when the user starts over, so "Elegir archivo" gets focus once it is shown again.
  const enfocarAlVolver = useRef(false);

  const enfocarBotonElegir = useCallback((boton: HTMLButtonElement | null) => {
    if (boton && enfocarAlVolver.current) {
      enfocarAlVolver.current = false;
      boton.focus();
    }
  }, []);

  async function leer(seleccionado: File) {
    lecturaActual.current += 1;
    const lectura = lecturaActual.current;
    setArchivo(null);
    setErrorArchivo(null);
    setLeyendo(true);
    try {
      const matriz = await leerArchivo(seleccionado.name, await seleccionado.arrayBuffer());
      if (lectura !== lecturaActual.current) {
        return;
      }
      const resultado = validarFilas(matriz);
      if (resultado.ok) {
        setArchivo({ nombre: seleccionado.name, filas: resultado.filas, version: lectura });
      } else {
        setErrorArchivo(`«${seleccionado.name}»: ${resultado.error}`);
      }
    } catch (causa) {
      if (lectura !== lecturaActual.current) {
        return;
      }
      setErrorArchivo(
        causa instanceof ErrorLecturaArchivo ? causa.message : ERROR_LECTURA_GENERICO,
      );
    } finally {
      if (lectura === lecturaActual.current) {
        setLeyendo(false);
      }
    }
  }

  /** Discards the current file (and any read in flight) and shows the drop zone again. */
  function reiniciar() {
    lecturaActual.current += 1;
    enfocarAlVolver.current = true;
    setArchivo(null);
    setErrorArchivo(null);
    setLeyendo(false);
  }

  const hayResultado = archivo !== null || errorArchivo !== null;

  async function descargarPlantilla(formato: 'xlsx' | 'csv') {
    setErrorPlantilla(null);
    try {
      if (formato === 'xlsx') {
        descargarArchivo(await generarPlantillaXlsx(), NOMBRE_PLANTILLA_XLSX);
      } else {
        descargarArchivo(await generarPlantillaCsv(), NOMBRE_PLANTILLA_CSV);
      }
    } catch {
      setErrorPlantilla('No se pudo generar la plantilla. Intenta de nuevo.');
    }
  }

  return (
    <section aria-labelledby="titulo-importar" className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-importar" className="text-3xl font-bold tracking-tight">
          Importar preguntas
        </h1>
        <p className="text-slate-700">
          Carga un archivo de Excel (.xlsx) o CSV con una pregunta por fila. Revisa la vista previa
          antes de guardar. También puedes{' '}
          <Link to={RUTAS.banco} className="font-medium underline underline-offset-2">
            crear preguntas en el banco
          </Link>
          .
        </p>
      </header>

      {!hayResultado && (
        <section
          aria-labelledby="titulo-plantillas"
          className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
        >
          <h2 id="titulo-plantillas" className="text-xl font-semibold">
            1. Descarga una plantilla
          </h2>
          <p className="text-sm text-slate-700">
            Columnas: Tema, Pregunta, R1 y Pts1 hasta R8 y Pts8, y Sinónimos con el formato{' '}
            <code className="rounded bg-slate-100 px-1">R1: auto, coche; R3: celular</code>. Las
            respuestas se ordenan por puntos automáticamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={CLASE_BOTON_SECUNDARIO}
              onClick={() => void descargarPlantilla('xlsx')}
            >
              Descargar plantilla .xlsx
            </button>
            <button
              type="button"
              className={CLASE_BOTON_SECUNDARIO}
              onClick={() => void descargarPlantilla('csv')}
            >
              Descargar plantilla .csv
            </button>
          </div>
          {errorPlantilla && <AvisoError>{errorPlantilla}</AvisoError>}
        </section>
      )}

      {!archivo && (
        <section aria-labelledby="titulo-archivo" className="space-y-3">
          <h2 id="titulo-archivo" className="text-xl font-semibold">
            2. Carga tu archivo
          </h2>
          {errorArchivo ? (
            <>
              <AvisoError>{errorArchivo}</AvisoError>
              <BotonCancelarArchivo onCancelar={reiniciar} />
            </>
          ) : (
            <ZonaArchivo
              leyendo={leyendo}
              onArchivo={(elegido) => void leer(elegido)}
              refBotonElegir={enfocarBotonElegir}
            />
          )}
        </section>
      )}

      {archivo && (
        <PanelImportacion
          key={archivo.version}
          nombreArchivo={archivo.nombre}
          filas={archivo.filas}
          onReiniciar={reiniciar}
        />
      )}
    </section>
  );
}
