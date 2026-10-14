import { describe, expect, it } from 'vitest';

import { crearCanal } from './canal';
import type { MensajeSync } from './mensajes';
import { crearTransporteBroadcast } from './transporteBroadcast';

describe('crearTransporteBroadcast', () => {
  it('carries validated messages between two channels with the same name', async () => {
    const transporteA = crearTransporteBroadcast('top-respuestas-prueba');
    const transporteB = crearTransporteBroadcast('top-respuestas-prueba');
    if (transporteA === null || transporteB === null) {
      throw new Error('BroadcastChannel should exist in Node 22.');
    }
    const panel = crearCanal(transporteA);
    const tablero = crearCanal(transporteB);

    const recibido = new Promise<MensajeSync>((resolver) => {
      const cancelar = tablero.suscribir((mensaje) => {
        cancelar();
        resolver(mensaje);
      });
    });
    panel.publicar({ v: 1, tipo: 'SOLICITAR_ESTADO' });

    await expect(recibido).resolves.toEqual({ v: 1, tipo: 'SOLICITAR_ESTADO' });
    panel.cerrar();
    tablero.cerrar();
  });
});
