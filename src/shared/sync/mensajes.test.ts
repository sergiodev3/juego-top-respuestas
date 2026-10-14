import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import { proyectarTablero, reducir, type VistaTablero } from '@/engine';
import { configPrueba } from '@/test/fabricasPartida';

import { esquemaMensajeSync, esquemaVistaTablero } from './mensajes';

const VISTA_RONDA_FINAL: VistaTablero = {
  nombreJuego: 'Final',
  fase: 'rondaFinal',
  equipos: [
    { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 300 },
    { nombre: 'Equipo B', color: '#b91c1c', puntaje: 120 },
  ],
  ronda: null,
  rondaFinal: {
    equipo: 0,
    jugadorActual: 2,
    jugadores: [
      { jugador: 1, oculto: true, respuestas: [{ numero: 1, revelada: false }] },
      {
        jugador: 2,
        oculto: false,
        respuestas: [{ numero: 1, revelada: true, texto: 'Perro', puntos: 30 }],
      },
    ],
    total: 75,
    meta: 200,
    resultado: null,
  },
};

describe('esquemaVistaTablero', () => {
  it('cannot drift from the engine VistaTablero type', () => {
    // Every engine view is accepted, and every parsed view is an engine view.
    expectTypeOf<VistaTablero>().toExtend<z.input<typeof esquemaVistaTablero>>();
    expectTypeOf<z.output<typeof esquemaVistaTablero>>().toExtend<VistaTablero>();
  });

  it('accepts real projections unchanged', () => {
    const config = configPrueba();
    const estado = reducir(config, [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 1 },
      { tipo: 'TACHE' },
    ]);
    const vista = proyectarTablero(config, estado);

    expect(esquemaVistaTablero.parse(vista)).toEqual(vista);
    expect(esquemaVistaTablero.parse(VISTA_RONDA_FINAL)).toEqual(VISTA_RONDA_FINAL);
  });

  it('drops keys the projection does not define', () => {
    const conExtra = { ...VISTA_RONDA_FINAL, respuestasOcultas: ['SECRETO'] };

    expect(esquemaVistaTablero.parse(conExtra)).toEqual(VISTA_RONDA_FINAL);
  });
});

describe('esquemaMensajeSync', () => {
  it('accepts every protocol message of version 1', () => {
    const mensajes = [
      {
        v: 1,
        tipo: 'ESTADO_TABLERO',
        partidaId: 'p1',
        secuencia: 3,
        vista: VISTA_RONDA_FINAL,
        temporizador: { restante: 12, total: 25, corriendo: true },
      },
      {
        v: 1,
        tipo: 'ESTADO_TABLERO',
        partidaId: 'p1',
        secuencia: 4,
        vista: VISTA_RONDA_FINAL,
        temporizador: null,
      },
      { v: 1, tipo: 'SIN_PARTIDA' },
      { v: 1, tipo: 'SOLICITAR_ESTADO' },
      { v: 1, tipo: 'TABLERO_PRESENTE' },
    ];

    for (const mensaje of mensajes) {
      expect(esquemaMensajeSync.safeParse(mensaje).success).toBe(true);
    }
  });

  it('rejects other versions, unknown types and broken payloads', () => {
    const invalidos: unknown[] = [
      null,
      'SOLICITAR_ESTADO',
      { v: 2, tipo: 'SOLICITAR_ESTADO' },
      { tipo: 'SOLICITAR_ESTADO' },
      { v: 1, tipo: 'OTRO' },
      { v: 1, tipo: 'ESTADO_TABLERO', partidaId: 'p1', secuencia: -1, vista: VISTA_RONDA_FINAL },
      { v: 1, tipo: 'ESTADO_TABLERO', partidaId: 'p1', secuencia: 1, vista: { fase: 'x' } },
    ];

    for (const mensaje of invalidos) {
      expect(esquemaMensajeSync.safeParse(mensaje).success).toBe(false);
    }
  });
});
