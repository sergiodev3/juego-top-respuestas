import {
  APP_RESPALDO,
  erroresDeIntegridad,
  esquemaRespaldo,
  VERSION_RESPALDO,
  type ConteoRestauracion,
  type Respaldo,
  type ResumenRestauracion,
} from '@/shared/modelo';

export type ResultadoLecturaRespaldo =
  { ok: true; respaldo: Respaldo } | { ok: false; errores: string[] };

/** Counts shown before restoring, so the host can tell which file they picked. */
export interface ResumenRespaldo {
  exportadoEn: number;
  sets: number;
  preguntas: number;
  juegos: number;
  partidas: number;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function fallo(error: string): ResultadoLecturaRespaldo {
  return { ok: false, errores: [error] };
}

/** Pretty-printed so a backup stays readable (and diff-able) in a text editor. */
export function serializarRespaldo(respaldo: Respaldo): string {
  return JSON.stringify(respaldo, null, 2);
}

/**
 * Parses and validates a backup file. Never throws: every problem comes back as friendly
 * Spanish messages, and nothing about the file is trusted until it passes the same schemas the
 * repositories use plus the cross-record checks.
 */
export function leerRespaldo(texto: string): ResultadoLecturaRespaldo {
  let crudo: unknown;
  try {
    // Editors and Excel may prepend a UTF-8 BOM, which JSON.parse rejects.
    crudo = JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch {
    return fallo('El archivo no es un respaldo: no se pudo leer como JSON.');
  }

  if (!esObjeto(crudo) || crudo['app'] !== APP_RESPALDO || typeof crudo['version'] !== 'number') {
    return fallo('Este archivo no es un respaldo de Top Respuestas.');
  }
  if (crudo['version'] > VERSION_RESPALDO) {
    return fallo(
      'Este respaldo es de una versión más nueva de la app. Actualiza la app para poder restaurarlo.',
    );
  }

  const analisis = esquemaRespaldo.safeParse(crudo);
  if (!analisis.success) {
    const ruta = analisis.error.issues[0]?.path.join('.') || 'archivo';
    return fallo(`El respaldo está dañado o incompleto (${ruta}).`);
  }

  const errores = erroresDeIntegridad(analisis.data.datos);
  if (errores.length > 0) {
    return { ok: false, errores };
  }
  return { ok: true, respaldo: analisis.data };
}

export function resumenRespaldo(respaldo: Respaldo): ResumenRespaldo {
  const { sets, preguntas, juegos, partidas } = respaldo.datos;
  return {
    exportadoEn: respaldo.exportadoEn,
    sets: sets.length,
    preguntas: preguntas.length,
    juegos: juegos.length,
    partidas: partidas.length,
  };
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** `top-respuestas-respaldo-2026-10-05.json`, using the local date. */
export function nombreArchivoRespaldo(ahora: number): string {
  const fecha = new Date(ahora);
  const dia = `${String(fecha.getFullYear())}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
  return `top-respuestas-respaldo-${dia}.json`;
}

function plural(cantidad: number, singular: string, plurales: string): string {
  return `${String(cantidad)} ${cantidad === 1 ? singular : plurales}`;
}

function sumar(resumen: ResumenRestauracion, campo: keyof ConteoRestauracion): number {
  return (
    resumen.sets[campo] + resumen.preguntas[campo] + resumen.juegos[campo] + resumen.partidas[campo]
  );
}

/** One sentence for the result banner after a restore. */
export function textoResultadoRestauracion(resumen: ResumenRestauracion): string {
  if (resumen.modo === 'reemplazar') {
    const partes = [
      plural(resumen.sets.agregados, 'set', 'sets'),
      plural(resumen.preguntas.agregados, 'pregunta', 'preguntas'),
      plural(resumen.juegos.agregados, 'juego', 'juegos'),
      plural(resumen.partidas.agregados, 'partida', 'partidas'),
    ];
    return `Listo: se reemplazaron tus datos con el respaldo (${partes.join(', ')}).`;
  }
  return (
    'Listo: se combinó el respaldo con tus datos. ' +
    `Nuevos: ${String(sumar(resumen, 'agregados'))}. ` +
    `Actualizados: ${String(sumar(resumen, 'actualizados'))}. ` +
    `Sin cambios: ${String(sumar(resumen, 'sinCambios'))}.`
  );
}
