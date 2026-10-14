import { Dexie } from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { configPrueba } from '@/test/fabricasPartida';

import { BaseDatosTopRespuestas } from './baseDatos';
import { crearRepositoriosDexie } from './repositoriosDexie';

const NOMBRE = 'top-respuestas-migracion';

/** The shipped version 1 schema, frozen here so the upgrade path stays tested. */
function abrirVersion1(indexedDB: IDBFactory): Dexie {
  const db = new Dexie(NOMBRE, { indexedDB, IDBKeyRange });
  db.version(1).stores({
    sets: 'id, nombre, actualizadoEn',
    preguntas: 'id, setId, tema, actualizadoEn',
    juegos: 'id, actualizadoEn',
    partidas: 'id, juegoId, estado, actualizadoEn',
    meta: 'clave',
  });
  return db;
}

describe('BaseDatosTopRespuestas migrations', () => {
  it('upgrades version 1 partidas: placeholder rows end, complete rows keep playing', async () => {
    const indexedDB = new IDBFactory();
    const v1 = abrirVersion1(indexedDB);
    await v1.table('partidas').bulkAdd([
      // Fase 1 placeholder shape: no config snapshot, no log.
      {
        id: 'vieja',
        juegoId: 'j1',
        estado: 'enCurso',
        creadoEn: 1,
        actualizadoEn: 1,
        eliminadoEn: null,
      },
      {
        id: 'completa',
        juegoId: 'j2',
        config: configPrueba(),
        eventos: [{ tipo: 'TACHE' }],
        estado: 'enCurso',
        creadoEn: 2,
        actualizadoEn: 2,
        eliminadoEn: null,
      },
    ]);
    await v1.table('sets').add({ id: 's1', nombre: 'Set', materia: '', grupo: '' });
    v1.close();

    const db = new BaseDatosTopRespuestas(NOMBRE, { indexedDB, IDBKeyRange });
    const repositorios = crearRepositoriosDexie(db);

    expect(await db.partidas.get('vieja')).toMatchObject({ estado: 'terminada', eventos: [] });
    expect(await repositorios.partidas.obtenerEnCurso()).toMatchObject({
      id: 'completa',
      eventos: [{ tipo: 'TACHE' }],
    });
    expect(db.verno).toBe(2);
    expect(await db.sets.get('s1')).toMatchObject({ nombre: 'Set' });
    db.close();
  });
});
