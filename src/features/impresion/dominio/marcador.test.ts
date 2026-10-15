import { describe, expect, it } from 'vitest';

import { crearJuegoPorDefecto, type DatosJuego } from '@/shared/modelo';

import { crearMarcador } from './marcador';

function juegoCon(cambios: Partial<DatosJuego> = {}): DatosJuego {
  return { ...crearJuegoPorDefecto({ nombre: 'Repaso final', preguntaIds: [] }), ...cambios };
}

describe('crearMarcador for a game', () => {
  it('has one row per team and one column per round with its multiplier, then the total', () => {
    const marcador = crearMarcador({
      tipo: 'juego',
      juego: juegoCon({
        equipos: [
          { id: 'e1', nombre: 'Leones', color: '#1d4ed8' },
          { id: 'e2', nombre: 'Águilas', color: '#b91c1c' },
          { id: 'e3', nombre: 'Lobos', color: '#047857' },
        ],
        rondas: [
          { preguntaId: 'p1', multiplicador: 1 },
          { preguntaId: 'p2', multiplicador: 2 },
          { preguntaId: 'p3', multiplicador: 3 },
        ],
      }),
    });

    expect(marcador).toEqual({
      titulo: 'Marcador: Repaso final',
      equipos: [
        { nombre: 'Leones', color: '#1d4ed8' },
        { nombre: 'Águilas', color: '#b91c1c' },
        { nombre: 'Lobos', color: '#047857' },
      ],
      columnas: [
        { etiqueta: 'R1' },
        { etiqueta: 'R2 x2' },
        { etiqueta: 'R3 x3' },
        { etiqueta: 'Total' },
      ],
    });
  });

  it('adds a final-round column before the total only when the final round is active', () => {
    const base = juegoCon({ rondas: [{ preguntaId: 'p1', multiplicador: 1 }] });
    const conFinal = juegoCon({
      rondas: [{ preguntaId: 'p1', multiplicador: 1 }],
      reglas: {
        ...base.reglas,
        rondaFinal: { ...base.reglas.rondaFinal, activa: true, preguntaIds: [] },
      },
    });

    expect(crearMarcador({ tipo: 'juego', juego: base }).columnas).toEqual([
      { etiqueta: 'R1' },
      { etiqueta: 'Total' },
    ]);
    expect(crearMarcador({ tipo: 'juego', juego: conFinal }).columnas).toEqual([
      { etiqueta: 'R1' },
      { etiqueta: 'Ronda final' },
      { etiqueta: 'Total' },
    ]);
  });
});

describe('crearMarcador for a set', () => {
  it('has four blank team rows and four blank rounds plus the total', () => {
    expect(crearMarcador({ tipo: 'set', nombre: 'Ciencias 2B' })).toEqual({
      titulo: 'Marcador: Ciencias 2B',
      equipos: [
        { nombre: null, color: null },
        { nombre: null, color: null },
        { nombre: null, color: null },
        { nombre: null, color: null },
      ],
      columnas: [
        { etiqueta: 'R1' },
        { etiqueta: 'R2' },
        { etiqueta: 'R3' },
        { etiqueta: 'R4' },
        { etiqueta: 'Total' },
      ],
    });
  });
});
