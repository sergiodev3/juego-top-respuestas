import { aceptar, rechazar, type Procesado } from '../rechazos';
import type { ConfigPartida, EstadoJuego, EstadoRonda, Evento } from '../tipos';
import { conRonda, otorgarRonda, revelar, verificarRespuestaOculta } from './comun';

export function procesarEnJuego(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  evento: Evento,
): Procesado {
  const control = ronda.equipoControl ?? 0;
  switch (evento.tipo) {
    case 'REVELAR': {
      const rechazo = verificarRespuestaOculta(ronda, evento.indice);
      if (rechazo !== null) {
        return rechazo;
      }
      const revelada = revelar(config, ronda, evento.indice);
      if (revelada.respuestas.every((respuesta) => respuesta !== 'oculta')) {
        return aceptar(otorgarRonda(config, estado, revelada, control));
      }
      return aceptar(conRonda(estado, revelada));
    }
    case 'TACHE': {
      const tachas = ronda.tachas + 1;
      if (tachas < config.tachasMaximas) {
        return aceptar(conRonda(estado, { ...ronda, tachas }));
      }
      // With 2 teams the other team steals; with 3-4 the host assigns it with ASIGNAR_TURNO.
      const equipoRobo = config.equipos.length === 2 ? 1 - control : null;
      return aceptar(conRonda(estado, { ...ronda, tachas, equipoRobo }, 'robo'));
    }
    default:
      return rechazar('FASE_INVALIDA');
  }
}
