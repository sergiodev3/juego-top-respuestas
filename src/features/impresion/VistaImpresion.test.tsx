// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { crearJuegoPorDefecto } from '@/shared/modelo';
import { RUTAS, rutaImpresion } from '@/shared/rutas';
import { sembrarBancoPrueba } from '@/test/bancoPrueba';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';

import { VistaImpresion } from './VistaImpresion';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

async function sembrar() {
  return sembrarBancoPrueba(entorno.repositorios, () => {
    entorno.reloj.avanzar();
  });
}

function renderizar(ruta: string) {
  const imprimir = vi.fn();
  const router = createMemoryRouter(
    [{ path: RUTAS.impresion, element: <VistaImpresion imprimir={imprimir} /> }],
    { initialEntries: [ruta] },
  );
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { router, imprimir, usuario: userEvent.setup() };
}

const HOJA = /^Hoja \d+ de \d+$/u;

describe('VistaImpresion', () => {
  it('shows a picker of sets (with counts) and saved games when there is no source', async () => {
    const { ciencias } = await sembrar();
    const juego = await entorno.repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Repaso final', preguntaIds: [] }),
    );
    const { usuario } = renderizar(RUTAS.impresion);

    expect(await screen.findByRole('link', { name: /Ciencias 2B/u })).toHaveAttribute(
      'href',
      rutaImpresion({ set: ciencias.id }),
    );
    expect(screen.getByRole('link', { name: /Historia/u })).toHaveAccessibleName(/3 preguntas/u);
    expect(screen.queryByRole('link', { name: /Vacío/u })).not.toBeInTheDocument();
    expect(screen.getByText('Este set no tiene preguntas.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Repaso final/u })).toHaveAttribute(
      'href',
      rutaImpresion({ juego: juego.id }),
    );
    expect(screen.queryByRole('region', { name: HOJA })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('link', { name: /Historia/u }));
    expect(await screen.findAllByRole('region', { name: HOJA })).toHaveLength(2);
  });

  it('renders one card per question of the set, two per sheet by default', async () => {
    const { ciencias } = await sembrar();
    renderizar(rutaImpresion({ set: ciencias.id }));

    const hojas = await screen.findAllByRole('region', { name: HOJA });
    expect(hojas.map((hoja) => hoja.getAttribute('aria-label'))).toEqual([
      'Hoja 1 de 3',
      'Hoja 2 de 3',
      'Hoja 3 de 3',
    ]);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByText('6 tarjetas en 3 hojas')).toBeInTheDocument();
    const primera = within(hojas[0] ?? document.body).getAllByRole('article')[0];
    expect(primera).toHaveAccessibleName('Pregunta 1');
    expect(within(primera ?? document.body).getByRole('heading')).toHaveTextContent(
      'Menciona un planeta',
    );
    expect(within(primera ?? document.body).getAllByRole('listitem')).toHaveLength(2);
  });

  it('switches to four cards per sheet and keeps the layout in the URL', async () => {
    const { ciencias } = await sembrar();
    const { router, usuario } = renderizar(rutaImpresion({ set: ciencias.id }));

    await usuario.click(await screen.findByRole('radio', { name: '4 por hoja' }));

    expect(await screen.findByText('6 tarjetas en 2 hojas')).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: HOJA })).toHaveLength(2);
    expect(router.state.location.search).toBe(`?set=${ciencias.id}&por-hoja=4`);
    expect(screen.getByRole('radio', { name: '4 por hoja' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Cambiar selección' })).toHaveAttribute(
      'href',
      rutaImpresion({ porHoja: 4 }),
    );
  });

  it('calls the injected print function from "Imprimir"', async () => {
    const { ciencias } = await sembrar();
    const { imprimir, usuario } = renderizar(rutaImpresion({ set: ciencias.id, porHoja: 4 }));

    await usuario.click(await screen.findByRole('button', { name: 'Imprimir' }));

    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it('prints a game in round order with multiplied points and a notice for a deleted question', async () => {
    const { ciencias } = await sembrar();
    const [p1, p2] = await entorno.repositorios.preguntas.listarPorSet(ciencias.id);
    const juego = await entorno.repositorios.juegos.crear({
      ...crearJuegoPorDefecto({ nombre: 'Repaso', preguntaIds: [] }),
      rondas: [
        { preguntaId: p1?.id ?? '', multiplicador: 2 },
        { preguntaId: p2?.id ?? '', multiplicador: 1 },
      ],
    });
    await entorno.repositorios.preguntas.eliminar(p2?.id ?? '');
    renderizar(rutaImpresion({ juego: juego.id }));

    const [ronda1, ronda2] = await screen.findAllByRole('article');
    expect(ronda1).toHaveAccessibleName('Ronda 1');
    expect(within(ronda1 ?? document.body).getByText('Puntos x2')).toBeInTheDocument();
    expect(within(ronda1 ?? document.body).getByText('60')).toBeInTheDocument();
    expect(ronda2).toHaveTextContent('La pregunta de la ronda 2 ya no está en el banco.');
    expect(screen.getByText('2 tarjetas en 1 hoja')).toBeInTheDocument();
  });

  it('explains a deleted set or an unknown game and shows the picker', async () => {
    const { ciencias } = await sembrar();
    await entorno.repositorios.sets.eliminar(ciencias.id);
    renderizar(rutaImpresion({ set: ciencias.id }));

    expect(
      await screen.findByText('No encontramos ese set. Puede que se haya eliminado; elige otro.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Historia/u })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Imprimir' })).not.toBeInTheDocument();
  });

  it('explains an unknown game', async () => {
    await sembrar();
    renderizar(rutaImpresion({ juego: 'no-existe' }));

    expect(
      await screen.findByText('No encontramos ese juego. Puede que se haya eliminado; elige otro.'),
    ).toBeInTheDocument();
  });
});
