import type { RouteObject } from 'react-router';

/**
 * Resolves every function-style `lazy` in a route tree ahead of a render. The first
 * dynamic import transforms the whole view module graph, which under full-suite load can
 * outlast a `findBy*` timeout; once warmed, the router's own `lazy` call resolves at once.
 */
export async function precargarRutas(rutas: readonly RouteObject[]): Promise<void> {
  await Promise.all(
    rutas.map(async (ruta) => {
      if (typeof ruta.lazy === 'function') {
        await ruta.lazy();
      }
      if (ruta.children) {
        await precargarRutas(ruta.children);
      }
    }),
  );
}
