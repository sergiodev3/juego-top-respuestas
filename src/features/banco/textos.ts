/** "1 pregunta" / "3 preguntas" */
export function textoCantidadPreguntas(cantidad: number): string {
  return cantidad === 1 ? '1 pregunta' : `${String(cantidad)} preguntas`;
}

/** "1 respuesta" / "5 respuestas" */
export function textoCantidadRespuestas(cantidad: number): string {
  return cantidad === 1 ? '1 respuesta' : `${String(cantidad)} respuestas`;
}
