import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';

import { RUTAS } from '@/shared/rutas';

import { rutas } from './rutas';

function rutasConLayout(): RouteObject[] {
  const raiz = rutas.find((ruta) => ruta.path === RUTAS.inicio);
  return raiz?.children ?? [];
}

describe('rutas', () => {
  it('registers every application path', () => {
    const registradas = new Set<string | undefined>([
      ...rutas.map((ruta) => ruta.path),
      ...rutasConLayout().map((ruta) => ruta.path),
    ]);

    for (const path of Object.values(RUTAS)) {
      expect(registradas, `missing route ${path}`).toContain(path);
    }
  });

  it('renders the board outside the app shell', () => {
    expect(rutas.map((ruta) => ruta.path)).toContain(RUTAS.tablero);
    expect(rutasConLayout().map((ruta) => ruta.path)).not.toContain(RUTAS.tablero);
  });

  it('has an index route and a catch-all 404 inside the layout', () => {
    const hijas = rutasConLayout();
    expect(hijas.some((ruta) => ruta.index === true)).toBe(true);
    expect(hijas.map((ruta) => ruta.path)).toContain('*');
  });
});
