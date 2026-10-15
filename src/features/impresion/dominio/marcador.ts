import type { DatosJuego } from '@/shared/modelo';

/** A scoreboard row: a team of the game, or a blank row to write a name by hand (`null`s). */
export interface EquipoMarcador {
  nombre: string | null;
  color: string | null;
}

/** A paper scoreboard: one row per team, one column per round, then the total. */
export interface Marcador {
  titulo: string;
  equipos: readonly EquipoMarcador[];
  columnas: readonly { etiqueta: string }[];
}

/** Where the scoreboard comes from: a game (its teams and rounds) or a set (all blank). */
export type FuenteMarcador = { tipo: 'set'; nombre: string } | { tipo: 'juego'; juego: DatosJuego };

/** Blank rows and rounds printed for a set, which has no teams or rounds of its own. */
const EQUIPOS_EN_BLANCO = 4;
const RONDAS_EN_BLANCO = 4;

function etiquetaRonda(numero: number, multiplicador = 1): string {
  return multiplicador > 1 ? `R${String(numero)} x${String(multiplicador)}` : `R${String(numero)}`;
}

/**
 * Builds the paper scoreboard sheet. A game lists its teams (with their colors) and one column
 * per round labelled with its multiplier ("R2 x2"), plus "Ronda final" when it is active; a set
 * gets 4 blank team rows and 4 blank rounds. The last column is always "Total".
 */
export function crearMarcador(fuente: FuenteMarcador): Marcador {
  if (fuente.tipo === 'set') {
    return {
      titulo: `Marcador: ${fuente.nombre}`,
      equipos: Array.from({ length: EQUIPOS_EN_BLANCO }, () => ({ nombre: null, color: null })),
      columnas: [
        ...Array.from({ length: RONDAS_EN_BLANCO }, (_, indice) => ({
          etiqueta: etiquetaRonda(indice + 1),
        })),
        { etiqueta: 'Total' },
      ],
    };
  }

  const { juego } = fuente;
  return {
    titulo: `Marcador: ${juego.nombre}`,
    equipos: juego.equipos.map((equipo) => ({ nombre: equipo.nombre, color: equipo.color })),
    columnas: [
      ...juego.rondas.map((ronda, indice) => ({
        etiqueta: etiquetaRonda(indice + 1, ronda.multiplicador),
      })),
      ...(juego.reglas.rondaFinal.activa ? [{ etiqueta: 'Ronda final' }] : []),
      { etiqueta: 'Total' },
    ],
  };
}
