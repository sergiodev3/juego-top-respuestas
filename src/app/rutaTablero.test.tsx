// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { RUTAS } from '@/shared/rutas';
import { CanalSyncProvider, crearCanal } from '@/shared/sync';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { rutas } from './rutas';

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
