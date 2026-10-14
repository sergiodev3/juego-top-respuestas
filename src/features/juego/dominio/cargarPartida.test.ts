import { describe, expect, it } from 'vitest';

import type { Partida } from '@/shared/modelo';
import { configPrueba } from '@/test/fabricasPartida';

import { cargarPartida } from './cargarPartida';

function partidaCon(cambios: Partial<Record<keyof Partida, unknown>> = {}): Partida {
  return {
    id: 'partida-1',
    juegoId: 'juego-1',
    config: configPrueba(),
    eventos: [],
    estado: 'enCurso',
    creadoEn: 1,
    actualizadoEn: 1,
    eliminadoEn: null,
    ...cambios,
  } as Partida;
}

describe('cargarPartida', () => {
  it('rebuilds the state by replaying the stored log', () => {
    const resultado = cargarPartida(
      partidaCon({
        eventos: [
          { tipo: 'ASIGNAR_TURNO', equipo: 1 },
          { tipo: 'REVELAR', indice: 0 },
        ],
      }),
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.config.nombre).toBe('Juego de prueba');
      expect(resultado.estado.ronda?.caraACara.ganador).toBe(1);
      expect(resultado.advertencias).toEqual([]);
    }
  });

  it('skips invalid stored events and reports them as warnings', () => {
    const resultado = cargarPartida(partidaCon({ eventos: [{ tipo: 'TACHE' }, { tipo: 'OTRO' }] }));

    expect(resultado.ok && resultado.advertencias.map((a) => a.indice)).toEqual([0, 1]);
  });

  it('returns Spanish errors instead of throwing for a broken snapshot', () => {
    const roto = cargarPartida(partidaCon({ config: { nombre: 'Roto' } }));
    expect(roto.ok).toBe(false);
    expect(!roto.ok && roto.errores.length > 0).toBe(true);
    expect(
      !roto.ok && roto.errores.every((error) => error.startsWith('La configuración de la partida')),
    ).toBe(true);
    expect(cargarPartida(partidaCon({ eventos: 'no es lista' }))).toEqual({
      ok: false,
      errores: ['El historial de eventos de la partida debe ser una lista.'],
    });
    expect(cargarPartida(undefined)).toEqual({
      ok: false,
      errores: ['No se encontró la partida solicitada.'],
    });
  });
});
