import type { TarjetasPorHoja } from './tarjetas';

/** What to print, as read from the URL (`?set=<id>` or `?juego=<id>`). */
export type FuenteImpresion = { tipo: 'set'; id: string } | { tipo: 'juego'; id: string };

export interface SeleccionImpresion {
  fuente: FuenteImpresion | null;
  porHoja: TarjetasPorHoja;
  /** Adds the paper scoreboard sheet after the cards (`?marcador=1`). */
  marcador: boolean;
}

function idValido(valor: string | null): string | null {
  const id = valor?.trim() ?? '';
  return id === '' ? null : id;
}

/**
 * Reads the print selection from the query string: the source (a set wins over a game when
 * both are present), the layout (`?por-hoja=4`; anything else means 2 cards per sheet) and
 * whether to add the paper scoreboard sheet (`?marcador=1`).
 */
export function leerSeleccion(parametros: URLSearchParams): SeleccionImpresion {
  const setId = idValido(parametros.get('set'));
  const juegoId = idValido(parametros.get('juego'));
  const fuente: FuenteImpresion | null =
    setId !== null
      ? { tipo: 'set', id: setId }
      : juegoId !== null
        ? { tipo: 'juego', id: juegoId }
        : null;
  return {
    fuente,
    porHoja: parametros.get('por-hoja') === '4' ? 4 : 2,
    marcador: parametros.get('marcador') === '1',
  };
}
