// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { aplicarSemillaSiHaceFalta } from '@/db/semilla';
import { VistaConfigurarJuego } from '@/features/juego/VistaConfigurarJuego';
import { RUTAS } from '@/shared/rutas';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import type { Celda } from './dominio';
import { validarFilas } from './dominio';
import { PanelImportacion } from './PanelImportacion';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

const ENCABEZADO = ['Tema', 'Pregunta', 'R1', 'Pts1', 'R2', 'Pts2', 'R3', 'Pts3', 'Sinónimos'];

const MATRIZ_MIXTA: Celda[][] = [
  ENCABEZADO,
  ['Ciencias', 'Menciona un planeta del sistema solar', 'Marte', 25, 'Tierra', 28],
  ['Escuela', 'Menciona algo de la mochila', 'Lápiz', 22, 'Cuaderno', 30, 'Libros'],
  ['', '', 'Sin pregunta', 10],
  ['Arte', 'Menciona un instrumento', 'Piano', 22, 'Guitarra', 35, '', '', 'R1: teclado'],
];

const MATRIZ_INVALIDA: Celda[][] = [ENCABEZADO, ['', 'Sin respuestas']];

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function renderizarPanel(matriz: Celda[][], nombreArchivo = 'repaso-2b.xlsx') {
  const resultado = validarFilas(matriz);
  if (!resultado.ok) {
    throw new Error(resultado.error);
  }
  const router = createMemoryRouter(
    [
      {
        path: RUTAS.importar,
        element: <PanelImportacion nombreArchivo={nombreArchivo} filas={resultado.filas} />,
      },
      { path: RUTAS.configurarJuegoGuardado, element: <VistaConfigurarJuego /> },
      { path: RUTAS.bancoSet, element: <p>Vista del set</p> },
    ],
    { initialEntries: [RUTAS.importar] },
  );
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { usuario: userEvent.setup(), router };
}

function filaDeTabla(numero: number): HTMLElement {
  const celda = screen.getByRole('rowheader', { name: String(numero) });
  const fila = celda.closest('tr');
  if (!fila) {
    throw new Error(`row ${String(numero)} not found`);
  }
  return fila;
}

describe('PanelImportacion', () => {
  it('shows the summary and the exact reasons per row', () => {
    renderizarPanel(MATRIZ_MIXTA);

    expect(screen.getByText('2 válidas')).toBeInTheDocument();
    expect(screen.getByText('2 con errores')).toBeInTheDocument();
    expect(
      within(filaDeTabla(3)).getByText('R3 tiene texto pero no tiene puntos (Pts3).'),
    ).toBeInTheDocument();
    expect(within(filaDeTabla(4)).getByText('Falta el texto de la pregunta.')).toBeInTheDocument();
    expect(within(filaDeTabla(2)).getByText('Válida')).toBeInTheDocument();
    expect(within(filaDeTabla(5)).getByText('Válida')).toBeInTheDocument();
    expect(within(filaDeTabla(4)).getByText('Con errores')).toBeInTheDocument();
  });

  it('shows the answers of a valid row sorted by points', () => {
    renderizarPanel(MATRIZ_MIXTA);

    const respuestas = within(filaDeTabla(2))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

    expect(respuestas).toEqual(['Tierra (28)', 'Marte (25)']);
  });

  it('can show only the rows with errors', async () => {
    const { usuario } = renderizarPanel(MATRIZ_MIXTA);

    await usuario.click(screen.getByLabelText('Mostrar solo filas con errores'));

    expect(screen.queryByRole('rowheader', { name: '2' })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '3' })).toBeInTheDocument();
  });

  it('disables both import buttons when no row is valid', () => {
    renderizarPanel(MATRIZ_INVALIDA);

    expect(screen.getByRole('button', { name: 'Importar 0 preguntas' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Importar y jugar' })).toBeDisabled();
  });

  it('imports the valid rows into a new set named after the file', async () => {
    const { usuario } = renderizarPanel(MATRIZ_MIXTA);

    expect(screen.getByLabelText('Nombre del set nuevo')).toHaveValue('repaso-2b');
    await usuario.click(screen.getByRole('button', { name: 'Importar 2 preguntas' }));

    expect(await screen.findByText(/Se importaron 2 preguntas/)).toBeInTheDocument();
    const [set] = await entorno.repositorios.sets.listar();
    expect(set?.nombre).toBe('repaso-2b');
    expect(await entorno.repositorios.preguntas.listarPorSet(set?.id ?? '')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ver el set «repaso-2b»' })).toBeInTheDocument();
  });

  it('warns about questions that already exist in the chosen set', async () => {
    await aplicarSemillaSiHaceFalta(entorno.db);
    const { usuario } = renderizarPanel(MATRIZ_MIXTA);

    await usuario.click(screen.getByLabelText('Set existente'));
    await screen.findByRole('option', { name: 'Cultura general escolar' });

    expect(
      await within(filaDeTabla(2)).findByText('Ya existe una pregunta igual en el set destino.'),
    ).toBeInTheDocument();
  });

  it('"Importar y jugar" creates a set and a game and opens its summary', async () => {
    const { usuario, router } = renderizarPanel(MATRIZ_MIXTA);

    await usuario.click(screen.getByRole('button', { name: 'Importar y jugar' }));

    expect(await screen.findByRole('heading', { name: 'Configurar juego' })).toBeInTheDocument();
    const [juego] = await entorno.repositorios.juegos.listar();
    expect(router.state.location.pathname).toBe(`/juego/configurar/${juego?.id ?? ''}`);
    expect(await screen.findByText('Menciona un planeta del sistema solar')).toBeInTheDocument();
    expect(screen.getByText('Equipo A')).toBeInTheDocument();
    expect(screen.getByText('Equipo B')).toBeInTheDocument();
  });
});
