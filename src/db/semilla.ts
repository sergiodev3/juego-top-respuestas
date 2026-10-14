import type { DatosPregunta, Pregunta, SetPreguntas } from '@/shared/modelo';

import type { BaseDatosTopRespuestas } from './baseDatos';
import { dependenciasPredeterminadas, type DependenciasRepositorio } from './repositorios';

export const CLAVE_SEMILLA = 'semillaAplicada';
export const NOMBRE_SET_EJEMPLO = 'Cultura general escolar';

function r(texto: string, puntos: number, sinonimos: string[] = []) {
  return { texto, puntos, sinonimos };
}

/** Sample questions with survey-like points (already sorted, each summing to ~100). */
export const PREGUNTAS_EJEMPLO: DatosPregunta[] = [
  {
    texto: 'Menciona una materia que se lleva en la secundaria',
    tema: 'Escuela',
    respuestas: [
      r('Matemáticas', 32, ['Mate']),
      r('Español', 24),
      r('Historia', 14),
      r('Inglés', 10),
      r('Ciencias', 8, ['Biología', 'Física', 'Química']),
      r('Educación Física', 6, ['Deportes']),
      r('Geografía', 4),
    ],
  },
  {
    texto: 'Menciona algo que llevas en la mochila',
    tema: 'Escuela',
    respuestas: [
      r('Cuaderno', 30, ['Libreta']),
      r('Lápiz', 22, ['Pluma', 'Bolígrafo']),
      r('Libros', 15),
      r('Lonche', 12, ['Almuerzo', 'Comida']),
      r('Estuche', 9, ['Lapicera']),
      r('Calculadora', 6),
      r('Celular', 4),
    ],
  },
  {
    texto: 'Menciona un planeta del sistema solar',
    tema: 'Ciencias',
    respuestas: [
      r('Tierra', 28),
      r('Marte', 25),
      r('Júpiter', 16),
      r('Saturno', 12),
      r('Venus', 8),
      r('Mercurio', 5),
      r('Neptuno', 4),
    ],
  },
  {
    texto: 'Menciona un animal que vive en el mar',
    tema: 'Ciencias',
    respuestas: [
      r('Tiburón', 30),
      r('Ballena', 24),
      r('Delfín', 18),
      r('Pulpo', 10),
      r('Pez', 8, ['Pescado']),
      r('Medusa', 6, ['Aguamala']),
      r('Estrella de mar', 3),
    ],
  },
  {
    texto: 'Menciona un personaje de la Independencia de México',
    tema: 'Historia',
    respuestas: [
      r('Miguel Hidalgo', 38, ['Hidalgo', 'Cura Hidalgo']),
      r('José María Morelos', 22, ['Morelos']),
      r('Josefa Ortiz de Domínguez', 15, ['La Corregidora']),
      r('Ignacio Allende', 11, ['Allende']),
      r('Vicente Guerrero', 8, ['Guerrero']),
      r('Leona Vicario', 4),
    ],
  },
  {
    texto: 'Menciona un estado de la República Mexicana',
    tema: 'Geografía',
    respuestas: [
      r('Jalisco', 20),
      r('Nuevo León', 16),
      r('Oaxaca', 14),
      r('Yucatán', 12),
      r('Chiapas', 11),
      r('Veracruz', 10),
      r('Sonora', 8),
      r('Puebla', 6),
    ],
  },
  {
    texto: 'Menciona un instrumento musical',
    tema: 'Arte',
    respuestas: [
      r('Guitarra', 35),
      r('Piano', 22, ['Teclado']),
      r('Batería', 15, ['Tambor']),
      r('Violín', 12),
      r('Flauta', 9),
      r('Trompeta', 5),
    ],
  },
  {
    texto: 'Menciona algo que hay en un salón de clases',
    tema: 'Escuela',
    respuestas: [
      r('Pizarrón', 34, ['Pizarra']),
      r('Bancas', 25, ['Pupitres', 'Sillas']),
      r('Escritorio', 14),
      r('Reloj', 9),
      r('Ventanas', 7),
      r('Mapa', 5),
      r('Bote de basura', 4, ['Basurero']),
    ],
  },
  {
    texto: 'Menciona una figura geométrica',
    tema: 'Matemáticas',
    respuestas: [
      r('Círculo', 30),
      r('Cuadrado', 26),
      r('Triángulo', 22),
      r('Rectángulo', 12),
      r('Rombo', 5),
      r('Pentágono', 3),
    ],
  },
  {
    texto: 'Menciona un deporte que se juega en equipo',
    tema: 'Deportes',
    respuestas: [
      r('Fútbol', 45, ['Futbol', 'Soccer']),
      r('Básquetbol', 22, ['Basquetbol', 'Básquet', 'Baloncesto']),
      r('Voleibol', 15, ['Vóleibol', 'Volibol']),
      r('Béisbol', 10, ['Beisbol']),
      r('Fútbol americano', 5, ['Americano']),
    ],
  },
];

/**
 * Inserts the sample set the first time the app runs. The flag in `meta` is written in
 * the same transaction, so the seed never repeats, even after the user deletes the set.
 * Resolves to whether the seed was applied by this call.
 */
export async function aplicarSemillaSiHaceFalta(
  db: BaseDatosTopRespuestas,
  { ahora, generarId }: DependenciasRepositorio = dependenciasPredeterminadas,
): Promise<boolean> {
  return db.transaction('rw', db.meta, db.sets, db.preguntas, async () => {
    if (await db.meta.get(CLAVE_SEMILLA)) {
      return false;
    }
    const momento = ahora();
    const set: SetPreguntas = {
      id: generarId(),
      nombre: NOMBRE_SET_EJEMPLO,
      materia: 'Cultura general',
      grupo: '',
      creadoEn: momento,
      actualizadoEn: momento,
      eliminadoEn: null,
    };
    const preguntas: Pregunta[] = PREGUNTAS_EJEMPLO.map((datos, indice) => ({
      id: generarId(),
      setId: set.id,
      ...datos,
      // Offsets keep the listed order when sorting by creation time.
      creadoEn: momento + indice,
      actualizadoEn: momento + indice,
      eliminadoEn: null,
    }));
    await db.sets.add(set);
    await db.preguntas.bulkAdd(preguntas);
    await db.meta.put({ clave: CLAVE_SEMILLA, valor: momento });
    return true;
  });
}
