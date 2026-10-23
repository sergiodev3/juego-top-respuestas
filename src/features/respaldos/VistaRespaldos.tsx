import { useId, useRef, useState } from 'react';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { ModoRestauracion, Respaldo } from '@/shared/modelo';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from '@/shared/ui/clases';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { descargarArchivo } from '@/shared/utils/descargarArchivo';

import {
  leerRespaldo,
  nombreArchivoRespaldo,
  resumenRespaldo,
  serializarRespaldo,
  textoResultadoRestauracion,
  type ResumenRespaldo,
} from './dominio';

interface VistaRespaldosProps {
  /** Saves the generated file; injectable so tests do not touch the DOM download flow. */
  descargar?: (contenido: Blob, nombre: string) => void;
  /** Current time in epoch milliseconds (names the file). */
  ahora?: () => number;
}

interface ArchivoElegido {
  nombre: string;
  respaldo: Respaldo;
}

const OPCIONES_MODO: readonly { modo: ModoRestauracion; titulo: string; detalle: string }[] = [
  {
    modo: 'combinar',
    titulo: 'Combinar con mis datos',
    detalle:
      'Agrega lo que falta y, si un registro está en los dos lados, se queda la copia más reciente. No borra nada.',
  },
  {
    modo: 'reemplazar',
    titulo: 'Reemplazar mis datos',
    detalle:
      'Borra los sets, preguntas, juegos y partidas de este navegador y deja exactamente lo que trae el archivo.',
  },
];

function plural(cantidad: number, singular: string, plurales: string): string {
  return `${String(cantidad)} ${cantidad === 1 ? singular : plurales}`;
}

function textoConteos(resumen: Omit<ResumenRespaldo, 'exportadoEn'>): string {
  return [
    plural(resumen.sets, 'set', 'sets'),
    plural(resumen.preguntas, 'pregunta', 'preguntas'),
    plural(resumen.juegos, 'juego', 'juegos'),
    plural(resumen.partidas, 'partida', 'partidas'),
  ].join(', ');
}

const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' });

