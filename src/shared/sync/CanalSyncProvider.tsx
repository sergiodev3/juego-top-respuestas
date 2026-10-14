import type { ReactNode } from 'react';

import type { Canal } from './canal';
import { ContextoCanalSync } from './contextoCanal';

interface CanalSyncProviderProps {
  /** Tests inject an in-memory channel; without a provider the app channel is used. */
  canal: Canal;
  children: ReactNode;
}

export function CanalSyncProvider({ canal, children }: CanalSyncProviderProps) {
  return <ContextoCanalSync value={canal}>{children}</ContextoCanalSync>;
}
