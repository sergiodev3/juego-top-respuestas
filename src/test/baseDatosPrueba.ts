import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { BaseDatosTopRespuestas } from '@/db/baseDatos';
import { crearRepositoriosDexie } from '@/db/repositoriosDexie';

/** Fresh, isolated in-memory database (its own fake IndexedDB factory) for one test. */
export function crearBaseDatosPrueba(): BaseDatosTopRespuestas {
  return new BaseDatosTopRespuestas('top-respuestas-prueba', {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
}

/** Deterministic clock: returns the same instant until `avanzar` is called. */
export function crearRelojPrueba(inicio = 1_700_000_000_000) {
  let actual = inicio;
  return {
    ahora: () => actual,
    avanzar(ms = 1000) {
      actual += ms;
    },
  };
}

/** Deterministic sequential id generator (`id-1`, `id-2`, ...). */
export function crearGeneradorIdsPrueba(prefijo = 'id') {
  let contador = 0;
  return () => {
    contador += 1;
    return `${prefijo}-${String(contador)}`;
  };
}

/** Database plus Dexie repositories wired to a deterministic clock and id generator. */
export function crearEntornoPrueba() {
  const db = crearBaseDatosPrueba();
  const reloj = crearRelojPrueba();
  const repositorios = crearRepositoriosDexie(db, {
    ahora: reloj.ahora,
    generarId: crearGeneradorIdsPrueba(),
  });
  return { db, reloj, repositorios };
}
