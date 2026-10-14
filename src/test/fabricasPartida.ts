// Test-only builders for partida, sync and board specs. Answer texts are distinctive tokens so
// leak tests can search rendered or serialized output without false positives.
import type { ConfigPartida, PreguntaSnapshot } from '@/engine';
import type { Pregunta } from '@/shared/modelo';

export function preguntaSnapshotPrueba(
  clave: string,
  puntos: readonly number[] = [40, 25, 15, 12, 8],
) {
  return {
    id: `pregunta-${clave}`,
    tema: 'General',
    texto: `Pregunta ${clave}`,
    respuestas: puntos.map((valor, indice) => ({
      texto: `TXT_${clave}_${String(indice)}`,
      puntos: valor,
      sinonimos: [`SIN_${clave}_${String(indice)}`],
    })),
  } satisfies PreguntaSnapshot;
}

/** Valid snapshot: 2 teams, rounds x1 and x2, 3 strikes, no final round. */
export function configPrueba(cambios: Partial<ConfigPartida> = {}): ConfigPartida {
  return {
    nombre: 'Juego de prueba',
    equipos: [
      { id: 'equipo-1', nombre: 'Equipo A', color: '#1d4ed8' },
      { id: 'equipo-2', nombre: 'Equipo B', color: '#b91c1c' },
    ],
    rondas: [
      { pregunta: preguntaSnapshotPrueba('R1'), multiplicador: 1 },
      { pregunta: preguntaSnapshotPrueba('R2'), multiplicador: 2 },
    ],
    tachasMaximas: 3,
    rondaFinal: null,
    ...cambios,
  };
}

/** Stored bank question with the given id; answers are already sorted by points. */
export function preguntaBancoPrueba(id: string, cambios: Partial<Pregunta> = {}): Pregunta {
  return {
    id,
    setId: 'set-1',
    tema: 'General',
    texto: `Texto ${id}`,
    respuestas: [
      { texto: `Primera ${id}`, puntos: 50, sinonimos: ['uno'] },
      { texto: `Segunda ${id}`, puntos: 30, sinonimos: [] },
    ],
    creadoEn: 1,
    actualizadoEn: 1,
    eliminadoEn: null,
    ...cambios,
  };
}