/** Backups: export everything to a JSON file and restore one (merge or replace). */
export function VistaRespaldos({
  descargar = descargarArchivo,
  ahora = Date.now,
}: VistaRespaldosProps) {
  const repositorios = useRepositorios();
  const idModo = useId();
  const entrada = useRef<HTMLInputElement>(null);

  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoRestauracion>('combinar');
  const [confirmando, setConfirmando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [errorRestaurar, setErrorRestaurar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  async function exportar() {
    setErrorExportar(null);
    setExito(null);
    setExportando(true);
    try {
      const respaldo = await repositorios.respaldos.exportar();
      const contenido = new Blob([serializarRespaldo(respaldo)], { type: 'application/json' });
      descargar(contenido, nombreArchivoRespaldo(ahora()));
      setExito(`Respaldo descargado (${textoConteos(resumenRespaldo(respaldo))}).`);
    } catch {
      setErrorExportar('No se pudo crear el respaldo. Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  async function elegir(seleccionado: File) {
    setArchivo(null);
    setErrorArchivo(null);
    setErrorRestaurar(null);
    setResultado(null);
    setModo('combinar');
    let texto: string;
    try {
      texto = await seleccionado.text();
    } catch {
      setErrorArchivo(`«${seleccionado.name}»: no se pudo leer el archivo.`);
      return;
    }
    const lectura = leerRespaldo(texto);
    if (lectura.ok) {
      setArchivo({ nombre: seleccionado.name, respaldo: lectura.respaldo });
    } else {
      setErrorArchivo(`«${seleccionado.name}»: ${lectura.errores.join(' ')}`);
    }
  }

  async function restaurar() {
    if (!archivo) {
      return;
    }
    setConfirmando(false);
    setErrorRestaurar(null);
    setRestaurando(true);
    try {
      const resumen = await repositorios.respaldos.restaurar(archivo.respaldo, modo);
      setResultado(textoResultadoRestauracion(resumen));
      setArchivo(null);
    } catch {
      setErrorRestaurar('No se pudo restaurar el respaldo. No se cambió ningún dato.');
    } finally {
      setRestaurando(false);
    }
  }

  function alPulsarRestaurar() {
    if (modo === 'reemplazar') {
      setConfirmando(true);
    } else {
      void restaurar();
    }
  }

  function descartar() {
    setArchivo(null);
    setErrorArchivo(null);
    setErrorRestaurar(null);
  }

  const resumen = archivo ? resumenRespaldo(archivo.respaldo) : null;

  return (
    <section aria-labelledby="titulo-respaldos" className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-respaldos" className="text-3xl font-bold tracking-tight">
          Respaldos
        </h1>
        <p className="text-slate-700">
          Tus datos viven solo en este navegador. Descarga un respaldo de vez en cuando y guárdalo
          en una memoria USB o en la nube; así puedes pasar tus preguntas a otra computadora o
          recuperarlas si se borran los datos del navegador.
        </p>
      </header>

      <section
        aria-labelledby="titulo-exportar"
        className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="titulo-exportar" className="text-xl font-semibold">
          Exportar
        </h2>
        <p className="text-sm text-slate-700">
          Un solo archivo .json con tus sets, preguntas, juegos y partidas. Funciona sin internet.
        </p>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={exportando}
          onClick={() => void exportar()}
        >
          Descargar respaldo
        </button>
        {errorExportar && <AvisoError>{errorExportar}</AvisoError>}
        {exito && (
          <p role="status" className="font-medium text-emerald-800">
            {exito}
          </p>
        )}
      </section>

      <section
        aria-labelledby="titulo-restaurar"
        className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="titulo-restaurar" className="text-xl font-semibold">
          Restaurar
        </h2>

        {!archivo && (
          <>
            <p className="text-sm text-slate-700">
              Elige un archivo de respaldo (.json) creado con esta misma app. Antes de cambiar algo
              verás qué contiene.
            </p>
            <button
              type="button"
              className={CLASE_BOTON_SECUNDARIO}
              onClick={() => entrada.current?.click()}
            >
              Elegir archivo
            </button>
          </>
        )}
        <input
          ref={entrada}
          type="file"
          accept=".json,application/json"
          aria-label="Archivo de respaldo"
          tabIndex={-1}
          className="sr-only"
          onChange={(evento) => {
            const elegido = evento.target.files?.[0];
            // Reset so choosing the same file again still triggers a change.
            evento.target.value = '';
            if (elegido) {
              void elegir(elegido);
            }
          }}
        />

        {errorArchivo && <AvisoError>{errorArchivo}</AvisoError>}
        {resultado && (
          <p role="status" className="font-medium text-emerald-800">
            {resultado}
          </p>
        )}

        {archivo && resumen && (
          <div className="space-y-4">
            <p>
              <span className="font-semibold">{archivo.nombre}</span>, guardado el{' '}
              {formatoFecha.format(resumen.exportadoEn)}: {textoConteos(resumen)}.
            </p>

            <fieldset className="space-y-2" disabled={restaurando}>
              <legend className="text-sm font-semibold text-slate-800">¿Cómo restaurar?</legend>
              {OPCIONES_MODO.map((opcion) => (
                <label
                  key={opcion.modo}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-300 p-3 has-checked:border-slate-900 has-checked:bg-slate-50"
                >
                  <input
                    type="radio"
                    name={idModo}
                    value={opcion.modo}
                    checked={modo === opcion.modo}
                    onChange={() => {
                      setModo(opcion.modo);
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold">{opcion.titulo}</span>
                    <span className="block text-sm text-slate-700">{opcion.detalle}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {errorRestaurar && <AvisoError>{errorRestaurar}</AvisoError>}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={CLASE_BOTON_PRIMARIO}
                disabled={restaurando}
                onClick={alPulsarRestaurar}
              >
                Restaurar respaldo
              </button>
              <button
                type="button"
                className={CLASE_BOTON_SECUNDARIO}
                disabled={restaurando}
                onClick={descartar}
              >
                Elegir otro archivo
              </button>
            </div>
          </div>
        )}
      </section>

      <DialogoConfirmacion
        abierto={confirmando}
        titulo="Reemplazar todos tus datos"
        descripcion={
          <p>
            Se borrarán los sets, preguntas, juegos y partidas de este navegador y se cargará el
            contenido del archivo. Si no estás seguro, descarga un respaldo de tus datos actuales
            antes de continuar.
          </p>
        }
        textoConfirmar="Reemplazar datos"
        ocupado={restaurando}
        onConfirmar={() => void restaurar()}
        onCancelar={() => {
          setConfirmando(false);
        }}
      />
    </section>
  );
}
