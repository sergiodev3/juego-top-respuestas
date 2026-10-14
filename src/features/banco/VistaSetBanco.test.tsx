// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { aplicarSemillaSiHaceFalta } from '@/db/semilla';
import { RUTAS, rutaSetBanco } from '@/shared/rutas';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { VistaSetBanco } from './VistaSetBanco';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

async function renderizarSetEjemplo() {
  await aplicarSemillaSiHaceFalta(entorno.db);
  const [set] = await entorno.repositorios.sets.listar();
  const router = createMemoryRouter([{ path: RUTAS.bancoSet, element: <VistaSetBanco /> }], {
    initialEntries: [rutaSetBanco(set?.id ?? '')],
  });
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { usuario: userEvent.setup() };
}

describe('VistaSetBanco', () => {
  it('lists the questions of the set through the injected repositories', async () => {
    await renderizarSetEjemplo();

    expect(
      await screen.findByRole('heading', { name: 'Cultura general escolar' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole('listitem')).toHaveLength(10);
  });

  it('filters by tema and searches ignoring case', async () => {
    const { usuario } = await renderizarSetEjemplo();
    await screen.findAllByRole('listitem');

    await usuario.selectOptions(screen.getByLabelText('Tema'), 'Ciencias');
    await usuario.type(screen.getByLabelText('Buscar preguntas'), 'MAR');

    const lista = await screen.findByRole('list');
    await expect.poll(() => within(lista).queryAllByRole('listitem').length).toBe(1);
    expect(within(lista).getByText('Menciona un animal que vive en el mar')).toBeInTheDocument();
  });
});
