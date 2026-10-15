import { describe, expect, it } from 'vitest';

import type { Fase } from '@/engine';

import { comandoDeTecla, type ContextoAtajos } from './atajos';

function contexto(fase: Fase, cambios: Partial<ContextoAtajos> = {}): ContextoAtajos {
  return { fase, respuestas: 5, equipos: 2, jugarHabilitado: false, ...cambios };
}

const FASES_DE_RONDA: Fase[] = ['caraACara', 'enJuego', 'robo', 'finDeRonda'];

describe('comandoDeTecla', () => {
  it('reveals answer N with the digits 1 to 8, only for answers that exist', () => {
    expect(comandoDeTecla('1', contexto('enJuego'))).toEqual({ tipo: 'revelar', indice: 0 });
    expect(comandoDeTecla('5', contexto('caraACara'))).toEqual({ tipo: 'revelar', indice: 4 });
    expect(comandoDeTecla('3', contexto('robo'))).toEqual({ tipo: 'revelar', indice: 2 });
    expect(comandoDeTecla('6', contexto('enJuego'))).toBeNull();
    expect(comandoDeTecla('8', contexto('enJuego', { respuestas: 8 }))).toEqual({
      tipo: 'revelar',
      indice: 7,
    });
    expect(comandoDeTecla('9', contexto('enJuego', { respuestas: 8 }))).toBeNull();
    expect(comandoDeTecla('0', contexto('enJuego'))).toBeNull();
  });

  it('marks a strike with X, which is the failed steal during robo', () => {
    expect(comandoDeTecla('x', contexto('caraACara'))).toEqual({ tipo: 'tache' });
    expect(comandoDeTecla('X', contexto('enJuego'))).toEqual({ tipo: 'tache' });
    expect(comandoDeTecla('x', contexto('robo'))).toEqual({ tipo: 'roboFallido' });
  });

  it('assigns the turn with A to D, only to teams that exist', () => {
    expect(comandoDeTecla('a', contexto('caraACara'))).toEqual({ tipo: 'asignarTurno', equipo: 0 });
    expect(comandoDeTecla('B', contexto('robo'))).toEqual({ tipo: 'asignarTurno', equipo: 1 });
    expect(comandoDeTecla('c', contexto('caraACara'))).toBeNull();
    expect(comandoDeTecla('d', contexto('caraACara', { equipos: 4 }))).toEqual({
      tipo: 'asignarTurno',
      equipo: 3,
    });
  });

  it('undoes with Z, reveals everything with R, mutes with M and opens the help with ?', () => {
    expect(comandoDeTecla('z', contexto('enJuego'))).toEqual({ tipo: 'deshacer' });
    expect(comandoDeTecla('r', contexto('finDeRonda'))).toEqual({ tipo: 'revelarTodas' });
    expect(comandoDeTecla('M', contexto('enJuego'))).toEqual({ tipo: 'silenciar' });
    expect(comandoDeTecla('?', contexto('caraACara'))).toEqual({ tipo: 'ayuda' });
  });

  it('runs the next step with the space bar', () => {
    expect(comandoDeTecla(' ', contexto('finDeRonda'))).toEqual({ tipo: 'siguienteRonda' });
    expect(comandoDeTecla(' ', contexto('caraACara', { jugarHabilitado: true }))).toEqual({
      tipo: 'jugar',
    });
    expect(comandoDeTecla(' ', contexto('rondaFinal'))).toEqual({ tipo: 'temporizador' });
    expect(comandoDeTecla('Spacebar', contexto('finDeRonda'))).toEqual({
      tipo: 'siguienteRonda',
    });
  });

  it('does nothing with the space bar when no next step applies', () => {
    expect(comandoDeTecla(' ', contexto('caraACara'))).toBeNull();
    expect(comandoDeTecla(' ', contexto('enJuego', { jugarHabilitado: true }))).toBeNull();
    expect(comandoDeTecla(' ', contexto('robo'))).toBeNull();
    expect(comandoDeTecla(' ', contexto('juegoTerminado'))).toBeNull();
  });

  it('picks the match of the current final-round question with 1 to 8 and 0 for no match', () => {
    const final = contexto('rondaFinal');
    expect(comandoDeTecla('1', final)).toEqual({ tipo: 'rfCoincidencia', indice: 0 });
    expect(comandoDeTecla('5', final)).toEqual({ tipo: 'rfCoincidencia', indice: 4 });
    expect(comandoDeTecla('6', final)).toBeNull();
    expect(comandoDeTecla('0', final)).toEqual({ tipo: 'rfCoincidencia', indice: null });
    expect(comandoDeTecla('8', contexto('rondaFinal', { respuestas: 8 }))).toEqual({
      tipo: 'rfCoincidencia',
      indice: 7,
    });
  });

  it('records the current final-round question with Enter', () => {
    expect(comandoDeTecla('Enter', contexto('rondaFinal'))).toEqual({ tipo: 'rfRegistrar' });
  });

  it('keeps only the timer, undo, mute and help in the final round once every answer is in', () => {
    const final = contexto('rondaFinal', { respuestas: 0 });
    for (const tecla of ['1', '0', 'Enter', 'x', 'a', 'b', 'r']) {
      expect(comandoDeTecla(tecla, final)).toBeNull();
    }
    expect(comandoDeTecla(' ', final)).toEqual({ tipo: 'temporizador' });
    expect(comandoDeTecla('z', final)).toEqual({ tipo: 'deshacer' });
    expect(comandoDeTecla('m', final)).toEqual({ tipo: 'silenciar' });
    expect(comandoDeTecla('?', final)).toEqual({ tipo: 'ayuda' });
  });

  it('never assigns turns, strikes or reveals everything in the final round', () => {
    for (const tecla of ['x', 'a', 'b', 'r']) {
      expect(comandoDeTecla(tecla, contexto('rondaFinal'))).toBeNull();
    }
  });

  it('keeps only undo, mute and help once the game is over', () => {
    const terminado = contexto('juegoTerminado');
    for (const tecla of ['1', 'x', 'a', 'r', ' ']) {
      expect(comandoDeTecla(tecla, terminado)).toBeNull();
    }
    expect(comandoDeTecla('z', terminado)).toEqual({ tipo: 'deshacer' });
    expect(comandoDeTecla('m', terminado)).toEqual({ tipo: 'silenciar' });
    expect(comandoDeTecla('?', terminado)).toEqual({ tipo: 'ayuda' });
  });

  it('ignores every other key', () => {
    for (const fase of FASES_DE_RONDA) {
      for (const tecla of ['e', 'Enter', 'Escape', 'Tab', 'ArrowDown', 'Shift', 'F1', '/']) {
        expect(comandoDeTecla(tecla, contexto(fase, { equipos: 4 }))).toBeNull();
      }
    }
  });
});
