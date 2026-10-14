import { aceptar, esIndiceEquipo, rechazar, type Procesado } from '../rechazos';
import type { ConfigPartida, EstadoJuego, EstadoRonda, Evento } from '../tipos';
import { conRonda, otorgarRonda, revelar, verificarRespuestaOculta } from './comun';

export function procesarRobo(
  config: ConfigPartida,
  estado: EstadoJuego,
  ronda: EstadoRonda,
  evento: Evento,
): Procesado {
  const control = ronda.equipoControl ?? 0;
  switch (evento.tipo) {
    case 'ASIGNAR_TURNO': {
      if (!esIndiceEquipo(config, evento.equipo)) {
        return rechazar('EQUIPO_INVALIDO');
      }
      if (evento.equipo === control) {
        return rechazar('EQUIPO_INVALIDO', 'El equipo que tiene el control no puede robar.');
      }
      return aceptar(conRonda(estado, { ...ronda, equipoRobo: evento.equipo }));
    }
    case 'ROBO_EXITOSO': {
      if (ronda.equipoRobo === null) {
        return rechazar('SIN_EQUIPO_ROBO');
      }
      const rechazo = verificarRespuestaOculta(ronda, evento.indice);
      if (rechazo !== null) {
        return rechazo;
      }
      const revelada = revelar(config, ronda, evento.indice);
      return aceptar(otorgarRonda(config, estado, revelada, ronda.equipoRobo));
    }
    case 'ROBO_FALLIDO': {
      if (ronda.equipoRobo === null) {
        return rechazar('SIN_EQUIPO_ROBO');
      }
      return aceptar(otorgarRonda(config, estado, ronda, control));
    }
    default:
      return rechazar('FASE_INVALIDA');
  }
}
