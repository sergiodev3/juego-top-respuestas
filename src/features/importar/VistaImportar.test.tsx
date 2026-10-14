// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { RUTAS } from '@/shared/rutas';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { VistaImportar } from './VistaImportar';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function renderizar() {
  const router = createMemoryRouter([{ path: RUTAS.importar, element: <VistaImportar /> }], {
    initialEntries: [RUTAS.importar],
  });
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return userEvent.setup({ applyAccept: false });
}

describe('VistaImportar', () => {
  it('offers both templates and a file picker', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Descargar plantilla .xlsx' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar plantilla .csv' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir archivo' })).toBeInTheDocument();
  });

  it('previews a chosen CSV file', async () => {
    const usuario = renderizar();
    const archivo = new File(['Pregunta;R1;Pts1\nMenciona un color;Rojo;40\n'], 'colores.csv', {
      type: 'text/csv',
    });

    await usuario.upload(screen.getByLabelText('Archivo de preguntas'), archivo);

    expect(await screen.findByText('1 válida')).toBeInTheDocument();
    expect(screen.getByText('Menciona un color')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del set nuevo')).toHaveValue('colores');
  });

  it('explains unsupported files', async () => {
    const usuario = renderizar();
    const archivo = new File(['%PDF'], 'preguntas.pdf', { type: 'application/pdf' });

    await usuario.upload(screen.getByLabelText('Archivo de preguntas'), archivo);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo «preguntas.pdf» no es compatible. Usa un archivo .xlsx, .xls o .csv.',
    );
  });
});
