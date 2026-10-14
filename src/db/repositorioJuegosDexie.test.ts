import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { crearJuegoPorDefecto } from '@/shared/modelo';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

describe('RepositorioJuegos (Dexie)', () => {
  it('creates a game with id and timestamps and reads it back', async () => {
    const { repositorios, reloj } = entorno;
    const datos = crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: ['p1', 'p2'] });

    const creado = await repositorios.juegos.crear(datos);

    expect(creado).toEqual({
      ...datos,
      id: 'id-1',
      creadoEn: reloj.ahora(),
      actualizadoEn: reloj.ahora(),
      eliminadoEn: null,
    });
    expect(await repositorios.juegos.obtener('id-1')).toEqual(creado);
    expect(await repositorios.juegos.obtener('no-existe')).toBeUndefined();
  });

  it('rejects invalid data with the schema error', async () => {
    const datos = crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: [] });

    await expect(entorno.repositorios.juegos.crear({ ...datos, nombre: ' ' })).rejects.toThrow(
      'Escribe el nombre del juego.',
    );
  });

  it('lists non-deleted games, most recently updated first', async () => {
    const { repositorios, reloj, db } = entorno;
    const viejo = await repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Viejo', preguntaIds: [] }),
    );
    reloj.avanzar();
    const borrado = await repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Borrado', preguntaIds: [] }),
    );
    reloj.avanzar();
    await repositorios.juegos.crear(crearJuegoPorDefecto({ nombre: 'Nuevo', preguntaIds: [] }));
    await db.juegos.update(borrado.id, { eliminadoEn: reloj.ahora() });

    expect((await repositorios.juegos.listar()).map((j) => j.nombre)).toEqual(['Nuevo', 'Viejo']);
    expect(await repositorios.juegos.obtener(borrado.id)).toBeUndefined();
    expect(await repositorios.juegos.obtener(viejo.id)).toBeDefined();
  });

  it('updates a game: new data and actualizadoEn, same id and creadoEn', async () => {
    const { repositorios, reloj } = entorno;
    const creado = await repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: ['p1'] }),
    );
    reloj.avanzar();
    const cambios = crearJuegoPorDefecto({ nombre: ' Final ', preguntaIds: ['p2', 'p3'] });

    const actualizado = await repositorios.juegos.actualizar(creado.id, cambios);

    expect(actualizado).toEqual({
      ...cambios,
      nombre: 'Final',
      id: creado.id,
      creadoEn: creado.creadoEn,
      actualizadoEn: reloj.ahora(),
      eliminadoEn: null,
    });
    expect(await repositorios.juegos.obtener(creado.id)).toEqual(actualizado);
  });

  it('rejects updates with invalid data or for a missing game', async () => {
    const { repositorios } = entorno;
    const datos = crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: [] });
    const creado = await repositorios.juegos.crear(datos);

    await expect(
      repositorios.juegos.actualizar(creado.id, { ...datos, nombre: '' }),
    ).rejects.toThrow('Escribe el nombre del juego.');
    await expect(repositorios.juegos.actualizar('no-existe', datos)).rejects.toThrow(
      'No se encontró el juego solicitado.',
    );
  });

  it('soft-deletes a game so reads hide it', async () => {
    const { repositorios, reloj, db } = entorno;
    const creado = await repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: [] }),
    );
    reloj.avanzar();

    await repositorios.juegos.eliminar(creado.id);

    expect(await repositorios.juegos.obtener(creado.id)).toBeUndefined();
    expect(await repositorios.juegos.listar()).toEqual([]);
    expect(await db.juegos.get(creado.id)).toMatchObject({
      eliminadoEn: reloj.ahora(),
      actualizadoEn: reloj.ahora(),
    });
    await expect(repositorios.juegos.eliminar(creado.id)).rejects.toThrow(
      'No se encontró el juego solicitado.',
    );
  });
});
