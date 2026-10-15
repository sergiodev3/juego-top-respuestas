import { useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { rutaImpresion } from '@/shared/rutas';
import { CLASE_BOTON_PRIMARIO } from '@/shared/ui/clases';

import {
  agruparEnHojas,
  leerSeleccion,
  resumenImpresion,
  type FuenteImpresion,
  type TarjetasPorHoja,
} from './dominio';
import { HojasImpresion } from './HojasImpresion';
import { SelectorFuente } from './SelectorFuente';
import { useTarjetasImpresion } from './useTarjetasImpresion';

interface VistaImpresionProps {
  /** Opens the browser's print dialog; injected in tests. */
  imprimir?: () => void;
}

function imprimirConNavegador() {
  window.print();
}

const OPCIONES_POR_HOJA: readonly TarjetasPorHoja[] = [2, 4];

function rutaDeSeleccion(
  fuente: FuenteImpresion,
  porHoja: TarjetasPorHoja,
  marcador: boolean,
): string {
  return fuente.tipo === 'set'
    ? rutaImpresion({ set: fuente.id, porHoja, marcador })
    : rutaImpresion({ juego: fuente.id, porHoja, marcador });
}

/**
 * `/impresion`: printable host cards for a set (`?set=<id>`) or a saved game (`?juego=<id>`),
 * 2 or 4 per letter sheet (`?por-hoja=4`), optionally followed by a paper scoreboard sheet
 * (`?marcador=1`). Without a usable source it shows a picker. The
 * on-screen preview is what prints; the app shell and these controls are hidden in print.
 */
export function VistaImpresion({ imprimir = imprimirConNavegador }: VistaImpresionProps) {
  const [parametros] = useSearchParams();
  const { fuente, porHoja, marcador } = leerSeleccion(parametros);

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-0">
      <header className="space-y-1 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Imprimir tarjetas</h1>
        <p className="text-slate-700">
          Imprime las tarjetas del conductor en tamaño carta, con líneas de corte. Para guardarlas
          como PDF, elige «Guardar como PDF» en el cuadro de impresión.
        </p>
      </header>
      {fuente === null ? (
        <>
          <p className="text-slate-700">Elige qué quieres imprimir.</p>
          <SelectorFuente porHoja={porHoja} />
        </>
      ) : (
        <VistaPrevia
          key={`${fuente.tipo}-${fuente.id}`}
          fuente={fuente}
          porHoja={porHoja}
          marcador={marcador}
          imprimir={imprimir}
        />
      )}
    </div>
  );
}

interface VistaPreviaProps {
  fuente: FuenteImpresion;
  porHoja: TarjetasPorHoja;
  marcador: boolean;
  imprimir: () => void;
}

function VistaPrevia({ fuente, porHoja, marcador, imprimir }: VistaPreviaProps) {
  const id = useId();
  const navigate = useNavigate();
  const datos = useTarjetasImpresion(fuente);

  if (datos === undefined) {
    return <p className="text-slate-700 print:hidden">Cargando tarjetas…</p>;
  }

  if (datos.estado === 'noDisponible') {
    return (
      <>
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950"
        >
          {datos.mensaje}
        </p>
        <SelectorFuente porHoja={porHoja} />
      </>
    );
  }

  const hojas = agruparEnHojas(datos.tarjetas, porHoja).length;

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-lg border border-slate-300 bg-white p-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{datos.titulo}</h2>
          <p className="text-slate-700">
            {resumenImpresion(datos.tarjetas.length, hojas, marcador)}
          </p>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">Tarjetas por hoja</legend>
          <div className="mt-1 flex gap-4">
            {OPCIONES_POR_HOJA.map((opcion) => (
              <label key={opcion} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-por-hoja`}
                  value={opcion}
                  checked={porHoja === opcion}
                  onChange={() => {
                    void navigate(rutaDeSeleccion(fuente, opcion, marcador), { replace: true });
                  }}
                  className="size-4"
                />
                {opcion} por hoja
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={marcador}
            onChange={() => {
              void navigate(rutaDeSeleccion(fuente, porHoja, !marcador), { replace: true });
            }}
            className="size-4"
          />
          Incluir hoja de marcador
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className={CLASE_BOTON_PRIMARIO}
            onClick={() => {
              imprimir();
            }}
          >
            Imprimir
          </button>
          <Link
            to={rutaImpresion({ porHoja })}
            className="font-medium underline underline-offset-2"
          >
            Cambiar selección
          </Link>
        </div>
      </div>
      <HojasImpresion
        tarjetas={datos.tarjetas}
        porHoja={porHoja}
        marcador={marcador ? datos.marcador : null}
      />
    </>
  );
}
