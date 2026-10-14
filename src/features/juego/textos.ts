/** "1 pregunta" / "3 preguntas" */
export function textoPreguntas(cantidad: number): string {
  return cantidad === 1 ? '1 pregunta' : `${String(cantidad)} preguntas`;
}

/** "1 ronda" / "4 rondas" */
export function textoRondas(cantidad: number): string {
  return cantidad === 1 ? '1 ronda' : `${String(cantidad)} rondas`;
}
