import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import { RUTAS, rutaPanel } from '@/shared/rutas';
import { cx } from '@/shared/utils/cx';

const TARJETAS = [
  {
    to: RUTAS.juegoRapido,
    titulo: 'Nuevo juego rápido',
    descripcion: 'Un set, dos clics y a jugar.',
  },
  {
    to: RUTAS.configurarJuego,
    titulo: 'Configurar juego',
    descripcion: 'Equipos, reglas, rondas y preguntas a la medida, o un juego guardado.',
  },
  {
    to: RUTAS.banco,
    titulo: 'Banco de preguntas',
    descripcion: 'Administra tus sets de preguntas y respuestas.',
  },
  {
    to: RUTAS.importar,
    titulo: 'Importar',
    descripcion: 'Carga preguntas desde Excel o CSV.',
  },
  {
    to: RUTAS.respaldos,
    titulo: 'Respaldos',
    descripcion: 'Exporta o restaura todos tus datos.',
  },
] as const;

const CLASE_TARJETA = 'block rounded-xl border p-6 shadow-sm';
const CLASE_TARJETA_ACTIVA = cx(
  CLASE_TARJETA,
  'border-slate-200 bg-white transition-colors hover:border-amber-400 hover:bg-amber-50',
);

function TarjetaContinuar() {
  const repositorios = useRepositorios();
  const partida = useLiveQuery(() => repositorios.partidas.obtenerEnCurso(), [repositorios]);

  if (partida === undefined) {
    return (
      <div
        aria-disabled="true"
        className={cx(
          CLASE_TARJETA,
          'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500',
        )}
      >
        <h2 className="text-xl font-semibold">Continuar partida</h2>
        <p>No hay una partida en curso.</p>
      </div>
    );
  }
  return (
    <Link to={rutaPanel(partida.id)} className={cx(CLASE_TARJETA_ACTIVA, 'border-amber-400')}>
      <h2 className="text-xl font-semibold">Continuar partida</h2>
      <p className="text-slate-700">{partida.config.nombre}</p>
    </Link>
  );
}

export function VistaInicio() {
  return (
    <section aria-labelledby="titulo-inicio" className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 id="titulo-inicio" className="text-4xl font-extrabold tracking-tight">
          Top Respuestas
        </h1>
        <p className="text-lg text-slate-700">Juego de encuestas para el aula.</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <TarjetaContinuar />
        </li>
        {TARJETAS.map((tarjeta) => (
          <li key={tarjeta.to}>
            <Link to={tarjeta.to} className={CLASE_TARJETA_ACTIVA}>
              <h2 className="text-xl font-semibold">{tarjeta.titulo}</h2>
              <p className="text-slate-700">{tarjeta.descripcion}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
