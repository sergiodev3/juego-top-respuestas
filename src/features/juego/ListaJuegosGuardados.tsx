import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { useRepositorios } from '@/db/contextoRepositorios';
import type { Juego } from '@/shared/modelo';
import { rutaConfigurarJuego, rutaImpresion } from '@/shared/rutas';
import { AvisoError } from '@/shared/ui/AvisoError';
import { CLASE_BOTON_ACCION, CLASE_BOTON_ACCION_PELIGRO } from '@/shared/ui/clases';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';

import { validarParaIniciar } from './dominio';
import { textoRondas } from './textos';
import { prepararConfigPartida, useIniciarPartida } from './useIniciarPartida';

/** Saved games (most recently updated first) with edit, start, print and delete actions. */
export function ListaJuegosGuardados() {
  const repositorios = useRepositorios();
  const id = useId();
  const juegos = useLiveQuery(() => repositorios.juegos.listar(), [repositorios]);
  const [porEliminar, setPorEliminar] = useState<Juego | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [problemas, setProblemas] = useState<{ titulo: string; lista: readonly string[] } | null>(
    null,
  );
  const inicio = useIniciarPartida();

  async function iniciar(juego: Juego) {
    setProblemas(null);
    const titulo = `No se puede iniciar «${juego.nombre}»:`;
    const errores = validarParaIniciar(juego);
    if (errores.length > 0) {
      setProblemas({ titulo, lista: errores });
      return;
    }
    try {
      const resultado = await prepararConfigPartida(repositorios.preguntas, juego);
      if (!resultado.ok) {
        setProblemas({ titulo, lista: resultado.errores });
        return;
      }
      await inicio.iniciar({ juegoId: juego.id, config: resultado.config });
    } catch {
      setProblemas({ titulo, lista: ['No se pudo iniciar la partida. Intenta de nuevo.'] });
    }
  }

  async function confirmarEliminacion() {
    if (porEliminar === null) {
      return;
    }
    setProblemas(null);
    setOcupado(true);
    try {
      await repositorios.juegos.eliminar(porEliminar.id);
    } catch {
      setProblemas({
        titulo: `No se pudo eliminar «${porEliminar.nombre}».`,
        lista: ['Intenta de nuevo.'],
      });
    } finally {
      setOcupado(false);
      setPorEliminar(null);
    }
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      <h2 id={`${id}-titulo`} className="text-2xl font-bold">
        Juegos guardados
      </h2>
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
      {juegos === undefined ? (
        <p className="text-slate-700">Cargando juegos…</p>
      ) : juegos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-700">
          Todavía no hay juegos guardados.
        </p>
      ) : (
        <ul aria-label="Juegos guardados" className="grid gap-3 sm:grid-cols-2">
          {juegos.map((juego) => (
            <li
              key={juego.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">{juego.nombre}</h3>
              <p className="text-sm text-slate-600">
                {textoRondas(juego.rondas.length)} · {juego.equipos.length} equipos
                {juego.reglas.rondaFinal.activa && ' · con ronda final'}
              </p>
              <div className="mt-auto flex flex-wrap gap-1">
                <Link
                  to={rutaConfigurarJuego(juego.id)}
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Editar el juego ${juego.nombre}`}
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Iniciar el juego ${juego.nombre}`}
                  disabled={inicio.ocupado}
                  onClick={() => void iniciar(juego)}
                >
                  Iniciar
                </button>
                <Link
                  to={rutaImpresion({ juego: juego.id })}
                  className={CLASE_BOTON_ACCION}
                  aria-label={`Imprimir tarjetas del juego ${juego.nombre}`}
                >
                  Imprimir tarjetas
                </Link>
                <button
                  type="button"
                  className={CLASE_BOTON_ACCION_PELIGRO}
                  aria-label={`Eliminar el juego ${juego.nombre}`}
                  onClick={() => {
                    setPorEliminar(juego);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <DialogoConfirmacion
        abierto={porEliminar !== null}
        titulo={`¿Eliminar el juego «${porEliminar?.nombre ?? ''}»?`}
        descripcion="Las partidas ya jugadas no se modifican. Esta acción no se puede deshacer."
        textoConfirmar="Eliminar juego"
        ocupado={ocupado}
        onConfirmar={() => void confirmarEliminacion()}
        onCancelar={() => {
          setPorEliminar(null);
        }}
      />
      {inicio.dialogo}
    </section>
  );
}
