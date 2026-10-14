import { createContext, useContext } from 'react';

import { crearCanal, type Canal } from './canal';
import { crearTransporteBroadcast, transporteNulo } from './transporteBroadcast';

export const ContextoCanalSync = createContext<Canal | null>(null);

let canalApp: Canal | null = null;

/**
 * The window's BroadcastChannel-backed channel, created on first use and kept for the page's
 * lifetime (one per window; the panel and the board live in different windows).
 */
export function obtenerCanalApp(): Canal {
  canalApp ??= crearCanal(crearTransporteBroadcast() ?? transporteNulo);
  return canalApp;
}

/** Channel from `CanalSyncProvider` (tests inject a fake), or the app channel. */
export function useCanalSync(): Canal {
  return useContext(ContextoCanalSync) ?? obtenerCanalApp();
}
