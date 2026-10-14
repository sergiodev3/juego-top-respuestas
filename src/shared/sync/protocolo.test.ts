import { describe, expect, it } from 'vitest';

import type { VistaTablero } from '@/engine';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { crearCanal } from './canal';
import type { MensajeEstadoTablero, MensajeSync } from './mensajes';
import {
  crearContadorSecuencia,
  ESTADO_TABLERO_INICIAL,
  reducirEstadoTablero,
  tableroConectado,
} from './protocolo';

const VISTA: VistaTablero = {
  nombreJuego: 'Repaso',
  fase: 'caraACara',
  equipos: [
    { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 0 },
    { nombre: 'Equipo B', color: '#b91c1c', puntaje: 0 },
  ],
  ronda: null,
  rondaFinal: null,
};

function estado(
  partidaId: string,
  secuencia: number,
  nombreJuego = 'Repaso',
): MensajeEstadoTablero {
  return {
    v: 1,
    tipo: 'ESTADO_TABLERO',
    partidaId,
    secuencia,
    vista: { ...VISTA, nombreJuego },
    temporizador: null,
  };
}

describe('crearCanal', () => {
  it('delivers valid messages to the other side and ignores invalid ones', () => {
    const bus = crearBusMemoria();
    const transportePanel = bus.crearTransporte();
    const panel = crearCanal(transportePanel);
    const tablero = crearCanal(bus.crearTransporte());
    const recibidos: MensajeSync[] = [];
    tablero.suscribir((mensaje) => recibidos.push(mensaje));

    transportePanel.enviar({ v: 1, tipo: 'NO_EXISTE' });
    transportePanel.enviar('basura');
    panel.publicar({ v: 1, tipo: 'SIN_PARTIDA' });

    expect(recibidos).toEqual([{ v: 1, tipo: 'SIN_PARTIDA' }]);
  });

  it('only sends schema fields, so extra data can never leak to the board', () => {
    const bus = crearBusMemoria();
    const panel = crearCanal(bus.crearTransporte());
    const mensaje = estado('p1', 1);
    const conExtra = { ...mensaje, vista: { ...mensaje.vista, secreto: 'RESPUESTA_OCULTA' } };

    panel.publicar(conExtra);

    expect(bus.enviados).toEqual([mensaje]);
  });

  it('stops delivering after unsubscribe or close', () => {
    const bus = crearBusMemoria();
    const panel = crearCanal(bus.crearTransporte());
    const tablero = crearCanal(bus.crearTransporte());
    const recibidos: MensajeSync[] = [];
    const cancelar = tablero.suscribir((mensaje) => recibidos.push(mensaje));

    cancelar();
    panel.publicar({ v: 1, tipo: 'SOLICITAR_ESTADO' });
    tablero.suscribir((mensaje) => recibidos.push(mensaje));
    tablero.cerrar();
    panel.publicar({ v: 1, tipo: 'SOLICITAR_ESTADO' });

    expect(recibidos).toEqual([]);
  });
});

describe('reducirEstadoTablero', () => {
  it('starts waiting and keeps the latest view of a partida', () => {
    const primero = reducirEstadoTablero(ESTADO_TABLERO_INICIAL, estado('p1', 1));
    const segundo = reducirEstadoTablero(primero, estado('p1', 2, 'Nuevo'));

    expect(ESTADO_TABLERO_INICIAL).toEqual({ tipo: 'esperando' });
    expect(segundo).toEqual({
      tipo: 'partida',
      partidaId: 'p1',
      secuencia: 2,
      vista: { ...VISTA, nombreJuego: 'Nuevo' },
      temporizador: null,
    });
  });

  it('ignores stale or repeated sequence numbers of the same partida', () => {
    const actual = reducirEstadoTablero(ESTADO_TABLERO_INICIAL, estado('p1', 5));

    expect(reducirEstadoTablero(actual, estado('p1', 4, 'Viejo'))).toBe(actual);
    expect(reducirEstadoTablero(actual, estado('p1', 5, 'Repetido'))).toBe(actual);
  });

  it('accepts any sequence for a different partida', () => {
    const actual = reducirEstadoTablero(ESTADO_TABLERO_INICIAL, estado('p1', 50));

    expect(reducirEstadoTablero(actual, estado('p2', 1))).toMatchObject({
      partidaId: 'p2',
      secuencia: 1,
    });
  });

  it('shows the waiting screen on SIN_PARTIDA and ignores board-side messages', () => {
    const actual = reducirEstadoTablero(ESTADO_TABLERO_INICIAL, estado('p1', 5));

    expect(reducirEstadoTablero(actual, { v: 1, tipo: 'SIN_PARTIDA' })).toEqual({
      tipo: 'sinPartida',
    });
    expect(reducirEstadoTablero(actual, { v: 1, tipo: 'SOLICITAR_ESTADO' })).toBe(actual);
    expect(reducirEstadoTablero(actual, { v: 1, tipo: 'TABLERO_PRESENTE' })).toBe(actual);
  });
});

describe('crearContadorSecuencia', () => {
  it('grows strictly, and starts from the clock so a reloaded panel is never stale', () => {
    let reloj = 1000;
    const contador = crearContadorSecuencia(() => reloj);

    const valores = [contador.siguiente(), contador.siguiente(), contador.siguiente()];
    reloj = 5000;
    valores.push(contador.siguiente());

    expect(valores).toEqual([1000, 1001, 1002, 5000]);
  });
});

describe('tableroConectado', () => {
  it('is connected only when a heartbeat was seen in the last 5 seconds', () => {
    expect(tableroConectado(null, 10_000)).toBe(false);
    expect(tableroConectado(10_000, 10_000)).toBe(true);
    expect(tableroConectado(5_000, 10_000)).toBe(true);
    expect(tableroConectado(4_999, 10_000)).toBe(false);
  });
});
