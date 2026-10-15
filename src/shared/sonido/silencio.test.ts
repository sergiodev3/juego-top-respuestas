import { describe, expect, it, vi } from 'vitest';

import { CLAVE_SILENCIO, crearAlmacenSilencio, type AlmacenamientoSilencio } from './silencio';

function almacenamientoMemoria(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    almacenamiento: {
      getItem: (clave: string) => datos.get(clave) ?? null,
      setItem: (clave: string, valor: string) => {
        datos.set(clave, valor);
      },
    } satisfies AlmacenamientoSilencio,
  };
}

const roto: AlmacenamientoSilencio = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('crearAlmacenSilencio', () => {
  it('starts with sound on when nothing was stored', () => {
    const { almacenamiento } = almacenamientoMemoria();
    expect(crearAlmacenSilencio(() => almacenamiento).estaSilenciado()).toBe(false);
  });

  it('persists the choice so a new store (a reload) reads it back', () => {
    const { almacenamiento, datos } = almacenamientoMemoria();
    crearAlmacenSilencio(() => almacenamiento).establecer(true);
    expect(datos.get(CLAVE_SILENCIO)).toBe('true');
    expect(crearAlmacenSilencio(() => almacenamiento).estaSilenciado()).toBe(true);

    crearAlmacenSilencio(() => almacenamiento).establecer(false);
    expect(crearAlmacenSilencio(() => almacenamiento).estaSilenciado()).toBe(false);
  });

  it('ignores unknown stored values', () => {
    const { almacenamiento } = almacenamientoMemoria({ [CLAVE_SILENCIO]: 'quizá' });
    expect(crearAlmacenSilencio(() => almacenamiento).estaSilenciado()).toBe(false);
  });

  it('notifies subscribers on change until they unsubscribe', () => {
    const { almacenamiento } = almacenamientoMemoria();
    const almacen = crearAlmacenSilencio(() => almacenamiento);
    const alCambiar = vi.fn();
    const cancelar = almacen.suscribir(alCambiar);

    almacen.establecer(true);
    almacen.establecer(true);
    expect(alCambiar).toHaveBeenCalledTimes(1);

    cancelar();
    almacen.establecer(false);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('never throws with broken or missing storage and keeps the choice for the session', () => {
    for (const obtener of [
      () => roto,
      () => undefined,
      () => {
        throw new Error('localStorage is not available');
      },
    ]) {
      const almacen = crearAlmacenSilencio(obtener);
      expect(almacen.estaSilenciado()).toBe(false);
      expect(() => {
        almacen.establecer(true);
      }).not.toThrow();
      expect(almacen.estaSilenciado()).toBe(true);
    }
  });
});
