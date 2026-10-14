import { esquemaDatosJuego, type Juego } from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import {
  ErrorRegistroNoEncontrado,
  type DependenciasRepositorio,
  type RepositorioJuegos,
} from './repositorios';

function estaVigente(registro: { eliminadoEn: number | null }): boolean {
  return registro.eliminadoEn === null;
}

export function crearRepositorioJuegos(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): RepositorioJuegos {
  async function obtenerVigente(id: string): Promise<Juego> {
    const juego = await db.juegos.get(id);
    if (!juego || !estaVigente(juego)) {
      throw new ErrorRegistroNoEncontrado('juego', id);
    }
    return juego;
  }

  return {
    async listar() {
      const juegos = await db.juegos.toArray();
      return juegos
        .filter(estaVigente)
        .toSorted((a, b) => b.actualizadoEn - a.actualizadoEn || (a.id < b.id ? -1 : 1));
    },

    async obtener(id) {
      const juego = await db.juegos.get(id);
      return juego && estaVigente(juego) ? juego : undefined;
    },

    async crear(datos) {
      const validos = esquemaDatosJuego.parse(datos);
      const momento = ahora();
      const juego: Juego = {
        id: generarId(),
        ...validos,
        creadoEn: momento,
        actualizadoEn: momento,
        eliminadoEn: null,
      };
      await db.juegos.add(juego);
      return juego;
    },

    async actualizar(id, datos) {
      const validos = esquemaDatosJuego.parse(datos);
      return db.transaction('rw', db.juegos, async () => {
        const actual = await obtenerVigente(id);
        const actualizado: Juego = { ...actual, ...validos, actualizadoEn: ahora() };
        await db.juegos.put(actualizado);
        return actualizado;
      });
    },

    async eliminar(id) {
      await db.transaction('rw', db.juegos, async () => {
        await obtenerVigente(id);
        const momento = ahora();
        await db.juegos.update(id, { eliminadoEn: momento, actualizadoEn: momento });
      });
    },
  };
}
