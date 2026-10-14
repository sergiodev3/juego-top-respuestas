import { useId, useState } from 'react';

import { resumirValidacion, type FilaValidada } from './dominio';
import { textoConAdvertencias, textoConErrores, textoValidas } from './textos';

interface TablaVistaPreviaProps {
  filas: readonly FilaValidada[];
}

function RespuestasOrdenadas({ fila }: { fila: FilaValidada }) {
  if (fila.estado !== 'valida') {
    return null;
  }
  return (
    <ol
      aria-label="Respuestas ordenadas por puntos"
      className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700"
    >
      {fila.pregunta.respuestas.map((respuesta, indice) => (
        <li key={indice}>
          {respuesta.texto} ({respuesta.puntos})
          {respuesta.sinonimos.length > 0 && (
            <span className="text-slate-500"> · también: {respuesta.sinonimos.join(', ')}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Summary counts plus a per-row table with the exact reasons for errors and warnings. */
export function TablaVistaPrevia({ filas }: TablaVistaPreviaProps) {
  const idFiltro = useId();
  const [soloErrores, setSoloErrores] = useState(false);
  const resumen = resumirValidacion(filas);
  const visibles = soloErrores ? filas.filter((fila) => fila.estado === 'invalida') : filas;

  return (
    <section aria-labelledby="titulo-vista-previa" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-vista-previa" className="text-xl font-semibold">
          Vista previa
        </h2>
        <ul aria-label="Resumen" className="flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-full bg-green-100 px-3 py-1 text-green-900">
            {textoValidas(resumen.validas)}
          </li>
          <li className="rounded-full bg-red-100 px-3 py-1 text-red-900">
            {textoConErrores(resumen.conErrores)}
          </li>
          <li className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
            {textoConAdvertencias(resumen.conAdvertencias)}
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={idFiltro}
          type="checkbox"
          checked={soloErrores}
          onChange={(evento) => {
            setSoloErrores(evento.target.checked);
          }}
          className="size-4"
        />
        <label htmlFor={idFiltro} className="text-sm font-medium text-slate-800">
          Mostrar solo filas con errores
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          No hay filas con errores.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Filas del archivo con su estado y sus motivos</caption>
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Fila
                </th>
                <th scope="col" className="px-3 py-2">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2">
                  Tema
                </th>
                <th scope="col" className="px-3 py-2">
                  Pregunta
                </th>
                <th scope="col" className="px-3 py-2">
                  Respuestas
                </th>
                <th scope="col" className="px-3 py-2">
                  Motivos
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.numeroFila} className="border-t border-slate-200 align-top">
                  <th scope="row" className="px-3 py-2 font-mono font-semibold">
                    {fila.numeroFila}
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fila.estado === 'valida' ? (
                      <span className="font-semibold text-green-800">Válida</span>
                    ) : (
                      <span className="font-semibold text-red-800">Con errores</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{fila.tema}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{fila.texto}</span>
                    <RespuestasOrdenadas fila={fila} />
                  </td>
                  <td className="px-3 py-2 text-center">{fila.cantidadRespuestas}</td>
                  <td className="space-y-1 px-3 py-2">
                    {fila.errores.length > 0 && (
                      <ul aria-label="Errores" className="list-disc space-y-1 pl-4 text-red-800">
                        {fila.errores.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                    {fila.advertencias.length > 0 && (
                      <ul
                        aria-label="Advertencias"
                        className="list-disc space-y-1 pl-4 text-amber-800"
                      >
                        {fila.advertencias.map((advertencia) => (
                          <li key={advertencia}>{advertencia}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
