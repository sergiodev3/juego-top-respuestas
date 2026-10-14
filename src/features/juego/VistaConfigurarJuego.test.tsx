// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { RUTAS, rutaConfigurarJuego } from '@/shared/rutas';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { VistaConfigurarJuego } from './VistaConfigurarJuego';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function renderizar(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: RUTAS.configurarJuego, element: <VistaConfigurarJuego /> },
      { path: RUTAS.configurarJuegoGuardado, element: <VistaConfigurarJuego /> },
    ],
    { initialEntries: [ruta] },
  );
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
}

function pregunta(texto: string) {
  return { texto, tema: '', respuestas: [{ texto: 'A', puntos: 10, sinonimos: [] }] };
}

describe('VistaConfigurarJuego', () => {
  it('shows the summary of a saved game: teams and rounds with multipliers', async () => {
    const { juego } = await entorno.repositorios.importacion.importarYJugar(
      { nombre: 'Repaso', materia: '', grupo: '' },
      ['Uno', 'Dos', 'Tres', 'Cuatro'].map(pregunta),
    );

    renderizar(rutaConfigurarJuego(juego.id));

    expect(await screen.findByRole('heading', { name: 'Repaso' })).toBeInTheDocument();
    const rondas = await screen.findByRole('list', { name: 'Rondas' });
    await expect
      .poll(() =>
        within(rondas)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      )
      .toEqual(['Ronda 1Unox1', 'Ronda 2Dosx1', 'Ronda 3Tresx2', 'Ronda 4Cuatrox3']);
    expect(screen.getByText('Equipo A')).toBeInTheDocument();
    expect(screen.getByText('3 tachas por ronda')).toBeInTheDocument();
  });

  it('says when the game does not exist', async () => {
    renderizar(rutaConfigurarJuego('no-existe'));

    expect(await screen.findByText('No se encontró el juego solicitado.')).toBeInTheDocument();
  });

  it('keeps the placeholder without a game id', () => {
    renderizar(RUTAS.configurarJuego);

    expect(
      screen.getByText('Esta sección estará disponible en una próxima fase.'),
    ).toBeInTheDocument();
  });
});
