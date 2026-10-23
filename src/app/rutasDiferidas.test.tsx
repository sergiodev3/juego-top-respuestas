// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { RUTAS } from '@/shared/rutas';
import { precargarRutas } from '@/test/precargarRutas';

import { rutas } from './rutas';

const hijasDelLayout: RouteObject[] =
  rutas.find((ruta) => ruta.path === RUTAS.inicio)?.children ?? [];

// Importing every view the first time is slow under full-suite load; do it once up front.
beforeAll(() => precargarRutas(rutas), 60_000);

describe('lazy routes', () => {
  it('keeps only Inicio and the 404 in the main chunk; every other view loads on demand', () => {
    const eager = hijasDelLayout.filter((ruta) => ruta.lazy === undefined);
    expect(eager.map((ruta) => (ruta.index === true ? 'index' : ruta.path))).toEqual([
      'index',
      '*',
    ]);
    expect(rutas.find((ruta) => ruta.path === RUTAS.tablero)?.lazy).toBeDefined();
  });

  it('resolves every lazy route to a view component', async () => {
    const diferidas = [...hijasDelLayout, ...rutas].filter(
      (ruta) => typeof ruta.lazy === 'function',
    );
    expect(diferidas.length).toBeGreaterThan(0);
    for (const ruta of diferidas) {
      const cargada = typeof ruta.lazy === 'function' ? await ruta.lazy() : {};
      expect(cargada.Component, `route ${ruta.path ?? ''}`).toBeTypeOf('function');
    }
  });

  it('renders a lazy view inside the app shell', async () => {
    const router = createMemoryRouter(rutas, { initialEntries: [RUTAS.respaldos] });
    render(
      <RepositoriosProvider>
        <RouterProvider router={router} />
      </RepositoriosProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Respaldos' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });
});
