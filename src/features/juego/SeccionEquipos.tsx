import { useId } from 'react';

import {
  MAX_EQUIPOS,
  MAX_NOMBRE_EQUIPO,
  MIN_EQUIPOS,
  PALETA_EQUIPOS,
  type DatosJuego,
  type Equipo,
} from '@/shared/modelo';
import {
  CLASE_BOTON_ACCION_PELIGRO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';

import { agregarEquipo, letraEquipo, quitarEquipo } from './dominio';

interface SeccionEquiposProps {
  datos: DatosJuego;
  onCambiar: (datos: DatosJuego) => void;
}

/** Teams 2-4: name, color from an accessible palette, and the A-D key shown in the panel. */
export function SeccionEquipos({ datos, onCambiar }: SeccionEquiposProps) {
  const id = useId();
  const { equipos } = datos;

  function cambiarEquipo(indice: number, cambios: Partial<Equipo>) {
    onCambiar({
      ...datos,
      equipos: equipos.map((equipo, i) => (i === indice ? { ...equipo, ...cambios } : equipo)),
    });
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      <h3 id={`${id}-titulo`} className="text-xl font-semibold">
        Equipos
      </h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {equipos.map((equipo, indice) => {
          const letra = letraEquipo(indice);
          const idNombre = `${id}-nombre-${equipo.id}`;
          const coloresAjenos = new Set(
            equipos.filter((_, i) => i !== indice).map((otro) => otro.color),
          );
          return (
            <li
              key={equipo.id}
              className="space-y-3 rounded-lg border border-slate-300 bg-white p-4"
            >
              <div className="flex items-end gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-lg font-bold text-white"
                  style={{ backgroundColor: equipo.color }}
                >
                  <span className="sr-only">Tecla </span>
                  {letra}
                </span>
                <div className="flex-1">
                  <label htmlFor={idNombre} className={CLASE_ETIQUETA}>
                    Nombre del equipo {letra}
                  </label>
                  <input
                    id={idNombre}
                    value={equipo.nombre}
                    maxLength={MAX_NOMBRE_EQUIPO}
                    onChange={(evento) => {
                      cambiarEquipo(indice, { nombre: evento.target.value });
                    }}
                    className={`${CLASE_CAMPO} mt-1`}
                  />
                </div>
              </div>
              <fieldset>
                <legend className={CLASE_ETIQUETA}>Color del equipo {letra}</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PALETA_EQUIPOS.map((opcion) => {
                    const ocupado = coloresAjenos.has(opcion.color);
                    return (
                      <label
                        key={opcion.color}
                        title={ocupado ? `${opcion.nombre} (lo usa otro equipo)` : opcion.nombre}
                        className="cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-30"
                      >
                        <input
                          type="radio"
                          name={`${id}-color-${equipo.id}`}
                          value={opcion.color}
                          checked={equipo.color === opcion.color}
                          disabled={ocupado}
                          onChange={() => {
                            cambiarEquipo(indice, { color: opcion.color });
                          }}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="block size-8 rounded-full border-2 border-white ring-2 ring-slate-300 peer-checked:ring-4 peer-checked:ring-slate-900 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber-500"
                          style={{ backgroundColor: opcion.color }}
                        />
                        <span className="sr-only">{opcion.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                Vista previa:
                <span
                  className="rounded-md px-3 py-1 text-base font-semibold text-white"
                  style={{ backgroundColor: equipo.color }}
                >
                  {equipo.nombre}
                </span>
              </p>
              <button
                type="button"
                className={`${CLASE_BOTON_ACCION_PELIGRO} disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label={`Quitar el equipo ${letra}`}
                disabled={equipos.length <= MIN_EQUIPOS}
                onClick={() => {
                  onCambiar(quitarEquipo(datos, indice));
                }}
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={CLASE_BOTON_SECUNDARIO}
          disabled={equipos.length >= MAX_EQUIPOS}
          onClick={() => {
            onCambiar(agregarEquipo(datos));
          }}
        >
          Agregar equipo
        </button>
        <p className="text-sm text-slate-600">
          De {MIN_EQUIPOS} a {MAX_EQUIPOS} equipos. En el panel se asigna el turno con las teclas A,
          B, C y D.
        </p>
      </div>
    </section>
  );
}
