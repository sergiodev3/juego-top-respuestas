import type { ConfigPartida, EstadoJuego, EstadoRonda, PreguntaSnapshot } from './tipos';

export const MIN_EQUIPOS = 2;
export const MAX_EQUIPOS = 4;
export const PREGUNTAS_RONDA_FINAL = 5;

function erroresPregunta(pregunta: PreguntaSnapshot, etiqueta: string): string[] {
  const errores: string[] = [];
  if (pregunta.respuestas.length === 0) {
    errores.push(`${etiqueta} no tiene respuestas.`);
  }
  pregunta.respuestas.forEach((respuesta, indice) => {
    if (!Number.isInteger(respuesta.puntos) || respuesta.puntos < 0) {
      errores.push(`${etiqueta}: los puntos deben ser enteros mayores o iguales a 0.`);
    }
    const anterior = pregunta.respuestas[indice - 1];
    if (anterior !== undefined && anterior.puntos < respuesta.puntos) {
      errores.push(`${etiqueta}: las respuestas deben estar ordenadas por puntos.`);
    }
  });
  return errores;
}

/**
 * Checks the structural rules of a config snapshot and returns Spanish messages
 * (empty when the config is valid).
 */
export function validarConfig(config: ConfigPartida): string[] {
  const errores: string[] = [];
  if (config.equipos.length < MIN_EQUIPOS || config.equipos.length > MAX_EQUIPOS) {
    errores.push(
      `La partida necesita entre ${String(MIN_EQUIPOS)} y ${String(MAX_EQUIPOS)} equipos.`,
    );
  }
  if (config.rondas.length === 0) {
    errores.push('La partida necesita al menos una ronda.');
  }
  if (!Number.isInteger(config.tachasMaximas) || config.tachasMaximas < 1) {
    errores.push('Las tachas máximas deben ser un entero mayor o igual a 1.');
  }
  config.rondas.forEach((ronda, indice) => {
    const etiqueta = `La pregunta de la ronda ${String(indice + 1)}`;
    if (![1, 2, 3].includes(ronda.multiplicador)) {
      errores.push(`El multiplicador de la ronda ${String(indice + 1)} debe ser x1, x2 o x3.`);
    }
    errores.push(...erroresPregunta(ronda.pregunta, etiqueta));
  });
  if (config.rondaFinal !== null) {
    if (config.rondaFinal.preguntas.length !== PREGUNTAS_RONDA_FINAL) {
      errores.push(
        `La ronda final necesita exactamente ${String(PREGUNTAS_RONDA_FINAL)} preguntas.`,
      );
    }
    config.rondaFinal.preguntas.forEach((pregunta, indice) => {
      errores.push(
        ...erroresPregunta(pregunta, `La pregunta ${String(indice + 1)} de la ronda final`),
      );
    });
  }
  return errores;
}

export function crearEstadoRonda(config: ConfigPartida, indice: number): EstadoRonda {
  const ronda = config.rondas[indice];
  return {
    indice,
    respuestas: (ronda?.pregunta.respuestas ?? []).map(() => 'oculta'),
    bolsa: 0,
    tachas: 0,
    caraACara: { intentos: [], respondedor: null, ganador: null },
    equipoControl: null,
    equipoRobo: null,
    ganador: null,
    puntosOtorgados: null,
  };
}

/** Initial state: round 1 face-off, every score at 0. Throws for an invalid config. */
export function crearEstadoInicial(config: ConfigPartida): EstadoJuego {
  const errores = validarConfig(config);
  if (errores.length > 0) {
    throw new Error(`Configuración de partida inválida: ${errores.join(' ')}`);
  }
  return {
    fase: 'caraACara',
    puntajes: config.equipos.map(() => 0),
    ronda: crearEstadoRonda(config, 0),
    rondaFinal: null,
    advertencias: [],
  };
}
