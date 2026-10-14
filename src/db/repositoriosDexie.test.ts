import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DatosPregunta } from '@/shared/modelo';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { ErrorRegistroNoEncontrado } from './repositorios';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

function pregunta(texto: string, tema = '', puntos: number[] = [30, 20]): DatosPregunta {
  return {
    texto,
    tema,
    respuestas: puntos.map((p, i) => ({ texto: `R${String(i + 1)}`, puntos: p, sinonimos: [] })),
  };
}

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

describe('RepositorioSets (Dexie)', () => {
  it('creates a set with id, normalized data and timestamps', async () => {
    const { repositorios, reloj } = entorno;

    const creado = await repositorios.sets.crear({
      nombre: '  Ciencias 1A ',
      materia: 'Ciencias',
      grupo: '1A',
    });

    expect(creado).toEqual({
      id: 'id-1',
      nombre: 'Ciencias 1A',
      materia: 'Ciencias',
      grupo: '1A',
      creadoEn: reloj.ahora(),
      actualizadoEn: reloj.ahora(),
      eliminadoEn: null,
    });
    expect(await repositorios.sets.obtener('id-1')).toEqual(creado);
  });

  it('rejects invalid data with the schema error', async () => {
    await expect(
      entorno.repositorios.sets.crear({ nombre: ' ', materia: '', grupo: '' }),
    ).rejects.toThrow('Escribe el nombre del set.');
  });

  it('lists non-deleted sets sorted by name (es)', async () => {
    const { repositorios } = entorno;
    await repositorios.sets.crear({ nombre: 'Zoología', materia: '', grupo: '' });
    const borrar = await repositorios.sets.crear({ nombre: 'Borrar', materia: '', grupo: '' });
    await repositorios.sets.crear({ nombre: 'álgebra', materia: '', grupo: '' });
    await repositorios.sets.eliminar(borrar.id);

    const nombres = (await repositorios.sets.listar()).map((s) => s.nombre);

    expect(nombres).toEqual(['álgebra', 'Zoología']);
  });

  it('searches sets by name, materia or grupo ignoring case and accents', async () => {
    const { repositorios } = entorno;
    await repositorios.sets.crear({ nombre: 'Repaso', materia: 'Matemáticas', grupo: '2B' });
    await repositorios.sets.crear({ nombre: 'Historia', materia: 'Historia', grupo: '3A' });

    expect((await repositorios.sets.buscar('MATEMATICAS')).map((s) => s.nombre)).toEqual([
      'Repaso',
    ]);
    expect((await repositorios.sets.buscar('3a')).map((s) => s.nombre)).toEqual(['Historia']);
    expect(await repositorios.sets.buscar('  ')).toHaveLength(2);
  });

  it('updates a set, keeping creadoEn and refreshing actualizadoEn', async () => {
    const { repositorios, reloj } = entorno;
    const creado = await repositorios.sets.crear({ nombre: 'Viejo', materia: '', grupo: '' });
    reloj.avanzar(5000);

    const actualizado = await repositorios.sets.actualizar(creado.id, {
      nombre: 'Nuevo',
      materia: 'Español',
      grupo: '',
    });

    expect(actualizado).toMatchObject({
      nombre: 'Nuevo',
      materia: 'Español',
      creadoEn: creado.creadoEn,
      actualizadoEn: creado.creadoEn + 5000,
    });
  });

  it('fails to update a missing set', async () => {
    await expect(
      entorno.repositorios.sets.actualizar('no-existe', { nombre: 'X', materia: '', grupo: '' }),
    ).rejects.toBeInstanceOf(ErrorRegistroNoEncontrado);
  });

  it('soft-deletes a set and its questions in one go', async () => {
    const { repositorios, reloj, db } = entorno;
    const set = await repositorios.sets.crear({ nombre: 'Set', materia: '', grupo: '' });
    await repositorios.preguntas.crear(set.id, pregunta('Uno'));
    await repositorios.preguntas.crear(set.id, pregunta('Dos'));
    reloj.avanzar();

    await repositorios.sets.eliminar(set.id);

    expect(await repositorios.sets.obtener(set.id)).toBeUndefined();
    expect(await repositorios.preguntas.listarPorSet(set.id)).toEqual([]);
    // Tombstones stay in storage so a future sync can propagate the deletion.
    const tombstone = await db.sets.get(set.id);
    expect(tombstone?.eliminadoEn).toBe(reloj.ahora());
    expect(tombstone?.actualizadoEn).toBe(reloj.ahora());
    const preguntasGuardadas = await db.preguntas.where('setId').equals(set.id).toArray();
    expect(preguntasGuardadas.map((p) => p.eliminadoEn)).toEqual([reloj.ahora(), reloj.ahora()]);
  });

  it('duplicates a set with its questions under new ids', async () => {
    const { repositorios } = entorno;
    const original = await repositorios.sets.crear({
      nombre: 'Geografía',
      materia: 'Geografía',
      grupo: '1C',
    });
    await repositorios.preguntas.crear(original.id, pregunta('Capital de Francia', 'Europa'));
    const borrada = await repositorios.preguntas.crear(original.id, pregunta('Borrada'));
    await repositorios.preguntas.eliminar(borrada.id);

    const copia = await repositorios.sets.duplicar(original.id);

    expect(copia.id).not.toBe(original.id);
    expect(copia).toMatchObject({ nombre: 'Geografía (copia)', materia: 'Geografía', grupo: '1C' });
    const preguntasCopia = await repositorios.preguntas.listarPorSet(copia.id);
    expect(preguntasCopia.map((p) => p.texto)).toEqual(['Capital de Francia']);
    expect(preguntasCopia[0]?.setId).toBe(copia.id);
    const preguntasOriginal = await repositorios.preguntas.listarPorSet(original.id);
    expect(preguntasCopia[0]?.id).not.toBe(preguntasOriginal[0]?.id);
  });
});

