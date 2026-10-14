import type { z } from 'zod';

import { validarConfig } from './estadoInicial';
import { esquemaConfigPartida } from './esquemas';
import { reproducir } from './motor';
import type { ResultadoReconstruccion } from './tipos';

const CONFIG_INVALIDA = 'La configuración de la partida no es válida';

const TIPOS_ESPERADOS: Readonly<Record<string, string>> = {
  string: 'debe ser texto',
  number: 'debe ser un número',
  int: 'debe ser un número entero',
  array: 'debe ser una lista',
  tuple: 'debe ser una lista',
  object: 'debe ser un objeto',
};

/** Spanish detail for one schema problem; `input` is present because of `reportInput`. */
function describir(problema: z.core.$ZodIssue): string {
  switch (problema.code) {
    case 'invalid_type':
      return problema.input === undefined
        ? 'falta este dato'
        : (TIPOS_ESPERADOS[problema.expected] ?? 'tiene un tipo de dato incorrecto');
    case 'too_small':
      return problema.origin === 'array'
        ? 'tiene menos elementos de los necesarios'
        : 'es menor que el mínimo permitido';
    case 'too_big':
      return 'excede el máximo permitido';
    case 'invalid_value':
      return 'tiene un valor no permitido';
    default:
      return 'no es válido';
  }
}

/** `rondas[0].pregunta.texto` style path for a schema problem. */
function ruta(camino: readonly PropertyKey[]): string {
  return camino
    .map((parte, indice) => {
      if (typeof parte === 'number') {
        return `[${String(parte)}]`;
      }
      return indice === 0 ? String(parte) : `.${String(parte)}`;
    })
    .join('');
}

function mensaje(problema: z.core.$ZodIssue): string {
  const donde = problema.path.length === 0 ? '' : ` en "${ruta(problema.path)}"`;
  return `${CONFIG_INVALIDA}${donde}: ${describir(problema)}.`;
}

function intentarReconstruir(config: unknown, eventos: unknown): ResultadoReconstruccion {
  const leida = esquemaConfigPartida.safeParse(config, { reportInput: true });
  if (!leida.success) {
    return { ok: false, errores: leida.error.issues.map(mensaje) };
  }
  const errores = validarConfig(leida.data);
  if (errores.length > 0) {
    return { ok: false, errores };
  }
  if (!Array.isArray(eventos)) {
    return { ok: false, errores: ['El historial de eventos de la partida debe ser una lista.'] };
  }
  const estado = reproducir(leida.data, eventos);
  return { ok: true, config: leida.data, estado, advertencias: estado.advertencias };
}

/**
 * Persistence-boundary entry point: rebuilds a partida from data read back from storage.
 *
 * Never throws. The config is checked with `esquemaConfigPartida` and `validarConfig`; problems
 * come back as Spanish `errores`. Each stored event is checked with `esquemaEvento` and then with
 * the rules; malformed (`EVENTO_MALFORMADO`) or invalid events are skipped and listed in
 * `advertencias` with their log index. On success, use the returned `config` (unknown keys
 * dropped) for every later engine call.
 */
export function reconstruir(config: unknown, eventos: unknown): ResultadoReconstruccion {
  try {
    return intentarReconstruir(config, eventos);
  } catch {
    // For example a getter or proxy that throws while the stored data is read.
    return { ok: false, errores: ['No se pudo leer la partida guardada.'] };
  }
}
