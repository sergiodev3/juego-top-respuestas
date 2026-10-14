import type { z } from 'zod';

import {
  esquemaDatosJuego,
  MAX_EQUIPOS,
  MIN_EQUIPOS,
  multiplicadorPredeterminado,
  PALETA_EQUIPOS,
  PREGUNTAS_RONDA_FINAL,
  type DatosJuego,
} from '@/shared/modelo';

// Pure editing helpers for the game setup form. Every function returns a new `DatosJuego`
// (or the same object when the change is not allowed), so the form state stays immutable.

const LETRAS_EQUIPOS = ['A', 'B', 'C', 'D'] as const;

/** Key letter shown next to a team (A-D); the panel assigns turns with the same keys. */
export function letraEquipo(indice: number): string {
  return LETRAS_EQUIPOS[indice] ?? String(indice + 1);
}

export function agregarEquipo(datos: DatosJuego): DatosJuego {
  if (datos.equipos.length >= MAX_EQUIPOS) {
    return datos;
  }
  const usados = new Set(datos.equipos.map((equipo) => equipo.color));
  const color =
    PALETA_EQUIPOS.find((opcion) => !usados.has(opcion.color))?.color ??
    PALETA_EQUIPOS[0]?.color ??
    '#1d4ed8';
  const ids = new Set(datos.equipos.map((equipo) => equipo.id));
  let numero = datos.equipos.length + 1;
  while (ids.has(`equipo-${String(numero)}`)) {
    numero += 1;
  }
  return {
    ...datos,
    equipos: [
      ...datos.equipos,
      {
        id: `equipo-${String(numero)}`,
        nombre: `Equipo ${letraEquipo(datos.equipos.length)}`,
        color,
      },
    ],
  };
}

export function quitarEquipo(datos: DatosJuego, indice: number): DatosJuego {
  if (datos.equipos.length <= MIN_EQUIPOS) {
    return datos;
  }
  return { ...datos, equipos: datos.equipos.filter((_, i) => i !== indice) };
}

/** Swaps the round with its neighbour (`-1` up, `1` down); a move past either end is ignored. */
export function moverRonda(datos: DatosJuego, indice: number, desplazamiento: -1 | 1): DatosJuego {
  const destino = indice + desplazamiento;
  const actual = datos.rondas[indice];
  const vecina = datos.rondas[destino];
  if (actual === undefined || vecina === undefined) {
    return datos;
  }
  const rondas = [...datos.rondas];
  rondas[indice] = vecina;
  rondas[destino] = actual;
  return { ...datos, rondas };
}

/** Question ids already used by the rounds and, when it is on, the final round. */
export function preguntasEnUso(datos: DatosJuego): Set<string> {
  const { rondaFinal } = datos.reglas;
  return new Set([
    ...datos.rondas.map((ronda) => ronda.preguntaId),
    ...(rondaFinal.activa ? rondaFinal.preguntaIds : []),
  ]);
}

/**
 * Up to `cantidad` distinct elements in random order. `aleatorio` returns a number in [0, 1)
 * like `Math.random`; inject it for deterministic tests.
 */
export function elegirAlAzar<T>(
  elementos: readonly T[],
  cantidad: number,
  aleatorio: () => number,
): T[] {
  const disponibles = [...elementos];
  const elegidos: T[] = [];
  while (elegidos.length < cantidad && disponibles.length > 0) {
    const indice = Math.min(Math.floor(aleatorio() * disponibles.length), disponibles.length - 1);
    elegidos.push(...disponibles.splice(Math.max(indice, 0), 1));
  }
  return elegidos;
}

/**
 * Replaces the rounds with up to `cantidad` random questions from `candidatas`, skipping the
 * final-round questions, with the default multipliers (x2/x3 on rounds 3/4 of a 4-round game).
 */
