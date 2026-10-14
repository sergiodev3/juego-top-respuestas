import { utils, write } from 'xlsx';
import { describe, expect, it } from 'vitest';

import { decodificarTexto, ErrorLecturaArchivo, leerArchivo, leerCsv, leerXlsx } from './lectores';

function utf8(texto: string): ArrayBuffer {
  return new TextEncoder().encode(texto).buffer;
}

/** Single-byte encoding; valid for windows-1252 as long as the text only uses Latin-1 letters. */
function windows1252(texto: string): ArrayBuffer {
  return Uint8Array.from(texto, (caracter) => caracter.charCodeAt(0)).buffer;
}

function libroXlsx(filas: unknown[][]): ArrayBuffer {
  const libro = utils.book_new();
  utils.book_append_sheet(libro, utils.aoa_to_sheet(filas), 'Hoja1');
  return write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('decodificarTexto', () => {
  it('decodes UTF-8 and strips the BOM', () => {
    expect(decodificarTexto(utf8('\uFEFFGeografía,País'))).toBe('Geografía,País');
  });

  it('falls back to windows-1252 when the bytes are not valid UTF-8', () => {
    expect(decodificarTexto(windows1252('Geografía;Menciona un país;Año'))).toBe(
      'Geografía;Menciona un país;Año',
    );
  });
});

describe('leerCsv', () => {
  it('detects a comma delimiter and keeps quoted cells', async () => {
    const matriz = await leerCsv(utf8('Pregunta,R1,Pts1\r\n"Hola, mundo",A,10\r\n'));

    expect(matriz.slice(0, 2)).toEqual([
      ['Pregunta', 'R1', 'Pts1'],
      ['Hola, mundo', 'A', '10'],
    ]);
  });

  it('detects a semicolon delimiter (Excel in Spanish) and windows-1252 accents', async () => {
    const matriz = await leerCsv(
      windows1252('Tema;Pregunta;R1;Pts1\nGeografía;¿Qué país?;México;30'),
    );

    expect(matriz).toEqual([
      ['Tema', 'Pregunta', 'R1', 'Pts1'],
      ['Geografía', '¿Qué país?', 'México', '30'],
    ]);
  });
});

describe('leerXlsx', () => {
  it('reads the first sheet with raw values and Excel row positions', async () => {
    const matriz = await leerXlsx(
      libroXlsx([['Pregunta', 'R1', 'Pts1'], [], ['Menciona un color', 'Rojo', 40]]),
    );

    expect(matriz[0]).toEqual(['Pregunta', 'R1', 'Pts1']);
    expect(matriz[2]).toEqual(['Menciona un color', 'Rojo', 40]);
  });
});

describe('leerArchivo', () => {
  it('chooses the reader by extension, ignoring case', async () => {
    const csv = await leerArchivo('preguntas.CSV', utf8('Pregunta,R1,Pts1\nHola,A,1'));
    const xlsx = await leerArchivo('preguntas.xlsx', libroXlsx([['Pregunta'], ['Hola']]));

    expect(csv[1]).toEqual(['Hola', 'A', '1']);
    expect(xlsx).toEqual([['Pregunta'], ['Hola']]);
  });

  it('rejects unsupported file types with a friendly message', async () => {
    await expect(leerArchivo('preguntas.pdf', utf8('x'))).rejects.toThrow(
      new ErrorLecturaArchivo(
        'El archivo «preguntas.pdf» no es compatible. Usa un archivo .xlsx, .xls o .csv.',
      ),
    );
  });

  it('rejects empty files', async () => {
    await expect(leerArchivo('vacio.csv', new ArrayBuffer(0))).rejects.toThrow(
      'El archivo «vacio.csv» está vacío.',
    );
  });

  it('rejects spreadsheets it cannot open', async () => {
    await expect(leerArchivo('roto.xlsx', utf8('PK\u0003\u0004 no es un zip'))).rejects.toThrow(
      'No se pudo leer «roto.xlsx». Verifica que sea un archivo de Excel o CSV válido.',
    );
  });
});
