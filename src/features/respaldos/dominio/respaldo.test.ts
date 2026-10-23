import { describe, expect, it } from 'vitest';

import { APP_RESPALDO, VERSION_RESPALDO, type Respaldo } from '@/shared/modelo';
import { configPrueba, preguntaBancoPrueba } from '@/test/fabricasPartida';

import {
  leerRespaldo,
  nombreArchivoRespaldo,
  resumenRespaldo,
  serializarRespaldo,
  textoResultadoRestauracion,
} from './respaldo';

function respaldoPrueba(cambios: Partial<Respaldo['datos']> = {}): Respaldo {
  return {
    app: APP_RESPALDO,
    version: VERSION_RESPALDO,
    exportadoEn: 1_700_000_000_000,
    datos: {
      sets: [
        {
          id: 'set-1',
          nombre: 'Historia',
          materia: '',
          grupo: '',
          creadoEn: 1,
          actualizadoEn: 1,
          eliminadoEn: null,
        },
      ],
      preguntas: [
        { ...preguntaBancoPrueba('p-1'), creadoEn: 1, actualizadoEn: 1, eliminadoEn: null },
        { ...preguntaBancoPrueba('p-2'), creadoEn: 2, actualizadoEn: 2, eliminadoEn: null },
      ],
      juegos: [],
      partidas: [
        {
          id: 'partida-1',
          juegoId: 'juego-1',
          config: configPrueba(),
          eventos: [],
          estado: 'enCurso',
          creadoEn: 1,
          actualizadoEn: 1,
          eliminadoEn: null,
        },
      ],
      ...cambios,
    },
  };
}

describe('leerRespaldo', () => {
  it('reads what serializarRespaldo writes, byte for byte', () => {
    const respaldo = respaldoPrueba();

    const resultado = leerRespaldo(serializarRespaldo(respaldo));

    expect(resultado).toEqual({ ok: true, respaldo });
  });

  it('accepts a file with a UTF-8 BOM (editors and Excel add one)', () => {
    const resultado = leerRespaldo(`\uFEFF${serializarRespaldo(respaldoPrueba())}`);

    expect(resultado.ok).toBe(true);
  });

  it('rejects text that is not JSON', () => {
    expect(leerRespaldo('esto no es json')).toEqual({
      ok: false,
      errores: ['El archivo no es un respaldo: no se pudo leer como JSON.'],
    });
  });

  it('rejects JSON that is not a Top Respuestas backup', () => {
    for (const texto of ['[]', '42', 'null', '{"app":"otra-app","version":1}', '{"nombre":"x"}']) {
      expect(leerRespaldo(texto)).toEqual({
        ok: false,
        errores: ['Este archivo no es un respaldo de Top Respuestas.'],
      });
    }
  });

  it('rejects a backup written by a newer version of the app', () => {
    const texto = JSON.stringify({ ...respaldoPrueba(), version: VERSION_RESPALDO + 1 });

    expect(leerRespaldo(texto)).toEqual({
      ok: false,
      errores: [
        'Este respaldo es de una versión más nueva de la app. Actualiza la app para poder restaurarlo.',
      ],
    });
  });

  it('points at the damaged field when a record does not match the schemas', () => {
    const roto = respaldoPrueba();
    const texto = JSON.stringify({
      ...roto,
      datos: { ...roto.datos, sets: [{ ...roto.datos.sets[0], nombre: '' }] },
    });

    const resultado = leerRespaldo(texto);

    expect(resultado).toEqual({
      ok: false,
      errores: ['El respaldo está dañado o incompleto (datos.sets.0.nombre).'],
    });
  });

  it('reports a missing table as damaged', () => {
    const sinPartidas: Partial<Respaldo['datos']> = { ...respaldoPrueba().datos };
    delete sinPartidas.partidas;
    const texto = JSON.stringify({ ...respaldoPrueba(), datos: sinPartidas });

    expect(leerRespaldo(texto)).toEqual({
      ok: false,
      errores: ['El respaldo está dañado o incompleto (datos.partidas).'],
    });
  });

  it('reports questions whose set is not in the file', () => {
    const texto = serializarRespaldo(respaldoPrueba({ sets: [] }));

    expect(leerRespaldo(texto)).toEqual({
      ok: false,
      errores: ['Hay 2 preguntas que pertenecen a un set que no está en el respaldo.'],
    });
  });

  it('reports repeated ids within a table', () => {
    const respaldo = respaldoPrueba();
    const texto = serializarRespaldo(
      respaldoPrueba({ sets: [...respaldo.datos.sets, ...respaldo.datos.sets] }),
    );

    expect(leerRespaldo(texto)).toEqual({
      ok: false,
      errores: ['El respaldo repite registros en «sets».'],
    });
  });

  it('never throws on odd input', () => {
    for (const texto of ['', '   ', '{', '"texto"', '{"app":"top-respuestas"}']) {
      expect(leerRespaldo(texto).ok).toBe(false);
    }
  });
});

describe('resumenRespaldo', () => {
  it('counts every table', () => {
    expect(resumenRespaldo(respaldoPrueba())).toEqual({
      exportadoEn: 1_700_000_000_000,
      sets: 1,
      preguntas: 2,
      juegos: 0,
      partidas: 1,
    });
  });
});

describe('nombreArchivoRespaldo', () => {
  it('names the file after the local date', () => {
    const fecha = new Date(2026, 9, 5, 14, 30).getTime();

    expect(nombreArchivoRespaldo(fecha)).toBe('top-respuestas-respaldo-2026-10-05.json');
  });
});

describe('textoResultadoRestauracion', () => {
  const vacio = { agregados: 0, actualizados: 0, sinCambios: 0 };

  it('describes a replace as what was loaded', () => {
    const texto = textoResultadoRestauracion({
      modo: 'reemplazar',
      sets: { ...vacio, agregados: 1 },
      preguntas: { ...vacio, agregados: 10 },
      juegos: { ...vacio, agregados: 2 },
      partidas: vacio,
    });

    expect(texto).toBe(
      'Listo: se reemplazaron tus datos con el respaldo (1 set, 10 preguntas, 2 juegos, 0 partidas).',
    );
  });

  it('describes a merge with added, updated and unchanged records', () => {
    const texto = textoResultadoRestauracion({
      modo: 'combinar',
      sets: { agregados: 1, actualizados: 0, sinCambios: 2 },
      preguntas: { agregados: 5, actualizados: 1, sinCambios: 4 },
      juegos: vacio,
      partidas: { agregados: 0, actualizados: 0, sinCambios: 1 },
    });

    expect(texto).toBe(
      'Listo: se combinó el respaldo con tus datos. Nuevos: 6. Actualizados: 1. Sin cambios: 7.',
    );
  });
});
