import { MAX_RESPUESTAS } from '@/shared/modelo';
import { normalizarTexto } from '@/shared/utils/normalizarTexto';

export interface SinonimosLeidos {
  /** Synonyms per answer number (1-8), in the order they were written. */
  porRespuesta: Partial<Record<number, string[]>>;
  errores: string[];
}

const GRUPO = /^r\s*(\d+)\s*:(.*)$/isu;

/**
 * Parses a synonyms cell such as `R1: auto, coche; R3: celular`. Groups are separated by
 * `;` and synonyms by `,`; labels ignore case and spaces. Repeated groups are merged and
 * repeated synonyms (ignoring case and accents) are dropped. Checking that the answer
 * actually exists in the row is left to the caller.
 */
export function parsearSinonimos(texto: string): SinonimosLeidos {
  const porRespuesta: Partial<Record<number, string[]>> = {};
  const errores: string[] = [];

  for (const grupo of texto.split(';').map((parte) => parte.trim())) {
    if (grupo === '') {
      continue;
    }
    const coincidencia = GRUPO.exec(grupo);
    if (!coincidencia) {
      errores.push(`Sinónimos: formato no reconocido en "${grupo}".`);
      continue;
    }
    const numero = Number(coincidencia[1]);
    if (numero < 1 || numero > MAX_RESPUESTAS) {
      errores.push(
        `Sinónimos: "R${String(numero)}" no existe (usa R1 a R${String(MAX_RESPUESTAS)}).`,
      );
      continue;
    }
    const lista = (porRespuesta[numero] ??= []);
    const vistos = new Set(lista.map(normalizarTexto));
    for (const sinonimo of (coincidencia[2] ?? '').split(',').map((s) => s.trim())) {
      const clave = normalizarTexto(sinonimo);
      if (sinonimo !== '' && !vistos.has(clave)) {
        vistos.add(clave);
        lista.push(sinonimo);
      }
    }
  }

  return { porRespuesta, errores };
}
