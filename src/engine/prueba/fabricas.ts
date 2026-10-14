// Test-only builders for engine specs. Answer texts and synonyms are distinctive tokens so the
// projection tests can search serialized output for leaks without false positives.
import { expect } from 'vitest';

import { reducir } from '../index';
import type { ConfigPartida, EstadoJuego, Evento, Multiplicador, PreguntaSnapshot } from '../index';

export const PUNTOS_RONDA = [40, 25, 15, 12, 8] as const;
export const PUNTOS_RONDA_FINAL = [50, 30, 15, 5] as const;
const COLORES = ['#1d4ed8', '#b91c1c', '#047857', '#7e22ce'];

export function crearPregunta(clave: string, puntos: readonly number[]): PreguntaSnapshot {
  return {
    id: `pregunta-${clave}`,
    tema: 'General',
    texto: `Pregunta ${clave}`,
    respuestas: puntos.map((valor, indice) => ({
      texto: `TXT_${clave}_${String(indice)}`,
      puntos: valor,
      sinonimos: [`SIN_${clave}_${String(indice)}`],
    })),
  };
}

export interface OpcionesConfig {
  readonly equipos?: number;
  readonly multiplicadores?: readonly Multiplicador[];
  readonly tachasMaximas?: number;
  readonly rondaFinal?: boolean;
  readonly meta?: number;
}

/** Default: 2 teams, rounds x1, x2, x3 with answers worth 40/25/15/12/8, 3 strikes, no final. */
export function crearConfig(opciones: OpcionesConfig = {}): ConfigPartida {
  const {
    equipos = 2,
    multiplicadores = [1, 2, 3],
    tachasMaximas = 3,
    rondaFinal = false,
    meta = 200,
  } = opciones;
  return congelar({
    nombre: 'Juego de prueba',
    equipos: Array.from({ length: equipos }, (_, indice) => ({
      id: `equipo-${String(indice + 1)}`,
      nombre: `Equipo ${'ABCD'.charAt(indice)}`,
      color: COLORES[indice] ?? '#000000',
    })),
    rondas: multiplicadores.map((multiplicador, indice) => ({
      pregunta: crearPregunta(`R${String(indice + 1)}`, PUNTOS_RONDA),
      multiplicador,
    })),
    tachasMaximas,
    rondaFinal: rondaFinal
      ? {
          preguntas: Array.from({ length: 5 }, (_, indice) =>
            crearPregunta(`F${String(indice + 1)}`, PUNTOS_RONDA_FINAL),
          ),
          segundos: [20, 25] as const,
          meta,
        }
      : null,
  });
}

/** Recursively freezes a value so tests catch any mutation of engine inputs. */
export function congelar<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const hijo of Object.values(valor)) {
      congelar(hijo);
    }
  }
  return valor;
}

/** Narrows an indexed access in tests; fails loudly when the value is missing. */
export function definido<T>(valor: T | null | undefined): T {
  if (valor === null || valor === undefined) {
    throw new Error('Expected a value in the test fixture.');
  }
  return valor;
}

/** Replays a log that must be fully valid. */
export function jugar(config: ConfigPartida, eventos: readonly Evento[]): EstadoJuego {
  const estado = reducir(config, congelar([...eventos]));
  expect(estado.advertencias).toEqual([]);
  return estado;
}

/** Events that leave round 1 resolved by team `equipo` hitting the top answer. */
export function caraACaraGanado(equipo: number): Evento[] {
  return [
    { tipo: 'ASIGNAR_TURNO', equipo },
    { tipo: 'REVELAR', indice: 0 },
  ];
}

export function tachas(cantidad: number): Evento[] {
  return Array.from({ length: cantidad }, () => ({ tipo: 'TACHE' }) as const);
}
