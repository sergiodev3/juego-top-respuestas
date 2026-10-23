import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RESPALDO, VERSION_RESPALDO, type DatosPregunta, type Respaldo } from '@/shared/modelo';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

import { ErrorRespaldoInvalido } from './repositorios';

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

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

/** A set with two questions, a game using them and a partida started from it. */
async function sembrar(destino: Entorno) {
  const { repositorios } = destino;
  const set = await repositorios.sets.crear({
    nombre: 'Historia',
    materia: 'Sociales',
    grupo: '3A',
  });
  const uno = await repositorios.preguntas.crear(set.id, pregunta('Uno'));
  const dos = await repositorios.preguntas.crear(set.id, pregunta('Dos'));
  const juego = await repositorios.juegos.crear({
    nombre: 'Juego',
    equipos: [
      { id: 'equipo-1', nombre: 'Equipo A', color: '#1d4ed8' },
      { id: 'equipo-2', nombre: 'Equipo B', color: '#b91c1c' },
    ],
    reglas: {
      tachasMaximas: 3,
      rondaFinal: { activa: false, preguntaIds: [], segundos: [20, 25], meta: 200 },
    },
    rondas: [
      { preguntaId: uno.id, multiplicador: 1 },
      { preguntaId: dos.id, multiplicador: 1 },
    ],
  });
  const partida = await repositorios.partidas.crear({ juegoId: juego.id, config: configPrueba() });
  return { set, uno, dos, juego, partida };
}

describe('ServicioRespaldos.exportar (Dexie)', () => {
  it('exports every live record with the file identity and skips soft-deleted ones', async () => {
    const { repositorios, reloj } = entorno;
    const { set, uno, dos, juego, partida } = await sembrar(entorno);
    await repositorios.preguntas.eliminar(dos.id);
    const otro = await repositorios.sets.crear({ nombre: 'Borrado', materia: '', grupo: '' });
    await repositorios.sets.eliminar(otro.id);
    reloj.avanzar();

    const respaldo = await repositorios.respaldos.exportar();

    expect(respaldo.app).toBe(APP_RESPALDO);
    expect(respaldo.version).toBe(VERSION_RESPALDO);
    expect(respaldo.exportadoEn).toBe(reloj.ahora());
    expect(respaldo.datos.sets.map((s) => s.id)).toEqual([set.id]);
    expect(respaldo.datos.preguntas.map((p) => p.id)).toEqual([uno.id]);
    expect(respaldo.datos.juegos.map((j) => j.id)).toEqual([juego.id]);
    expect(respaldo.datos.partidas.map((p) => p.id)).toEqual([partida.id]);
  });

  it('exports an empty database as an empty backup', async () => {
    const respaldo = await entorno.repositorios.respaldos.exportar();

    expect(respaldo.datos).toEqual({ sets: [], preguntas: [], juegos: [], partidas: [] });
  });
});

