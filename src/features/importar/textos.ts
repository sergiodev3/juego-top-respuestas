function plural(cantidad: number, singular: string, plural: string): string {
  return `${String(cantidad)} ${cantidad === 1 ? singular : plural}`;
}

/** "1 pregunta" / "3 preguntas" */
export function textoPreguntas(cantidad: number): string {
  return plural(cantidad, 'pregunta', 'preguntas');
}

/** "1 válida" / "3 válidas" */
export function textoValidas(cantidad: number): string {
  return plural(cantidad, 'válida', 'válidas');
}

/** "1 con error" / "3 con errores" */
export function textoConErrores(cantidad: number): string {
  return plural(cantidad, 'con error', 'con errores');
}

/** "1 con advertencia" / "3 con advertencias" */
export function textoConAdvertencias(cantidad: number): string {
  return plural(cantidad, 'con advertencia', 'con advertencias');
}