describe('RepositorioPreguntas (Dexie)', () => {
  async function crearSet(nombre = 'Set') {
    return entorno.repositorios.sets.crear({ nombre, materia: '', grupo: '' });
  }

  it('creates a question with sorted answers and timestamps', async () => {
    const { repositorios, reloj } = entorno;
    const set = await crearSet();

    const creada = await repositorios.preguntas.crear(set.id, {
      texto: ' ¿Color favorito? ',
      tema: 'Arte',
      respuestas: [
        { texto: 'Verde', puntos: 10, sinonimos: [] },
        { texto: 'Azul', puntos: 50, sinonimos: ['Celeste'] },
      ],
    });

    expect(creada).toEqual({
      id: 'id-2',
      setId: set.id,
      texto: '¿Color favorito?',
      tema: 'Arte',
      respuestas: [
        { texto: 'Azul', puntos: 50, sinonimos: ['Celeste'] },
        { texto: 'Verde', puntos: 10, sinonimos: [] },
      ],
      creadoEn: reloj.ahora(),
      actualizadoEn: reloj.ahora(),
      eliminadoEn: null,
    });
  });

  it('refuses to create a question in a missing set', async () => {
    await expect(
      entorno.repositorios.preguntas.crear('no-existe', pregunta('Hola')),
    ).rejects.toBeInstanceOf(ErrorRegistroNoEncontrado);
  });

  it('lists questions of a set in creation order, hiding deleted ones', async () => {
    const { repositorios, reloj } = entorno;
    const set = await crearSet();
    const otro = await crearSet('Otro');
    await repositorios.preguntas.crear(set.id, pregunta('Primera'));
    reloj.avanzar();
    const segunda = await repositorios.preguntas.crear(set.id, pregunta('Segunda'));
    reloj.avanzar();
    await repositorios.preguntas.crear(set.id, pregunta('Tercera'));
    await repositorios.preguntas.crear(otro.id, pregunta('Ajena'));
    await repositorios.preguntas.eliminar(segunda.id);

    const textos = (await repositorios.preguntas.listarPorSet(set.id)).map((p) => p.texto);

    expect(textos).toEqual(['Primera', 'Tercera']);
    expect(await repositorios.preguntas.obtener(segunda.id)).toBeUndefined();
  });

  it('updates a question, keeping creadoEn', async () => {
    const { repositorios, reloj } = entorno;
    const set = await crearSet();
    const creada = await repositorios.preguntas.crear(set.id, pregunta('Antes'));
    reloj.avanzar(2000);

    const actualizada = await repositorios.preguntas.actualizar(
      creada.id,
      pregunta('Después', 'Nuevo tema', [5, 60]),
    );

    expect(actualizada).toMatchObject({
      texto: 'Después',
      tema: 'Nuevo tema',
      creadoEn: creada.creadoEn,
      actualizadoEn: creada.creadoEn + 2000,
    });
    expect(actualizada.respuestas.map((r) => r.puntos)).toEqual([60, 5]);
  });

  it('duplicates a question in the same set with a new id', async () => {
    const { repositorios } = entorno;
    const set = await crearSet();
    const original = await repositorios.preguntas.crear(set.id, pregunta('Original', 'Tema'));

    const copia = await repositorios.preguntas.duplicar(original.id);

    expect(copia.id).not.toBe(original.id);
    expect(copia).toMatchObject({
      setId: set.id,
      texto: 'Original',
      tema: 'Tema',
      respuestas: original.respuestas,
    });
    expect(await repositorios.preguntas.listarPorSet(set.id)).toHaveLength(2);
  });

  it('searches by text ignoring case and accents, and filters by tema', async () => {
    const { repositorios } = entorno;
    const set = await crearSet();
    const otro = await crearSet('Otro');
    await repositorios.preguntas.crear(set.id, pregunta('Menciona un PAÍS de Europa', 'Geografía'));
    await repositorios.preguntas.crear(set.id, pregunta('Menciona un río', 'Geografía'));
    await repositorios.preguntas.crear(set.id, pregunta('Un país de América', 'Historia'));
    await repositorios.preguntas.crear(otro.id, pregunta('Otro país', 'Geografía'));

    const porTexto = await repositorios.preguntas.buscar({ setId: set.id, texto: 'pais' });
    const porTema = await repositorios.preguntas.buscar({ setId: set.id, tema: 'Geografía' });
    const ambos = await repositorios.preguntas.buscar({
      setId: set.id,
      texto: 'PAIS',
      tema: 'Geografía',
    });
    const global = await repositorios.preguntas.buscar({ texto: 'país' });

    expect(porTexto.map((p) => p.texto)).toEqual([
      'Menciona un PAÍS de Europa',
      'Un país de América',
    ]);
    expect(porTema.map((p) => p.texto)).toEqual(['Menciona un PAÍS de Europa', 'Menciona un río']);
    expect(ambos.map((p) => p.texto)).toEqual(['Menciona un PAÍS de Europa']);
    expect(global).toHaveLength(3);
  });

  it('lists the distinct non-empty temas of a set, sorted', async () => {
    const { repositorios } = entorno;
    const set = await crearSet();
    await repositorios.preguntas.crear(set.id, pregunta('a', 'Historia'));
    await repositorios.preguntas.crear(set.id, pregunta('b', 'Arte'));
    await repositorios.preguntas.crear(set.id, pregunta('c', 'Historia'));
    await repositorios.preguntas.crear(set.id, pregunta('d', ''));
    const borrada = await repositorios.preguntas.crear(set.id, pregunta('e', 'Zoología'));
    await repositorios.preguntas.eliminar(borrada.id);

    expect(await repositorios.preguntas.listarTemas(set.id)).toEqual(['Arte', 'Historia']);
  });

  it('counts non-deleted questions per set', async () => {
    const { repositorios } = entorno;
    const a = await crearSet('A');
    const b = await crearSet('B');
    await repositorios.preguntas.crear(a.id, pregunta('1'));
    await repositorios.preguntas.crear(a.id, pregunta('2'));
    const borrada = await repositorios.preguntas.crear(b.id, pregunta('3'));
    await repositorios.preguntas.eliminar(borrada.id);

    expect(await repositorios.preguntas.contarPorSet()).toEqual({ [a.id]: 2 });
  });
});