describe('ServicioRespaldos.restaurar (Dexie)', () => {
  it('restores an export into an empty database, whichever the mode', async () => {
    const origen = crearEntornoPrueba();
    await sembrar(origen);
    const respaldo = await origen.repositorios.respaldos.exportar();
    origen.db.close();

    for (const modo of ['combinar', 'reemplazar'] as const) {
      const destino = crearEntornoPrueba();
      const resumen = await destino.repositorios.respaldos.restaurar(respaldo, modo);

      expect(resumen).toEqual({
        modo,
        sets: { agregados: 1, actualizados: 0, sinCambios: 0 },
        preguntas: { agregados: 2, actualizados: 0, sinCambios: 0 },
        juegos: { agregados: 1, actualizados: 0, sinCambios: 0 },
        partidas: { agregados: 1, actualizados: 0, sinCambios: 0 },
      });
      expect((await destino.repositorios.respaldos.exportar()).datos).toEqual(respaldo.datos);
      destino.db.close();
    }
  });

  it('replace wipes what is not in the file and keeps the bookkeeping table', async () => {
    const { repositorios, db } = entorno;
    const origen = crearEntornoPrueba();
    await sembrar(origen);
    const respaldo = await origen.repositorios.respaldos.exportar();
    origen.db.close();
    // Local data that the file does not have, plus a seed flag.
    const local = await repositorios.sets.crear({ nombre: 'Local', materia: '', grupo: '' });
    await db.meta.put({ clave: 'semillaAplicada', valor: true });

    await repositorios.respaldos.restaurar(respaldo, 'reemplazar');

    const despues = await repositorios.respaldos.exportar();
    expect(despues.datos).toEqual(respaldo.datos);
    expect((await db.sets.toArray()).map((set) => set.nombre)).not.toContain(local.nombre);
    expect((await db.meta.get('semillaAplicada'))?.valor).toBe(true);
  });

  it('merge keeps local-only records, adds missing ones and lets the newer copy win', async () => {
    const { repositorios, reloj } = entorno;
    const { set, uno, dos } = await sembrar(entorno);
    const base = await repositorios.respaldos.exportar();

    // After the backup: "Dos" is edited locally and a new question is added locally.
    reloj.avanzar(10_000);
    await repositorios.preguntas.actualizar(dos.id, pregunta('Dos local'));
    await repositorios.preguntas.crear(set.id, pregunta('Solo local'));
    const archivo: Respaldo = {
      ...base,
      datos: {
        ...base.datos,
        preguntas: [
          ...base.datos.preguntas,
          // Only in the file.
          { ...uno, id: 'solo-archivo', texto: 'Solo en el archivo' },
        ],
      },
    };

    const resumen = await repositorios.respaldos.restaurar(archivo, 'combinar');

    // "Uno" is identical, "Dos" is older in the file, "solo-archivo" is new.
    expect(resumen.preguntas).toEqual({ agregados: 1, actualizados: 0, sinCambios: 2 });
    const textos = (await repositorios.preguntas.listarPorSet(set.id)).map((p) => p.texto);
    expect(textos).toContain('Dos local');
    expect(textos).toContain('Solo local');
    expect(textos).toContain('Solo en el archivo');

    // A copy of "Uno" edited after the local one replaces it.
    const editada = { ...uno, texto: 'Uno del archivo', actualizadoEn: reloj.ahora() + 5000 };
    const resumen2 = await repositorios.respaldos.restaurar(
      { ...archivo, datos: { ...archivo.datos, preguntas: [editada] } },
      'combinar',
    );
    expect(resumen2.preguntas).toEqual({ agregados: 0, actualizados: 1, sinCambios: 0 });
    expect((await repositorios.preguntas.obtener(uno.id))?.texto).toBe('Uno del archivo');
  });

  it('merge does not bring back a record that was deleted locally after the backup', async () => {
    const { repositorios, reloj } = entorno;
    const { dos } = await sembrar(entorno);
    const archivo = await repositorios.respaldos.exportar();
    reloj.avanzar(10_000);
    await repositorios.preguntas.eliminar(dos.id);

    const resumen = await repositorios.respaldos.restaurar(archivo, 'combinar');

    expect(resumen.preguntas).toEqual({ agregados: 0, actualizados: 0, sinCambios: 2 });
    expect(await repositorios.preguntas.obtener(dos.id)).toBeUndefined();
  });

  it('rejects an inconsistent file without touching the data, even when replacing', async () => {
    const { repositorios } = entorno;
    const { uno } = await sembrar(entorno);
    const antes = await repositorios.respaldos.exportar();
    const huerfana: Respaldo = {
      ...antes,
      datos: {
        ...antes.datos,
        sets: [],
        preguntas: [{ ...uno, setId: 'no-existe' }],
      },
    };

    await expect(repositorios.respaldos.restaurar(huerfana, 'reemplazar')).rejects.toBeInstanceOf(
      ErrorRespaldoInvalido,
    );
    expect((await repositorios.respaldos.exportar()).datos).toEqual(antes.datos);
  });

  it('rejects a file whose records do not match the schemas', async () => {
    const { repositorios } = entorno;
    await sembrar(entorno);
    const antes = await repositorios.respaldos.exportar();
    const roto = {
      ...antes,
      datos: { ...antes.datos, sets: [{ id: 'x' }] },
    } as unknown as Respaldo;

    await expect(repositorios.respaldos.restaurar(roto, 'reemplazar')).rejects.toBeDefined();
    expect((await repositorios.respaldos.exportar()).datos).toEqual(antes.datos);
  });
});
