import { esquemaDatosJuego, type Juego } from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import type { DependenciasRepositorio, RepositorioJuegos } from './repositorios';

function estaVigente(registro: { eliminadoEn: number | null }): boolean {
  return registro.eliminadoEn === null;
}

export function crearRepositorioJuegos(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio,
): RepositorioJuegos {
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
  };
}
