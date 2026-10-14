import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useRef, useState, type SubmitEvent } from 'react';

import { useRepositorios } from '@/db/contextoRepositorios';
import {
  esquemaDatosJuego,
  MAX_NOMBRE_JUEGO,
  type DatosJuego,
  type Juego,
  type Pregunta,
} from '@/shared/modelo';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';

import { CampoNumero } from './CampoNumero';
import { mensajesValidacion, validarParaIniciar } from './dominio';
import { SeccionEquipos } from './SeccionEquipos';
import { SeccionRondaFinal, SeccionRondas } from './SeccionRondas';
import { SelectorPreguntas } from './SelectorPreguntas';
import { prepararConfigPartida, useIniciarPartida } from './useIniciarPartida';

interface Problemas {
  titulo: string;
  lista: readonly string[];
}

interface EditorJuegoProps {
  /** Saved game being edited, or `null` for a new one (created on the first save). */
  juegoId: string | null;
  inicial: DatosJuego;
  aleatorio: () => number;
}

/** Full game setup form: general rules, teams, question selection, rounds and final round. */
export function EditorJuego({ juegoId: juegoIdInicial, inicial, aleatorio }: EditorJuegoProps) {
  const repositorios = useRepositorios();
  const id = useId();
  const [datos, setDatos] = useState(inicial);
  const [juegoId, setJuegoId] = useState(juegoIdInicial);
  const [problemas, setProblemas] = useState<Problemas | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Synchronous guard: a second save/start before the re-render must not create a second game.
  const enVuelo = useRef(false);
  const inicio = useIniciarPartida();

  const banco = useLiveQuery(
    async () => ({
      sets: await repositorios.sets.listar(),
      preguntas: await repositorios.preguntas.buscar({}),
    }),
    [repositorios],
  );
  const preguntasPorId = useMemo(
    () =>
      banco === undefined ? null : new Map<string, Pregunta>(banco.preguntas.map((p) => [p.id, p])),
    [banco],
  );

  function cambiar(nuevos: DatosJuego) {
    setDatos(nuevos);
    setConfirmacion('');
  }

  /** Creates or updates the game; `null` (with problems shown) when the data is invalid. */
  async function guardarDatos(): Promise<Juego | null> {
    const resultado = esquemaDatosJuego.safeParse(datos);
    if (!resultado.success) {
      setProblemas({
        titulo: 'No se puede guardar el juego:',
        lista: mensajesValidacion(resultado.error),
      });
      return null;
    }
    const juego =
      juegoId === null
        ? await repositorios.juegos.crear(resultado.data)
        : await repositorios.juegos.actualizar(juegoId, resultado.data);
    setJuegoId(juego.id);
    return juego;
  }

  async function guardar(evento?: SubmitEvent<HTMLFormElement>) {
    evento?.preventDefault();
    if (enVuelo.current) {
      return;
    }
    enVuelo.current = true;
    setProblemas(null);
    setConfirmacion('');
    setOcupado(true);
    try {
      if ((await guardarDatos()) !== null) {
        setConfirmacion('Juego guardado.');
      }
    } catch {
      setProblemas({ titulo: 'No se pudo guardar el juego.', lista: ['Intente de nuevo.'] });
    } finally {
      enVuelo.current = false;
      setOcupado(false);
    }
  }

  async function iniciarPartida() {
    if (enVuelo.current) {
      return;
    }
    setProblemas(null);
    setConfirmacion('');
    const errores = validarParaIniciar(datos);
    if (errores.length > 0) {
      setProblemas({ titulo: 'No se puede iniciar la partida:', lista: errores });
      return;
    }
    enVuelo.current = true;
    setOcupado(true);
    try {
      const juego = await guardarDatos();
      if (juego === null) {
        return;
      }
      const resultado = await prepararConfigPartida(repositorios.preguntas, juego);
      if (!resultado.ok) {
        setProblemas({ titulo: 'No se puede iniciar la partida:', lista: resultado.errores });
        return;
      }
      await inicio.iniciar({ juegoId: juego.id, config: resultado.config });
    } catch {
      setProblemas({ titulo: 'No se pudo iniciar la partida.', lista: ['Intente de nuevo.'] });
    } finally {
      enVuelo.current = false;
      setOcupado(false);
    }
  }

  const deshabilitado = ocupado || inicio.ocupado;

  return (
    <form
      noValidate
      aria-labelledby={`${id}-titulo`}
      onSubmit={(evento) => void guardar(evento)}
      className="space-y-8 rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm sm:p-6"
    >
      <h2 id={`${id}-titulo`} className="text-2xl font-bold">
        {juegoId === null ? 'Nuevo juego' : 'Editar juego'}
      </h2>

      <section aria-labelledby={`${id}-general`} className="space-y-3">
        <h3 id={`${id}-general`} className="text-xl font-semibold">
          Datos generales
        </h3>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-64 flex-1">
            <label htmlFor={`${id}-nombre`} className={CLASE_ETIQUETA}>
              Nombre del juego
            </label>
            <input
              id={`${id}-nombre`}
              value={datos.nombre}
              maxLength={MAX_NOMBRE_JUEGO}
              onChange={(evento) => {
                cambiar({ ...datos, nombre: evento.target.value });
              }}
              className={`${CLASE_CAMPO} mt-1`}
            />
          </div>
          <CampoNumero
            etiqueta="Tachas por ronda"
            valor={datos.reglas.tachasMaximas}
            minimo={1}
            maximo={9}
            onCambiar={(tachasMaximas) => {
              cambiar({ ...datos, reglas: { ...datos.reglas, tachasMaximas } });
            }}
          />
        </div>
      </section>

      <SeccionEquipos datos={datos} onCambiar={cambiar} />

      {banco === undefined ? (
        <p className="text-slate-700">Cargando preguntas…</p>
      ) : (
        <SelectorPreguntas banco={banco} datos={datos} onCambiar={cambiar} aleatorio={aleatorio} />
      )}
      <SeccionRondas datos={datos} preguntasPorId={preguntasPorId} onCambiar={cambiar} />
      <SeccionRondaFinal datos={datos} preguntasPorId={preguntasPorId} onCambiar={cambiar} />

      <div className="space-y-3 border-t border-slate-300 pt-4">
        {problemas !== null && (
          <AvisoError>
            <p>{problemas.titulo}</p>
            <ul className="mt-1 list-disc pl-6">
              {problemas.lista.map((problema) => (
                <li key={problema}>{problema}</li>
              ))}
            </ul>
          </AvisoError>
        )}
        {inicio.error !== null && <AvisoError>{inicio.error}</AvisoError>}
        <p role="status" className="font-medium text-emerald-800">
          {confirmacion}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={CLASE_BOTON_SECUNDARIO} disabled={deshabilitado}>
            Guardar juego
          </button>
          <button
            type="button"
            className={CLASE_BOTON_PRIMARIO}
            disabled={deshabilitado}
            onClick={() => void iniciarPartida()}
          >
            Iniciar partida
          </button>
        </div>
      </div>
      {inicio.dialogo}
    </form>
  );
}
