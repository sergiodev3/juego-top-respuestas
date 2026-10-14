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
});
