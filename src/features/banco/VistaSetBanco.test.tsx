// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { aplicarSemillaSiHaceFalta } from '@/db/semilla';
import { RUTAS, rutaImpresion, rutaSetBanco } from '@/shared/rutas';
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

function renderizarSet(setId: string) {
  const router = createMemoryRouter([{ path: RUTAS.bancoSet, element: <VistaSetBanco /> }], {
    initialEntries: [rutaSetBanco(setId)],
  });
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { usuario: userEvent.setup() };
}

async function renderizarSetEjemplo() {
  await aplicarSemillaSiHaceFalta(entorno.db);
  const [set] = await entorno.repositorios.sets.listar();
  return { ...renderizarSet(set?.id ?? ''), setId: set?.id ?? '' };
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

  it('links to the printable cards of the set', async () => {
    const { setId } = await renderizarSetEjemplo();

    expect(await screen.findByRole('link', { name: 'Imprimir tarjetas' })).toHaveAttribute(
      'href',
      rutaImpresion({ set: setId }),
    );
  });

  it('explains instead of linking to print when the set has no questions', async () => {
    const vacio = await entorno.repositorios.sets.crear({
      nombre: 'Vacío',
      materia: '',
      grupo: '',
    });
    renderizarSet(vacio.id);

    expect(
      await screen.findByText('Agrega preguntas para poder imprimir tarjetas.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Imprimir tarjetas' })).not.toBeInTheDocument();
  });
});
