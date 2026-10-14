import type { Transporte } from '@/shared/sync';

/**
 * In-memory stand-in for BroadcastChannel: every endpoint of a bus receives what the others
 * send (never its own messages), synchronously and as a structured clone. `enviados` records
 * every raw payload so tests can inspect exactly what crossed the "wire".
 */
export function crearBusMemoria() {
  const oyentes = new Set<{ origen: number; manejador: (datos: unknown) => void }>();
  const enviados: unknown[] = [];
  let siguienteOrigen = 0;

  function crearTransporte(): Transporte {
    const origen = siguienteOrigen++;
    const propios = new Set<() => void>();
    return {
      enviar(datos) {
        enviados.push(structuredClone(datos));
        for (const oyente of [...oyentes]) {
          if (oyente.origen !== origen) {
            oyente.manejador(structuredClone(datos));
          }
        }
      },
      escuchar(manejador) {
        const oyente = { origen, manejador };
        oyentes.add(oyente);
        const quitar = () => {
          oyentes.delete(oyente);
          propios.delete(quitar);
        };
        propios.add(quitar);
        return quitar;
      },
      cerrar() {
        for (const quitar of [...propios]) {
          quitar();
        }
      },
    };
  }

  return { crearTransporte, enviados };
}
