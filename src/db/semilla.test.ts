import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { esquemaDatosPregunta, ordenarRespuestas } from '@/shared/modelo';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { aplicarSemillaSiHaceFalta, NOMBRE_SET_EJEMPLO, PREGUNTAS_EJEMPLO } from './semilla';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

describe('aplicarSemillaSiHaceFalta', () => {
  it('creates the sample set with 10 questions on first run', async () => {
    const { db, repositorios } = entorno;

    const aplicada = await aplicarSemillaSiHaceFalta(db);

    expect(aplicada).toBe(true);
    const sets = await repositorios.sets.listar();
    expect(sets.map((s) => s.nombre)).toEqual(['Cultura general escolar']);
    expect(sets[0]).toMatchObject({ materia: 'Cultura general', grupo: '' });
    const preguntas = await repositorios.preguntas.listarPorSet(sets[0]?.id ?? '');
    expect(preguntas).toHaveLength(10);
    expect(preguntas.map((p) => p.texto)).toEqual(PREGUNTAS_EJEMPLO.map((p) => p.texto));
  });

  it('runs only once', async () => {
    const { db, repositorios } = entorno;
    await aplicarSemillaSiHaceFalta(db);

    const segunda = await aplicarSemillaSiHaceFalta(db);

    expect(segunda).toBe(false);
    expect(await repositorios.sets.listar()).toHaveLength(1);
  });

  it('does not bring the sample set back after the user deletes it', async () => {
    const { db, repositorios } = entorno;
    await aplicarSemillaSiHaceFalta(db);
    const [ejemplo] = await repositorios.sets.listar();
    await repositorios.sets.eliminar(ejemplo?.id ?? '');

    await aplicarSemillaSiHaceFalta(db);

    expect(await repositorios.sets.listar()).toEqual([]);
  });
});

describe('PREGUNTAS_EJEMPLO', () => {
  it('is valid, already sorted and looks like survey results', () => {
    expect(NOMBRE_SET_EJEMPLO).toBe('Cultura general escolar');
    expect(PREGUNTAS_EJEMPLO).toHaveLength(10);
    for (const pregunta of PREGUNTAS_EJEMPLO) {
      expect(esquemaDatosPregunta.parse(pregunta)).toEqual(pregunta);
      expect(pregunta.respuestas).toEqual(ordenarRespuestas(pregunta.respuestas));
      expect(pregunta.respuestas.length).toBeGreaterThanOrEqual(4);
      const total = pregunta.respuestas.reduce((suma, r) => suma + r.puntos, 0);
      expect(total).toBeGreaterThanOrEqual(90);
      expect(total).toBeLessThanOrEqual(100);
    }
    expect(PREGUNTAS_EJEMPLO.some((p) => p.respuestas.some((r) => r.sinonimos.length > 0))).toBe(
      true,
    );
  });
});
