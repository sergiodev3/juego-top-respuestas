// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { RUTAS } from '@/shared/rutas';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

import { VistaInicio } from './VistaInicio';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function renderizar() {
  const router = createMemoryRouter([{ path: RUTAS.inicio, element: <VistaInicio /> }]);
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
}

describe('VistaInicio', () => {
  it('disables "Continuar partida" when no partida is in progress', async () => {
    renderizar();

    expect(await screen.findByText('No hay una partida en curso.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continuar partida/u })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Banco de preguntas/u })).toHaveAttribute(
      'href',
      RUTAS.banco,
    );
  });

  it('links "Continuar partida" to the panel of the in-progress partida', async () => {
    const partida = await entorno.repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba({ nombre: 'Repaso de historia' }),
    });

    renderizar();

    const enlace = await screen.findByRole('link', { name: /Continuar partida/u });
    expect(enlace).toHaveAttribute('href', `/juego/panel/${partida.id}`);
    expect(enlace).toHaveTextContent('Repaso de historia');
  });

  it('links to the quick game chooser and to the full game setup', async () => {
    renderizar();

    expect(await screen.findByRole('link', { name: /Nuevo juego rápido/u })).toHaveAttribute(
      'href',
      RUTAS.juegoRapido,
    );
    expect(screen.getByRole('link', { name: /Configurar juego/u })).toHaveAttribute(
      'href',
      RUTAS.configurarJuego,
    );
  });

  it('hides an ended partida', async () => {
    const partida = await entorno.repositorios.partidas.crear({
      juegoId: 'juego-1',
      config: configPrueba(),
    });
    await entorno.repositorios.partidas.terminar(partida.id);

    renderizar();

    expect(await screen.findByText('No hay una partida en curso.')).toBeInTheDocument();
  });
});
