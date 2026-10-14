import { crearEstadoRonda } from '../estadoInicial';
import { aceptar, rechazar, type Procesado } from '../rechazos';
import type { ConfigPartida, EstadoJuego, EstadoRonda, Evento } from '../tipos';
import { conRonda } from './comun';
import { crearEstadoRondaFinal } from './rondaFinal';

function siguienteRonda(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
): EstadoJuego {
  const indice = ronda.indice + 1;
  if (indice < config.rondas.length) {
    return conRonda(estado, crearEstadoRonda(config, indice), 'caraACara');
  }
  if (config.rondaFinal !== null) {
    return {
      ...estado,
      fase: 'rondaFinal',
      ronda: null,
      rondaFinal: crearEstadoRondaFinal(estado.puntajes),
    };
  }
  return { ...estado, fase: 'juegoTerminado', ronda: null };
}

export function procesarFinDeRonda(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  evento: Evento,
): Procesado {
  switch (evento.tipo) {
    case 'REVELAR_TODAS': {
      if (ronda.respuestas.every((respuesta) => respuesta !== 'oculta')) {
        return rechazar('SIN_RESPUESTAS_OCULTAS');
      }
      // Shown on the board for closure only: the pot and scores do not change.
      const respuestas = ronda.respuestas.map((respuesta) =>
        respuesta === 'oculta' ? 'reveladaSinPuntos' : respuesta,
      );
      return aceptar(conRonda(estado, { ...ronda, respuestas }));
    }
    case 'SIGUIENTE_RONDA':
      return aceptar(siguienteRonda(config, estado, ronda));
    default:
      return rechazar('FASE_INVALIDA');
  }
}
