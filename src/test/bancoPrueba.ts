// Test-only bank seeding for the game setup views.
import type { Repositorios } from '@/db/repositorios';

export const PREGUNTAS_CIENCIAS = [
  'Menciona un planeta',
  'Menciona un animal marino',
  'Menciona un volcán famoso',
  'Menciona un órgano del cuerpo',
  'Menciona un elemento químico',
  'Menciona una fuente de energía',
] as const;

export const PREGUNTAS_HISTORIA = [
  'Menciona un héroe nacional',
  'Menciona una civilización antigua',
  'Menciona un invento importante',
] as const;

export function datosPreguntaPrueba(texto: string, tema = '') {
  return {
    texto,
    tema,
    respuestas: [
      { texto: 'Primera', puntos: 30, sinonimos: [] },
      { texto: 'Segunda', puntos: 10, sinonimos: [] },
    ],
  };
}

/**
 * Sets "Ciencias 2B" (6 questions, tema "Ciencias"), "Historia" (3 questions, tema "Historia")
 * and "Vacío" (no questions). `avanzar` moves the clock so creation order is stable.
 */
export async function sembrarBancoPrueba(repositorios: Repositorios, avanzar: () => void) {
  const ciencias = await repositorios.sets.crear({ nombre: 'Ciencias 2B', materia: '', grupo: '' });
  const historia = await repositorios.sets.crear({ nombre: 'Historia', materia: '', grupo: '' });
  const vacio = await repositorios.sets.crear({ nombre: 'Vacío', materia: '', grupo: '' });
  for (const texto of PREGUNTAS_CIENCIAS) {
    avanzar();
    await repositorios.preguntas.crear(ciencias.id, datosPreguntaPrueba(texto, 'Ciencias'));
  }
  for (const texto of PREGUNTAS_HISTORIA) {
    avanzar();
    await repositorios.preguntas.crear(historia.id, datosPreguntaPrueba(texto, 'Historia'));
  }
  return { ciencias, historia, vacio };
}
