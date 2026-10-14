import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { crearJuegoPorDefecto, type DatosJuego } from '@/shared/modelo';
import { RUTAS } from '@/shared/rutas';

import { EditorJuego } from './EditorJuego';
import { ListaJuegosGuardados } from './ListaJuegosGuardados';

const NOMBRE_PREDETERMINADO = 'Nuevo juego';

function datosDe(juego: DatosJuego): DatosJuego {
  return {
    nombre: juego.nombre,
    equipos: juego.equipos,
    reglas: juego.reglas,
    rondas: juego.rondas,
  };
}

function EditarJuegoGuardado({ juegoId, aleatorio }: { juegoId: string; aleatorio: () => number }) {
  const repositorios = useRepositorios();
  // `null` = not found; `undefined` = still loading.
  const juego = useLiveQuery(
    async () => (await repositorios.juegos.obtener(juegoId)) ?? null,
    [repositorios, juegoId],
  );

  if (juego === undefined) {
    return <p className="text-slate-700">Cargando juego…</p>;
  }
  if (juego === null) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-slate-400 bg-white p-4">
        <p className="text-slate-800">No se encontró el juego solicitado.</p>
        <Link to={RUTAS.configurarJuego} className="font-medium underline underline-offset-2">
          Ver juegos guardados o crear uno nuevo
        </Link>
      </div>
    );
  }
  // Keyed by id: the form keeps its own state after the first load (saves do not reset it).
  return (
    <EditorJuego key={juego.id} juegoId={juego.id} inicial={datosDe(juego)} aleatorio={aleatorio} />
  );
}

interface VistaConfigurarJuegoProps {
  /** Random source in [0, 1) for the random question modes; injected in tests. */
  aleatorio?: () => number;
}

/**
 * `/juego/configurar`: saved games plus a new-game form with sensible defaults.
 * `/juego/configurar/:juegoId`: edit a saved game (e.g. one made by "Importar y jugar") and start it.
 */
export function VistaConfigurarJuego({ aleatorio = Math.random }: VistaConfigurarJuegoProps) {
  const { juegoId } = useParams();

  return (
    <section aria-labelledby="titulo-configurar" className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 id="titulo-configurar" className="text-3xl font-bold tracking-tight">
            Configurar juego
          </h1>
          <p className="text-slate-700">
            Equipos, reglas, rondas y preguntas. Los valores por defecto permiten empezar de
            inmediato.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {juegoId !== undefined && (
            <Link to={RUTAS.configurarJuego} className="font-medium underline underline-offset-2">
              Juegos guardados
            </Link>
          )}
          <Link to={RUTAS.juegoRapido} className="font-medium underline underline-offset-2">
            Nuevo juego rápido
          </Link>
        </div>
      </header>
      {juegoId === undefined ? (
        <>
          <ListaJuegosGuardados />
          <EditorJuego
            juegoId={null}
            inicial={crearJuegoPorDefecto({ nombre: NOMBRE_PREDETERMINADO, preguntaIds: [] })}
            aleatorio={aleatorio}
          />
        </>
      ) : (
        <EditarJuegoGuardado key={juegoId} juegoId={juegoId} aleatorio={aleatorio} />
      )}
    </section>
  );
}
