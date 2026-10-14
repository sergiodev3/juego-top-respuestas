import { createContext, useContext } from 'react';

import type { Repositorios } from './repositorios';

export const ContextoRepositorios = createContext<Repositorios | null>(null);

/** Repositories provided by `RepositoriosProvider`. Components never touch Dexie directly. */
export function useRepositorios(): Repositorios {
  const repositorios = useContext(ContextoRepositorios);
  if (!repositorios) {
    throw new Error('useRepositorios debe usarse dentro de <RepositoriosProvider>.');
  }
  return repositorios;
}
