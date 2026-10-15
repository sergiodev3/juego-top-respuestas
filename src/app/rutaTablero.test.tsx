// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';

import { RUTAS } from '@/shared/rutas';
import { CanalSyncProvider, crearCanal } from '@/shared/sync';
import { precargarRutas } from '@/test/precargarRutas';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { rutas } from './rutas';

// The board view is lazy: import it before rendering so `findBy*` only waits for React.
beforeAll(() => precargarRutas(rutas.filter((ruta) => ruta.path === RUTAS.tablero)), 60_000);

describe('board route', () => {
  it('loads the projector board at /tablero, outside the app shell', async () => {
    const router = createMemoryRouter(rutas, { initialEntries: [RUTAS.tablero] });
    render(
      <CanalSyncProvider canal={crearCanal(crearBusMemoria().crearTransporte())}>
        <RouterProvider router={router} />
      </CanalSyncProvider>,
    );

    expect(await screen.findByText('Esperando al conductor…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top Respuestas' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
