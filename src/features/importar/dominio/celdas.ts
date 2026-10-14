/** A raw spreadsheet cell as returned by the readers (SheetJS raw values or CSV strings). */
export type Celda = unknown;

/** A raw spreadsheet row. */
export type FilaCruda = readonly Celda[];

/** Trimmed text of a cell; blank for `null`, `undefined` and non-finite numbers. */
export function textoCelda(celda: Celda): string {
  if (celda === null || celda === undefined) {
    return '';
  }
  if (typeof celda === 'string') {
    return celda.trim();
  }
  if (typeof celda === 'number') {
    return Number.isFinite(celda) ? String(celda) : '';
  }
  if (typeof celda === 'boolean' || typeof celda === 'bigint') {
    return String(celda);
  }
  if (celda instanceof Date) {
    return Number.isNaN(celda.getTime()) ? '' : celda.toISOString();
  }
  return '';
}

/** True when every cell of the row is blank. */
export function esFilaVacia(fila: FilaCruda): boolean {
  return fila.every((celda) => textoCelda(celda) === '');
}
