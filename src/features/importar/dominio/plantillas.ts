import { MAX_RESPUESTAS } from '@/shared/modelo';

export const NOMBRE_PLANTILLA_XLSX = 'plantilla-top-respuestas.xlsx';
export const NOMBRE_PLANTILLA_CSV = 'plantilla-top-respuestas.csv';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TIPO_CSV = 'text/csv;charset=utf-8';

/** Template header row: `Tema | Pregunta | R1 | Pts1 | … | R8 | Pts8 | Sinónimos`. */
export const ENCABEZADOS_PLANTILLA: readonly string[] = [
  'Tema',
  'Pregunta',
  ...Array.from({ length: MAX_RESPUESTAS }, (_, i) => [
    `R${String(i + 1)}`,
    `Pts${String(i + 1)}`,
  ]).flat(),
  'Sinónimos',
];

type CeldaPlantilla = string | number;

/** Builds a template row; missing answers are left blank. */
function filaEjemplo(
  tema: string,
  pregunta: string,
  respuestas: [string, number][],
  sinonimos: string,
): CeldaPlantilla[] {
  const columnasRespuestas = Array.from({ length: MAX_RESPUESTAS }, (_, i) => {
    const respuesta = respuestas[i];
    return respuesta ? [respuesta[0], respuesta[1]] : ['', ''];
  }).flat();
  return [tema, pregunta, ...columnasRespuestas, sinonimos];
}

/** Two example rows; the first one shows the synonyms format. */
export const FILAS_EJEMPLO_PLANTILLA: readonly CeldaPlantilla[][] = [
  filaEjemplo(
    'Escuela',
    'Menciona algo que llevas en la mochila',
    [
      ['Cuaderno', 30],
      ['Lápiz', 22],
      ['Libros', 15],
      ['Lonche', 12],
      ['Estuche', 9],
    ],
    'R1: libreta; R2: pluma, bolígrafo; R4: almuerzo',
  ),
  filaEjemplo(
    'Ciencias',
    'Menciona un planeta del sistema solar',
    [
      ['Tierra', 28],
      ['Marte', 25],
      ['Júpiter', 16],
      ['Saturno', 12],
      ['Venus', 8],
    ],
    '',
  ),
];

/** Excel template generated on the client, so it also works offline. */
export async function generarPlantillaXlsx(): Promise<Blob> {
  const XLSX = await import('xlsx');
  const hoja = XLSX.utils.aoa_to_sheet([[...ENCABEZADOS_PLANTILLA], ...FILAS_EJEMPLO_PLANTILLA]);
  hoja['!cols'] = ENCABEZADOS_PLANTILLA.map((encabezado) => ({
    wch:
      encabezado === 'Pregunta'
        ? 42
        : encabezado === 'Sinónimos'
          ? 44
          : encabezado.startsWith('Pts')
            ? 6
            : 14,
  }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Preguntas');
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([bytes], { type: TIPO_XLSX });
}

/** CSV template in UTF-8 with a BOM, so Excel opens it with accents intact. */
export async function generarPlantillaCsv(): Promise<Blob> {
  const { default: Papa } = await import('papaparse');
  const csv = Papa.unparse([[...ENCABEZADOS_PLANTILLA], ...FILAS_EJEMPLO_PLANTILLA], {
    newline: '\r\n',
  });
  return new Blob([new TextEncoder().encode(`\uFEFF${csv}\r\n`)], { type: TIPO_CSV });
}
