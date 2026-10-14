import { describe, expect, it } from 'vitest';

import { leerArchivo } from './lectores';
import {
  ENCABEZADOS_PLANTILLA,
  generarPlantillaCsv,
  generarPlantillaXlsx,
  NOMBRE_PLANTILLA_CSV,
  NOMBRE_PLANTILLA_XLSX,
} from './plantillas';
import { validarFilas } from './validarFilas';

async function reimportar(nombre: string, plantilla: Blob) {
  const matriz = await leerArchivo(nombre, await plantilla.arrayBuffer());
  const resultado = validarFilas(matriz);
  if (!resultado.ok) {
    throw new Error(resultado.error);
  }
  return { matriz, filas: resultado.filas };
}

describe('plantillas', () => {
  it('lists Tema, Pregunta, R1..R8 with their points and Sinónimos', () => {
    expect(ENCABEZADOS_PLANTILLA).toEqual([
      'Tema',
      'Pregunta',
      'R1',
      'Pts1',
      'R2',
      'Pts2',
      'R3',
      'Pts3',
      'R4',
      'Pts4',
      'R5',
      'Pts5',
      'R6',
      'Pts6',
      'R7',
      'Pts7',
      'R8',
      'Pts8',
      'Sinónimos',
    ]);
  });

  it('round-trips the .xlsx template with zero errors and synonyms on the right answer', async () => {
    const { matriz, filas } = await reimportar(NOMBRE_PLANTILLA_XLSX, await generarPlantillaXlsx());

    expect(matriz[0]).toEqual(ENCABEZADOS_PLANTILLA);
    expect(filas).toHaveLength(2);
    expect(filas.flatMap((fila) => fila.errores)).toEqual([]);
    const conSinonimos = filas.find(
      (fila) =>
        fila.estado === 'valida' && fila.pregunta.respuestas.some((r) => r.sinonimos.length > 0),
    );
    expect(conSinonimos?.estado === 'valida' && conSinonimos.pregunta.respuestas[0]).toEqual({
      texto: 'Cuaderno',
      puntos: 30,
      sinonimos: ['libreta'],
    });
  });

  it('round-trips the .csv template with zero errors and keeps accents', async () => {
    const plantilla = await generarPlantillaCsv();
    const { filas } = await reimportar(NOMBRE_PLANTILLA_CSV, plantilla);

    expect(filas).toHaveLength(2);
    expect(filas.every((fila) => fila.estado === 'valida')).toBe(true);
    expect(filas.map((fila) => fila.texto)).toContain('Menciona un planeta del sistema solar');
    expect(filas.map((fila) => fila.tema)).toContain('Ciencias');
    expect(JSON.stringify(filas)).toContain('Júpiter');
  });

  it('writes the CSV template as UTF-8 with a BOM so Excel shows accents', async () => {
    const bytes = new Uint8Array(await (await generarPlantillaCsv()).arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
