import { esFilaVacia, type FilaCruda } from './celdas';

/** File problem with a user-facing Spanish message. */
export class ErrorLecturaArchivo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorLecturaArchivo';
  }
}

export const EXTENSIONES_ADMITIDAS = ['.xlsx', '.xls', '.csv'] as const;

/**
 * Decodes CSV bytes. Tries strict UTF-8 first (stripping the BOM) and falls back to
 * windows-1252, which is what Excel on Windows usually writes for "CSV" files.
 */
export function decodificarTexto(bytes: ArrayBuffer): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  return texto.startsWith('\uFEFF') ? texto.slice(1) : texto;
}

/** Parses CSV bytes into a matrix of strings, auto-detecting `,` or `;` (and tabs). */
export async function leerCsv(bytes: ArrayBuffer): Promise<FilaCruda[]> {
  // Lazy-loaded so the parser only ships when the user imports a file.
  const { default: Papa } = await import('papaparse');
  const resultado = Papa.parse<string[]>(decodificarTexto(bytes), {
    delimiter: '',
    skipEmptyLines: false,
  });
  return resultado.data;
}

/**
 * Reads the first sheet of a workbook (.xlsx/.xls) as raw values. Row `i` of the matrix is
 * Excel row `i + 1`, so row numbers in error messages match what the user sees.
 */
export async function leerXlsx(bytes: ArrayBuffer): Promise<FilaCruda[]> {
  // Lazy-loaded: SheetJS is large and only needed while importing.
  const XLSX = await import('xlsx');
  const libro = XLSX.read(new Uint8Array(bytes), { type: 'array' });
  const [primeraHoja] = libro.SheetNames;
  const hoja = primeraHoja === undefined ? undefined : libro.Sheets[primeraHoja];
  if (!hoja) {
    return [];
  }
  return XLSX.utils.sheet_to_json<FilaCruda>(hoja, {
    header: 1,
    raw: true,
    blankrows: true,
    range: 0,
  });
}

function extension(nombre: string): string {
  const coincidencia = /\.[^.]+$/u.exec(nombre.trim().toLowerCase());
  return coincidencia ? coincidencia[0] : '';
}

/** True when the file name has an extension the importer understands. */
export function esArchivoAdmitido(nombre: string): boolean {
  return (EXTENSIONES_ADMITIDAS as readonly string[]).includes(extension(nombre));
}

/**
 * Reads an uploaded file into a raw matrix, choosing the reader by extension.
 * Rejects with `ErrorLecturaArchivo` for unsupported, empty or unreadable files.
 */
export async function leerArchivo(nombre: string, bytes: ArrayBuffer): Promise<FilaCruda[]> {
  if (!esArchivoAdmitido(nombre)) {
    throw new ErrorLecturaArchivo(
      `El archivo «${nombre}» no es compatible. Usa un archivo .xlsx, .xls o .csv.`,
    );
  }
  const vacio = new ErrorLecturaArchivo(`El archivo «${nombre}» está vacío.`);
  if (bytes.byteLength === 0) {
    throw vacio;
  }

  let matriz: FilaCruda[];
  try {
    matriz = extension(nombre) === '.csv' ? await leerCsv(bytes) : await leerXlsx(bytes);
  } catch {
    throw new ErrorLecturaArchivo(
      `No se pudo leer «${nombre}». Verifica que sea un archivo de Excel o CSV válido.`,
    );
  }
  if (matriz.every(esFilaVacia)) {
    throw vacio;
  }
  return matriz;
}
