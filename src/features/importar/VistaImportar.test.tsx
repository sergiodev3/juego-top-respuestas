// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
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

const CSV_VALIDO = 'Pregunta;R1;Pts1\nMenciona un color;Rojo;40\n';
const CSV_CON_ERROR = 'Pregunta;R1;Pts1\n;Rojo;40\n';

function archivoCsv(contenido: string, nombre: string): File {
  return new File([contenido], nombre, { type: 'text/csv' });
}

/** A CSV file whose bytes are only delivered when the test resolves (or rejects) its read. */
function archivoConLecturaDiferida(contenido: string, nombre: string) {
  const archivo = archivoCsv(contenido, nombre);
  const bytes = new TextEncoder().encode(contenido).buffer;
  let resolver: () => void = () => undefined;
  let rechazar: (causa: Error) => void = () => undefined;
  const lectura = new Promise<ArrayBuffer>((resolve, reject) => {
    resolver = () => {
      resolve(bytes);
    };
    rechazar = reject;
  });
  Object.defineProperty(archivo, 'arrayBuffer', { value: () => lectura });
  // The Promise executor runs synchronously, so both callbacks are already bound here.
  return { archivo, resolver, rechazar };
}

/** Lets pending reads (including lazy-loaded parsers) settle. */
function esperar(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  describe('Cancelar', () => {
    it('discards a file with invalid rows and returns to the drop zone', async () => {
      const usuario = renderizar();
      await usuario.upload(
        screen.getByLabelText('Archivo de preguntas'),
        archivoCsv(CSV_CON_ERROR, 'con-error.csv'),
      );
      expect(await screen.findByText('1 con error')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Elegir archivo' })).not.toBeInTheDocument();

      const cancelar = screen.getByRole('button', { name: 'Cancelar' });
      expect(cancelar).toHaveAccessibleDescription(
        'Descarta este archivo para que puedas elegir otro.',
      );
      await usuario.click(cancelar);

      expect(screen.queryByRole('heading', { name: 'Vista previa' })).not.toBeInTheDocument();
      expect(screen.queryByText('1 con error')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Descargar plantilla .xlsx' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elegir archivo' })).toHaveFocus();
    });

    it('discards a file-level error and returns to the drop zone', async () => {
      const usuario = renderizar();
      await usuario.upload(
        screen.getByLabelText('Archivo de preguntas'),
        new File(['%PDF'], 'preguntas.pdf', { type: 'application/pdf' }),
      );
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elegir archivo' })).toHaveFocus();
    });

    it('shows a fresh preview when the same file is chosen again', async () => {
      const usuario = renderizar();
      const archivo = archivoCsv(CSV_VALIDO, 'colores.csv');
      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), archivo);
      const nombreSet = await screen.findByLabelText('Nombre del set nuevo');
      await usuario.clear(nombreSet);
      await usuario.type(nombreSet, 'Otro nombre');

      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), archivo);

      expect(await screen.findByText('1 válida')).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre del set nuevo')).toHaveValue('colores');
    });

    it('"Importar otro archivo" after a successful import returns to the drop zone', async () => {
      const usuario = renderizar();
      await usuario.upload(
        screen.getByLabelText('Archivo de preguntas'),
        archivoCsv(CSV_VALIDO, 'colores.csv'),
      );
      await usuario.click(await screen.findByRole('button', { name: 'Importar 1 pregunta' }));
      expect(await screen.findByText(/Se importaron 1 pregunta/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

      await usuario.click(screen.getByRole('button', { name: 'Importar otro archivo' }));

      expect(screen.queryByText(/Se importaron/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elegir archivo' })).toHaveFocus();
    });
  });

  describe('overlapping reads', () => {
    it('shows only the latest file when an earlier read finishes last', async () => {
      const usuario = renderizar();
      const primero = archivoConLecturaDiferida(
        'Pregunta;R1;Pts1\nPrimera pregunta;Rojo;40\n',
        'primero.csv',
      );
      const segundo = archivoConLecturaDiferida(
        'Pregunta;R1;Pts1\nSegunda pregunta;Azul;30\n',
        'segundo.csv',
      );

      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), primero.archivo);
      expect(screen.getByRole('status')).toHaveTextContent('Leyendo archivo…');
      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), segundo.archivo);
      await act(async () => {
        segundo.resolver();
        await esperar();
      });
      expect(await screen.findByText('Segunda pregunta')).toBeInTheDocument();

      await act(async () => {
        primero.resolver();
        await esperar();
      });

      expect(screen.getByText('Segunda pregunta')).toBeInTheDocument();
      expect(screen.queryByText('Primera pregunta')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Importar «segundo.csv»' })).toBeInTheDocument();
    });

    it('ignores an error from an earlier read that finishes last', async () => {
      const usuario = renderizar();
      const primero = archivoConLecturaDiferida('', 'primero.csv');
      const segundo = archivoConLecturaDiferida(CSV_VALIDO, 'segundo.csv');

      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), primero.archivo);
      await usuario.upload(screen.getByLabelText('Archivo de preguntas'), segundo.archivo);
      await act(async () => {
        segundo.resolver();
        await esperar();
      });
      expect(await screen.findByText('1 válida')).toBeInTheDocument();

      await act(async () => {
        primero.rechazar(new Error('lectura fallida'));
        await esperar();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('1 válida')).toBeInTheDocument();
    });
  });
});
