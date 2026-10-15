// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { RUTAS } from '@/shared/rutas';
import { PREGUNTAS_CIENCIAS, sembrarBancoPrueba } from '@/test/bancoPrueba';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

import { VistaJuegoRapido } from './VistaJuegoRapido';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function PanelPrueba() {
  const { partidaId } = useParams();
  return <p>Panel {partidaId}</p>;
}

async function renderizar() {
  await sembrarBancoPrueba(entorno.repositorios, () => {
    entorno.reloj.avanzar();
  });
  const router = createMemoryRouter(
    [
      { path: RUTAS.juegoRapido, element: <VistaJuegoRapido aleatorio={() => 0} /> },
      { path: RUTAS.panelPartida, element: <PanelPrueba /> },
    ],
    { initialEntries: [RUTAS.juegoRapido] },
  );
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { usuario: userEvent.setup() };
}

describe('VistaJuegoRapido', () => {
  it('lists sets with their question counts and disables empty ones with a reason', async () => {
    await renderizar();

    expect(await screen.findByRole('radio', { name: /Ciencias 2B/u })).toHaveAccessibleName(
      /6 preguntas/u,
    );
    const vacio = screen.getByRole('radio', { name: /Vacío/u });
    expect(vacio).toBeDisabled();
    expect(vacio).toHaveAccessibleDescription('Este set no tiene preguntas.');
    expect(screen.getByRole('link', { name: 'Configurar juego' })).toHaveAttribute(
      'href',
      RUTAS.configurarJuego,
    );
  });

  it('starts a quick game in two clicks: choose a set, then "Jugar"', async () => {
    const { usuario } = await renderizar();

    await usuario.click(await screen.findByRole('radio', { name: /Ciencias 2B/u }));
    await usuario.click(screen.getByRole('button', { name: 'Jugar' }));

    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    const partida = await entorno.repositorios.partidas.obtenerEnCurso();
    expect(screen.getByText(`Panel ${partida?.id ?? ''}`)).toBeInTheDocument();
    expect(partida?.config.nombre).toBe('Ciencias 2B');
    expect(partida?.config.rondas.map((ronda) => ronda.multiplicador)).toEqual([1, 1, 2, 3]);
    expect(
      partida?.config.rondas.every((ronda) =>
        (PREGUNTAS_CIENCIAS as readonly string[]).includes(ronda.pregunta.texto),
      ),
    ).toBe(true);
    const [juego] = await entorno.repositorios.juegos.listar();
    expect(partida?.juegoId).toBe(juego?.id);
  });

  it('asks before replacing a partida in progress', async () => {
    const anterior = await entorno.repositorios.partidas.crear({
      juegoId: 'otro',
      config: configPrueba(),
    });
    const { usuario } = await renderizar();

    await usuario.click(await screen.findByRole('radio', { name: /Historia/u }));
    await usuario.click(screen.getByRole('button', { name: 'Jugar' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Iniciar una nueva partida?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    expect((await entorno.repositorios.partidas.obtenerEnCurso())?.id).toBe(anterior.id);

    await usuario.click(screen.getByRole('button', { name: 'Jugar' }));
    await usuario.click(
      within(await screen.findByRole('dialog', { name: '¿Iniciar una nueva partida?' })).getByRole(
        'button',
        { name: 'Iniciar nueva partida' },
      ),
    );

    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    expect((await entorno.repositorios.partidas.obtener(anterior.id))?.estado).toBe('terminada');
  });

  it('asks to choose a set before playing', async () => {
    const { usuario } = await renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Jugar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Elige un set para jugar.');
    expect(await entorno.repositorios.juegos.listar()).toEqual([]);
  });
});
