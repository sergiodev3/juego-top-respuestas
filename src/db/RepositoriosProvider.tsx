import type { ReactNode } from 'react';

import { ContextoRepositorios } from './contextoRepositorios';
import { repositoriosApp } from './instancia';
import type { Repositorios } from './repositorios';

interface RepositoriosProviderProps {
  /** Defaults to the app's Dexie repositories; tests inject their own. */
  repositorios?: Repositorios;
  children: ReactNode;
}

export function RepositoriosProvider({
  repositorios = repositoriosApp,
  children,
}: RepositoriosProviderProps) {
  return <ContextoRepositorios value={repositorios}>{children}</ContextoRepositorios>;
}
