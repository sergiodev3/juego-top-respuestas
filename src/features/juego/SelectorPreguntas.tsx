import { useId, useMemo, useState } from 'react';

import {
  PREGUNTAS_RONDA_FINAL,
  type DatosJuego,
  type Pregunta,
  type SetPreguntas,
} from '@/shared/modelo';
import {
  CLASE_BOTON_ACCION,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';
import { contieneTexto } from '@/shared/utils/normalizarTexto';

import { llenarRondaFinal, llenarRondas, preguntasEnUso } from './dominio';
import { textoPreguntas, textoRondas } from './textos';

export interface Banco {
  sets: SetPreguntas[];
  preguntas: Pregunta[];
}

type Modo = 'manual' | 'tema' | 'sets';

const MODOS: { modo: Modo; etiqueta: string; descripcion: string }[] = [
  { modo: 'manual', etiqueta: 'Manual', descripcion: 'Elige cada pregunta del banco.' },
  {
    modo: 'tema',
    etiqueta: 'Por tema',
    descripcion: 'Preguntas al azar de los temas elegidos.',
  },
  {
    modo: 'sets',
    etiqueta: 'Aleatoria',
    descripcion: 'Preguntas al azar de los sets elegidos.',
  },
];

const MAX_RONDAS_AZAR = 20;
const LIMITE_RESULTADOS = 50;
const DESHABILITADO = 'disabled:cursor-not-allowed disabled:opacity-50';
const compararTexto = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

interface SelectorPreguntasProps {
  banco: Banco;
  datos: DatosJuego;
  onCambiar: (datos: DatosJuego) => void;
  /** Random source in [0, 1), injected for deterministic tests. */
  aleatorio: () => number;
}

/**
 * Question selection: manual picker (search, tema and set filters) or random fill by tema or by
 * set. Random fills replace the rounds (or the final round), which stay editable afterwards.
 * A question is never used twice in the same game.
 */
export function SelectorPreguntas({ banco, datos, onCambiar, aleatorio }: SelectorPreguntasProps) {
  const id = useId();
  const [modo, setModo] = useState<Modo>('manual');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTema, setFiltroTema] = useState('');
  const [filtroSet, setFiltroSet] = useState('');
  const [temasElegidos, setTemasElegidos] = useState<string[]>([]);
  const [setsElegidos, setSetsElegidos] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState('4');
  const [aviso, setAviso] = useState('');

  const { rondaFinal } = datos.reglas;
  const enUso = preguntasEnUso(datos);
  const finalCompleta = rondaFinal.preguntaIds.length >= PREGUNTAS_RONDA_FINAL;

  const nombresSets = useMemo(
    () => new Map(banco.sets.map((set) => [set.id, set.nombre])),
    [banco.sets],
  );
  const conteoTemas = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const pregunta of banco.preguntas) {
      if (pregunta.tema !== '') {
        conteo.set(pregunta.tema, (conteo.get(pregunta.tema) ?? 0) + 1);
      }
    }
    return [...conteo].toSorted(([a], [b]) => compararTexto(a, b));
  }, [banco.preguntas]);
  const conteoSets = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const pregunta of banco.preguntas) {
      conteo.set(pregunta.setId, (conteo.get(pregunta.setId) ?? 0) + 1);
    }
    return conteo;
  }, [banco.preguntas]);

  // Questions already in the game are left out, so none can be picked twice.
  const resultados = banco.preguntas.filter(
    (pregunta) =>
      !enUso.has(pregunta.id) &&
      (filtroTema === '' || pregunta.tema === filtroTema) &&
      (filtroSet === '' || pregunta.setId === filtroSet) &&
      contieneTexto(pregunta.texto, busqueda),
  );

  function candidatas(): string[] | null {
    if (modo === 'tema') {
      if (temasElegidos.length === 0) {
        setAviso('Elige al menos un tema.');
        return null;
      }
      return banco.preguntas.filter((p) => temasElegidos.includes(p.tema)).map((p) => p.id);
    }
    if (setsElegidos.length === 0) {
      setAviso('Elige al menos un set.');
      return null;
    }
    return banco.preguntas.filter((p) => setsElegidos.includes(p.setId)).map((p) => p.id);
  }

  function llenarRondasAlAzar() {
    const numero = Number(cantidad);
    if (!Number.isInteger(numero) || numero < 1 || numero > MAX_RONDAS_AZAR) {
      setAviso(`Indica un número de rondas entre 1 y ${String(MAX_RONDAS_AZAR)}.`);
      return;
    }
    const ids = candidatas();
    if (ids === null) {
      return;
    }
    const nuevos = llenarRondas(datos, ids, numero, aleatorio);
    onCambiar(nuevos);
    const llenas = nuevos.rondas.length;
    setAviso(
      llenas < numero
        ? `Solo hay ${textoPreguntas(llenas)} disponibles: se llenaron ${textoRondas(llenas)}.`
        : `Se llenaron ${textoRondas(llenas)} al azar.`,
    );
  }

  function llenarFinalAlAzar() {
    const ids = candidatas();
    if (ids === null) {
      return;
    }
    const nuevos = llenarRondaFinal(datos, ids, aleatorio);
    onCambiar(nuevos);
    const llenas = nuevos.reglas.rondaFinal.preguntaIds.length;
    setAviso(
      llenas < PREGUNTAS_RONDA_FINAL
        ? `Solo hay ${textoPreguntas(llenas)} disponibles para la ronda final; se necesitan ${String(PREGUNTAS_RONDA_FINAL)}.`
        : `Se eligieron ${String(PREGUNTAS_RONDA_FINAL)} preguntas al azar para la ronda final.`,
    );
  }

  function alternar(lista: string[], valor: string): string[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-4">
      <h3 id={`${id}-titulo`} className="text-xl font-semibold">
        Selección de preguntas
      </h3>
      <fieldset>
        <legend className={CLASE_ETIQUETA}>Modo de selección</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {MODOS.map((opcion) => (
            <label key={opcion.modo} className="flex items-center gap-2 text-slate-900">
              <input
                type="radio"
                name={`${id}-modo`}
                value={opcion.modo}
                checked={modo === opcion.modo}
                aria-describedby={`${id}-modo-${opcion.modo}`}
                onChange={() => {
                  setModo(opcion.modo);
                  setAviso('');
                }}
                className="size-4"
              />
              {opcion.etiqueta}
            </label>
          ))}
        </div>
        {MODOS.map((opcion) => (
          <p
            key={opcion.modo}
            id={`${id}-modo-${opcion.modo}`}
            hidden={modo !== opcion.modo}
            className="mt-1 text-sm text-slate-600"
          >
            {opcion.descripcion}
          </p>
        ))}
      </fieldset>

      {banco.preguntas.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          El banco no tiene preguntas todavía. Agrégalas en «Banco de preguntas» o «Importar».
        </p>
      )}

      {modo === 'manual' ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-buscar`} className={CLASE_ETIQUETA}>
                Buscar preguntas
              </label>
              <input
                id={`${id}-buscar`}
                type="search"
                value={busqueda}
                onChange={(evento) => {
                  setBusqueda(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1`}
              />
            </div>
            <div>
              <label htmlFor={`${id}-tema`} className={CLASE_ETIQUETA}>
                Filtrar por tema
              </label>
              <select
                id={`${id}-tema`}
                value={filtroTema}
                onChange={(evento) => {
                  setFiltroTema(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1`}
              >
                <option value="">Todos los temas</option>
                {conteoTemas.map(([tema]) => (
                  <option key={tema} value={tema}>
                    {tema}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-set`} className={CLASE_ETIQUETA}>
                Filtrar por set
              </label>
              <select
                id={`${id}-set`}
                value={filtroSet}
                onChange={(evento) => {
                  setFiltroSet(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1`}
              >
                <option value="">Todos los sets</option>
                {banco.sets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {resultados.length > LIMITE_RESULTADOS
              ? `Se muestran ${String(LIMITE_RESULTADOS)} de ${textoPreguntas(resultados.length)}; refina la búsqueda para ver otras.`
              : `${textoPreguntas(resultados.length)} disponibles.`}
            {enUso.size > 0 && ' No se muestran las que ya están en el juego.'}
          </p>
          <ul aria-label="Preguntas del banco" className="max-h-96 space-y-2 overflow-y-auto">
            {resultados.slice(0, LIMITE_RESULTADOS).map((pregunta) => (
              <li
                key={pregunta.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-medium text-slate-900">{pregunta.texto}</p>
                  <p className="text-sm text-slate-600">
                    {pregunta.tema || 'Sin tema'} · {nombresSets.get(pregunta.setId) ?? ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Agregar «${pregunta.texto}» a las rondas`}
                  onClick={() => {
                    onCambiar({
                      ...datos,
                      rondas: [...datos.rondas, { preguntaId: pregunta.id, multiplicador: 1 }],
                    });
                  }}
                >
                  Agregar a rondas
                </button>
                {rondaFinal.activa && (
                  <button
                    type="button"
                    className={`${CLASE_BOTON_ACCION} ${DESHABILITADO}`}
                    aria-label={`Agregar «${pregunta.texto}» a la ronda final`}
                    disabled={finalCompleta}
                    onClick={() => {
                      onCambiar({
                        ...datos,
                        reglas: {
                          ...datos.reglas,
                          rondaFinal: {
                            ...rondaFinal,
                            preguntaIds: [...rondaFinal.preguntaIds, pregunta.id],
                          },
                        },
                      });
                    }}
                  >
                    Agregar a ronda final
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <fieldset>
            <legend className={CLASE_ETIQUETA}>{modo === 'tema' ? 'Temas' : 'Sets'}</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {modo === 'tema'
                ? conteoTemas.map(([tema, total]) => (
                    <label key={tema} className="flex items-center gap-2 text-slate-900">
                      <input
                        type="checkbox"
                        checked={temasElegidos.includes(tema)}
                        onChange={() => {
                          setTemasElegidos((actuales) => alternar(actuales, tema));
                        }}
                        className="size-4"
                      />
                      {tema} · {textoPreguntas(total)}
                    </label>
                  ))
                : banco.sets.map((set) => {
                    const total = conteoSets.get(set.id) ?? 0;
                    return (
                      <label
                        key={set.id}
                        className="flex items-center gap-2 text-slate-900 has-disabled:text-slate-500"
                      >
                        <input
                          type="checkbox"
                          checked={setsElegidos.includes(set.id)}
                          disabled={total === 0}
                          onChange={() => {
                            setSetsElegidos((actuales) => alternar(actuales, set.id));
                          }}
                          className="size-4"
                        />
                        {set.nombre} · {textoPreguntas(total)}
                      </label>
                    );
                  })}
            </div>
            {modo === 'tema' && conteoTemas.length === 0 && (
              <p className="mt-1 text-sm text-slate-600">Ninguna pregunta del banco tiene tema.</p>
            )}
          </fieldset>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`${id}-cantidad`} className={CLASE_ETIQUETA}>
                Número de rondas
              </label>
              <input
                id={`${id}-cantidad`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_RONDAS_AZAR}
                step={1}
                value={cantidad}
                onChange={(evento) => {
                  setCantidad(evento.target.value);
                }}
                className={`${CLASE_CAMPO} mt-1 w-24`}
              />
            </div>
            <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={llenarRondasAlAzar}>
              Llenar rondas al azar
            </button>
            {rondaFinal.activa && (
              <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={llenarFinalAlAzar}>
                Llenar ronda final al azar
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600">
            Las rondas actuales se reemplazan; después puedes reordenarlas o quitarlas.
          </p>
        </div>
      )}
      <p role="status" className="text-sm font-medium text-slate-800">
        {aviso}
      </p>
    </section>
  );
}
