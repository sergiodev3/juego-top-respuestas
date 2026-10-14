import type { ReactNode } from 'react';

import { ContextoSonidos } from './contextoSonidos';
import type { AlmacenSilencio } from './silencio';
import type { ReproductorSonidos } from './tipos';

interface SonidosProviderProps {
  /** Tests inject a fake player; without a provider the app's Howler player is used. */
  reproductor: ReproductorSonidos;
  silencio: AlmacenSilencio;
  children: ReactNode;
}

export function SonidosProvider({ reproductor, silencio, children }: SonidosProviderProps) {
  return <ContextoSonidos value={{ reproductor, silencio }}>{children}</ContextoSonidos>;
}
