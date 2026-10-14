import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { RUTAS } from '@/shared/rutas';
import { VistaEnConstruccion } from '@/shared/ui/VistaEnConstruccion';

/** Read-only summary of a saved game until the full setup UI arrives in Fase 4. */
function ResumenJuego({ juegoId }: { juegoId: string }) {
  const repositorios = useRepositorios();
  const datos = useLiveQuery(async () => {
    const juego = await repositorios.juegos.obtener(juegoId);
    if (!juego) {
      return { juego: null, preguntas: [] };
    }
    const preguntas = await Promise.all(
      juego.rondas.map((ronda) => repositorios.preguntas.obtener(ronda.preguntaId)),
    );
    return { juego, preguntas };
  }, [repositorios, juegoId]);

  if (datos === undefined) {
    return <p className="text-slate-700">Cargando juego…</p>;
  }
  const { juego, preguntas } = datos;
  if (!juego) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-slate-400 bg-white p-4">
        <p className="text-slate-800">No se encontró el juego solicitado.</p>
        <Link to={RUTAS.importar} className="font-medium underline underline-offset-2">
          Importar preguntas para crear un juego
        </Link>
      </div>
    );
  }

  const { rondaFinal, tachasMaximas } = juego.reglas;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{juego.nombre}</h2>

      <section aria-labelledby="titulo-equipos" className="space-y-2">
        <h3 id="titulo-equipos" className="text-lg font-semibold">
          Equipos
        </h3>
        <ul className="flex flex-wrap gap-2">
          {juego.equipos.map((equipo) => (
            <li
              key={equipo.id}
              className="rounded-md px-3 py-1 font-semibold text-white"
              style={{ backgroundColor: equipo.color }}
            >
              {equipo.nombre}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-reglas" className="space-y-2">
        <h3 id="titulo-reglas" className="text-lg font-semibold">
          Reglas
        </h3>
        <ul className="list-disc space-y-1 pl-6 text-slate-800">
          <li>{tachasMaximas} tachas por ronda</li>
          <li>
            Ronda final:{' '}
            {rondaFinal.activa
              ? `activa (${String(rondaFinal.segundos[0])} y ${String(rondaFinal.segundos[1])} segundos, meta de ${String(rondaFinal.meta)} puntos)`
              : 'desactivada'}
          </li>
        </ul>
      </section>

      <section aria-labelledby="titulo-rondas" className="space-y-2">
        <h3 id="titulo-rondas" className="text-lg font-semibold">
          Rondas
        </h3>
        {juego.rondas.length === 0 ? (
          <p className="text-slate-700">Este juego todavía no tiene rondas.</p>
        ) : (
          <ol aria-label="Rondas" className="space-y-2">
            {juego.rondas.map((ronda, indice) => (
              <li
                key={`${ronda.preguntaId}-${String(indice)}`}
                className="flex flex-wrap items-baseline gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <span className="text-sm font-semibold text-slate-600">Ronda {indice + 1}</span>
                <span className="flex-1 font-medium text-slate-900">
                  {preguntas[indice]?.texto ?? 'Pregunta no disponible'}
                </span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-sm font-bold text-white">
                  x{ronda.multiplicador}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-600">
        Podrás editar equipos, reglas y rondas, e iniciar la partida, en una próxima fase.
      </p>
    </div>
  );
}

export function VistaConfigurarJuego() {
  const { juegoId } = useParams();

  if (juegoId === undefined) {
    return (
      <VistaEnConstruccion
        titulo="Configurar juego"
        descripcion="Define equipos, reglas, rondas y preguntas para iniciar una partida."
      />
    );
  }

  return (
    <section aria-labelledby="titulo-configurar" className="mx-auto max-w-4xl space-y-4">
      <h1 id="titulo-configurar" className="text-3xl font-bold tracking-tight">
        Configurar juego
      </h1>
      <ResumenJuego juegoId={juegoId} />
    </section>
  );
}
