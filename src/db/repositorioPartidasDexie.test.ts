import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

describe('RepositorioPartidas (Dexie)', () => {
  it('creates an in-progress partida with the config snapshot and an empty log', async () => {
    const { repositorios, reloj } = entorno;
    const config = configPrueba();

    const partida = await repositorios.partidas.crear({ juegoId: 'juego-1', config });

    expect(partida).toEqual({
      id: 'id-1',
      juegoId: 'juego-1',
      config,
      eventos: [],
      estado: 'enCurso',
      creadoEn: reloj.ahora(),
      actualizadoEn: reloj.ahora(),
      eliminadoEn: null,
    });
    expect(await repositorios.partidas.obtener('id-1')).toEqual(partida);
    expect(await repositorios.partidas.obtenerEnCurso()).toEqual(partida);
    expect(await repositorios.partidas.obtener('no-existe')).toBeUndefined();
  });

  it('rejects an invalid config with Spanish messages and writes nothing', async () => {
    const { repositorios } = entorno;

    await expect(
      repositorios.partidas.crear({ juegoId: 'juego-1', config: configPrueba({ rondas: [] }) }),
    ).rejects.toThrow('La partida necesita al menos una ronda.');
    expect(await repositorios.partidas.obtenerEnCurso()).toBeUndefined();
  });

  it('ends the previous in-progress partida when a new one starts', async () => {
    const { repositorios, reloj } = entorno;
    const anterior = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    reloj.avanzar();

    const nueva = await repositorios.partidas.crear({ juegoId: 'juego-2', config: configPrueba() });

    expect(await repositorios.partidas.obtenerEnCurso()).toEqual(nueva);
    expect(await repositorios.partidas.obtener(anterior.id)).toMatchObject({
      estado: 'terminada',
      actualizadoEn: reloj.ahora(),
    });
  });

  it('appends events in order and returns the new log', async () => {
    const { repositorios, reloj } = entorno;
    const partida = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    reloj.avanzar();

    await repositorios.partidas.agregarEvento(partida.id, { tipo: 'ASIGNAR_TURNO', equipo: 0 });
    const eventos = await repositorios.partidas.agregarEvento(partida.id, {
      tipo: 'REVELAR',
      indice: 0,
    });

    const esperados = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
    ];
    expect(eventos).toEqual(esperados);
    expect(await repositorios.partidas.obtener(partida.id)).toMatchObject({
      eventos: esperados,
      actualizadoEn: reloj.ahora(),
    });
  });

  it('rejects a malformed event without touching the log', async () => {
    const { repositorios } = entorno;
    const partida = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });

    await expect(
      repositorios.partidas.agregarEvento(partida.id, {
        tipo: 'REVELAR',
        indice: -1,
      }),
    ).rejects.toThrow('El evento no es válido.');
    expect((await repositorios.partidas.obtener(partida.id))?.eventos).toEqual([]);
  });

  it('removes the last event on undo and does nothing on an empty log', async () => {
    const { repositorios } = entorno;
    const partida = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    await repositorios.partidas.agregarEvento(partida.id, { tipo: 'ASIGNAR_TURNO', equipo: 1 });
    await repositorios.partidas.agregarEvento(partida.id, { tipo: 'TACHE' });

    expect(await repositorios.partidas.deshacer(partida.id)).toEqual([
      { tipo: 'ASIGNAR_TURNO', equipo: 1 },
    ]);
    expect(await repositorios.partidas.deshacer(partida.id)).toEqual([]);
    expect(await repositorios.partidas.deshacer(partida.id)).toEqual([]);
    expect((await repositorios.partidas.obtener(partida.id))?.eventos).toEqual([]);
  });

  it('ends a partida, which then accepts no more events', async () => {
    const { repositorios, reloj } = entorno;
    const partida = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    reloj.avanzar();

    await repositorios.partidas.terminar(partida.id);

    expect(await repositorios.partidas.obtenerEnCurso()).toBeUndefined();
    expect(await repositorios.partidas.obtener(partida.id)).toMatchObject({
      estado: 'terminada',
      actualizadoEn: reloj.ahora(),
    });
    await expect(
      repositorios.partidas.agregarEvento(partida.id, { tipo: 'TACHE' }),
    ).rejects.toThrow('La partida ya terminó.');
    await expect(repositorios.partidas.deshacer(partida.id)).rejects.toThrow(
      'La partida ya terminó.',
    );
  });

  it('reports a missing or deleted partida in Spanish', async () => {
    const { repositorios, db, reloj } = entorno;
    const partida = await repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    await db.partidas.update(partida.id, { eliminadoEn: reloj.ahora() });

    expect(await repositorios.partidas.obtener(partida.id)).toBeUndefined();
    expect(await repositorios.partidas.obtenerEnCurso()).toBeUndefined();
    await expect(
      repositorios.partidas.agregarEvento(partida.id, { tipo: 'TACHE' }),
    ).rejects.toThrow('No se encontró la partida solicitada.');
    await expect(repositorios.partidas.terminar('no-existe')).rejects.toThrow(
      'No se encontró la partida solicitada.',
    );
  });
});
