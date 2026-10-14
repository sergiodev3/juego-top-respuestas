import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DatosPregunta } from '@/shared/modelo';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { ErrorRegistroNoEncontrado } from './repositorios';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

function pregunta(texto: string): DatosPregunta {
  return {
    texto,
    tema: 'Tema',
    respuestas: [
      { texto: 'A', puntos: 30, sinonimos: ['a1'] },
      { texto: 'B', puntos: 20, sinonimos: [] },
    ],
  };
}

const CINCO = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].map(pregunta);

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

describe('ServicioImportacion (Dexie)', () => {
  it('creates a new set and inserts the questions in file order', async () => {
    const { repositorios } = entorno;

    const { set, preguntas } = await repositorios.importacion.importarPreguntas(
      { tipo: 'nuevo', datos: { nombre: ' Repaso ', materia: '', grupo: '' } },
      CINCO.slice(0, 3),
    );

    expect(set.nombre).toBe('Repaso');
    expect(preguntas).toHaveLength(3);
    expect((await repositorios.preguntas.listarPorSet(set.id)).map((p) => p.texto)).toEqual([
      'Uno',
      'Dos',
      'Tres',
    ]);
    expect((await repositorios.preguntas.obtener(preguntas[0]?.id ?? ''))?.respuestas).toEqual(
      pregunta('Uno').respuestas,
    );
  });

  it('adds questions to an existing set after the ones it already has', async () => {
    const { repositorios, reloj } = entorno;
    const set = await repositorios.sets.crear({ nombre: 'Existente', materia: '', grupo: '' });
    await repositorios.preguntas.crear(set.id, pregunta('Previa'));
    reloj.avanzar();

    await repositorios.importacion.importarPreguntas(
      { tipo: 'existente', setId: set.id },
      CINCO.slice(0, 2),
    );

    expect((await repositorios.preguntas.listarPorSet(set.id)).map((p) => p.texto)).toEqual([
      'Previa',
      'Uno',
      'Dos',
    ]);
    expect(await repositorios.sets.listar()).toHaveLength(1);
  });

  it('fails without writing anything when the existing set is gone', async () => {
    const { repositorios } = entorno;

    await expect(
      repositorios.importacion.importarPreguntas({ tipo: 'existente', setId: 'no-existe' }, CINCO),
    ).rejects.toBeInstanceOf(ErrorRegistroNoEncontrado);
    expect(await repositorios.preguntas.buscar({})).toEqual([]);
  });

  it('rejects an empty import and invalid questions before writing', async () => {
    const { repositorios } = entorno;
    const destino = { tipo: 'nuevo', datos: { nombre: 'Set', materia: '', grupo: '' } } as const;

    await expect(repositorios.importacion.importarPreguntas(destino, [])).rejects.toThrow(
      'No hay preguntas válidas para importar.',
    );
    await expect(
      repositorios.importacion.importarPreguntas(destino, [{ ...pregunta('x'), respuestas: [] }]),
    ).rejects.toThrow('Agrega al menos una respuesta.');
    expect(await repositorios.sets.listar()).toEqual([]);
  });

  it('importarYJugar creates the set, the questions and a default game with the first 4', async () => {
    const { repositorios } = entorno;

    const { set, preguntas, juego } = await repositorios.importacion.importarYJugar(
      { nombre: 'Repaso 2B', materia: '', grupo: '' },
      CINCO,
    );

    expect(preguntas).toHaveLength(5);
    expect(juego.nombre).toBe('Repaso 2B');
    expect(juego.rondas).toEqual([
      { preguntaId: preguntas[0]?.id, multiplicador: 1 },
      { preguntaId: preguntas[1]?.id, multiplicador: 1 },
      { preguntaId: preguntas[2]?.id, multiplicador: 2 },
      { preguntaId: preguntas[3]?.id, multiplicador: 3 },
    ]);
    expect(await repositorios.juegos.obtener(juego.id)).toEqual(juego);
    expect(await repositorios.sets.obtener(set.id)).toEqual(set);
  });
});