export function llenarRondas(
  datos: DatosJuego,
  candidatas: readonly string[],
  cantidad: number,
  aleatorio: () => number,
): DatosJuego {
  const { rondaFinal } = datos.reglas;
  const ocupadas = new Set(rondaFinal.activa ? rondaFinal.preguntaIds : []);
  const libres = [...new Set(candidatas)].filter((id) => !ocupadas.has(id));
  const elegidas = elegirAlAzar(libres, cantidad, aleatorio);
  return {
    ...datos,
    rondas: elegidas.map((preguntaId, indice) => ({
      preguntaId,
      multiplicador: multiplicadorPredeterminado(indice, elegidas.length),
    })),
  };
}

/** Replaces the final-round questions with up to 5 random ones not used by the rounds. */
export function llenarRondaFinal(
  datos: DatosJuego,
  candidatas: readonly string[],
  aleatorio: () => number,
): DatosJuego {
  const ocupadas = new Set(datos.rondas.map((ronda) => ronda.preguntaId));
  const libres = [...new Set(candidatas)].filter((id) => !ocupadas.has(id));
  const { rondaFinal } = datos.reglas;
  return {
    ...datos,
    reglas: {
      ...datos.reglas,
      rondaFinal: {
        ...rondaFinal,
        preguntaIds: elegirAlAzar(libres, PREGUNTAS_RONDA_FINAL, aleatorio),
      },
    },
  };
}

/** Schema issues as Spanish sentences, prefixed with the team or round they belong to. */
export function mensajesValidacion(error: z.ZodError): string[] {
  const mensajes = error.issues.map((issue) => {
    const [campo, indice, subcampo, posicion] = issue.path;
    if (campo === 'equipos' && typeof indice === 'number') {
      return `Equipo ${letraEquipo(indice)}: ${issue.message}`;
    }
    if (campo === 'rondas' && typeof indice === 'number') {
      return `Ronda ${String(indice + 1)}: ${issue.message}`;
    }
    if (subcampo === 'preguntaIds' && typeof posicion === 'number') {
      return `Ronda final, pregunta ${String(posicion + 1)}: ${issue.message}`;
    }
    return issue.message;
  });
  return [...new Set(mensajes)];
}

/**
 * Everything that blocks "Iniciar partida", in Spanish: the game schema plus the setup rules
 * (at least one round, exactly 5 final-round questions when it is on, distinct team colors and
 * no question used twice). Missing bank questions are reported later by `crearConfigPartida`.
 */
export function validarParaIniciar(datos: DatosJuego): string[] {
  const resultado = esquemaDatosJuego.safeParse(datos);
  const errores = resultado.success ? [] : mensajesValidacion(resultado.error);

  if (new Set(datos.equipos.map((equipo) => equipo.color)).size !== datos.equipos.length) {
    errores.push('Cada equipo necesita un color distinto.');
  }
  if (datos.rondas.length === 0) {
    errores.push('El juego necesita al menos una ronda.');
  }
  const { rondaFinal } = datos.reglas;
  if (rondaFinal.activa && rondaFinal.preguntaIds.length !== PREGUNTAS_RONDA_FINAL) {
    errores.push(`La ronda final necesita exactamente ${String(PREGUNTAS_RONDA_FINAL)} preguntas.`);
  }

  const vistas = new Set<string>();
  const revisar = (preguntaId: string, etiqueta: string) => {
    if (preguntaId !== '' && vistas.has(preguntaId)) {
      errores.push(`${etiqueta} repite una pregunta que ya está en el juego.`);
    }
    vistas.add(preguntaId);
  };
  datos.rondas.forEach((ronda, indice) => {
    revisar(ronda.preguntaId, `La ronda ${String(indice + 1)}`);
  });
  if (rondaFinal.activa) {
    rondaFinal.preguntaIds.forEach((id, indice) => {
      revisar(id, `La pregunta ${String(indice + 1)} de la ronda final`);
    });
  }
  return errores;
}
