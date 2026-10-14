/** Lowercases and strips diacritics so searches ignore case and accents ("País" -> "pais"). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim();
}

/** True when `texto` contains `busqueda`, ignoring case and accents. An empty search matches. */
export function contieneTexto(texto: string, busqueda: string): boolean {
  return normalizarTexto(texto).includes(normalizarTexto(busqueda));
}
