// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { crearJuegoPorDefecto } from '@/shared/modelo';
import { RUTAS, rutaConfigurarJuego } from '@/shared/rutas';
import { datosPreguntaPrueba, PREGUNTAS_CIENCIAS, sembrarBancoPrueba } from '@/test/bancoPrueba';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

import { VistaConfigurarJuego } from './VistaConfigurarJuego';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

/** Fake RNG: always takes the first remaining candidate. */
const primero = () => 0;

function PanelPrueba() {
  const { partidaId } = useParams();
  return <p>Panel {partidaId}</p>;
}

function renderizar(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: RUTAS.configurarJuego, element: <VistaConfigurarJuego aleatorio={primero} /> },
      {
        path: RUTAS.configurarJuegoGuardado,
        element: <VistaConfigurarJuego aleatorio={primero} />,
      },
      { path: RUTAS.panelPartida, element: <PanelPrueba /> },
    ],
    { initialEntries: [ruta] },
  );
  render(
    <RepositoriosProvider repositorios={entorno.repositorios}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return { usuario: userEvent.setup() };
}

function sembrar() {
  return sembrarBancoPrueba(entorno.repositorios, () => {
    entorno.reloj.avanzar();
  });
}

function itemsDe(nombreLista: string) {
  return within(screen.getByRole('list', { name: nombreLista })).queryAllByRole('listitem');
}

async function importarYJugar() {
  const { juego } = await entorno.repositorios.importacion.importarYJugar(
    { nombre: 'Repaso', materia: '', grupo: '' },
    ['Uno', 'Dos', 'Tres', 'Cuatro'].map((texto) => datosPreguntaPrueba(texto)),
  );
  return juego;
}

describe('VistaConfigurarJuego: new game', () => {
  it('starts with sensible defaults', async () => {
    renderizar(RUTAS.configurarJuego);

    expect(await screen.findByLabelText('Nombre del juego')).toHaveValue('Nuevo juego');
    expect(screen.getByLabelText('Nombre del equipo A')).toHaveValue('Equipo A');
    expect(screen.getByLabelText('Nombre del equipo B')).toHaveValue('Equipo B');
    expect(screen.getByLabelText('Tachas por ronda')).toHaveValue(3);
    expect(await screen.findByRole('checkbox', { name: 'Incluir ronda final' })).not.toBeChecked();
    expect(await screen.findByText('Todavía no hay juegos guardados.')).toBeInTheDocument();
  });

  it('adds and removes teams, always keeping between 2 and 4', async () => {
    const { usuario } = renderizar(RUTAS.configurarJuego);
    await screen.findByLabelText('Nombre del juego');

    expect(screen.getByRole('button', { name: 'Quitar el equipo A' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Agregar equipo' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar equipo' }));

    expect(screen.getByLabelText('Nombre del equipo D')).toHaveValue('Equipo D');
    expect(screen.getByRole('button', { name: 'Agregar equipo' })).toBeDisabled();
    const colores = ['A', 'B', 'C', 'D'].map((letra) =>
      within(screen.getByRole('group', { name: `Color del equipo ${letra}` }))
        .getByRole('radio', { checked: true })
        .getAttribute('value'),
    );
    expect(new Set(colores).size).toBe(4);

    await usuario.click(screen.getByRole('button', { name: 'Quitar el equipo C' }));
    expect(screen.getAllByLabelText(/^Nombre del equipo/u).map((campo) => campo.id)).toHaveLength(
      3,
    );
    expect(screen.getByRole('button', { name: 'Agregar equipo' })).toBeEnabled();
  });

  it('fills N rounds at random by tema without repeating questions', async () => {
    await sembrar();
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await usuario.click(await screen.findByRole('radio', { name: 'Por tema' }));
    await usuario.click(await screen.findByRole('checkbox', { name: /Ciencias/u }));
    await usuario.clear(screen.getByLabelText('Número de rondas'));
    await usuario.type(screen.getByLabelText('Número de rondas'), '3');
    await usuario.click(screen.getByRole('button', { name: 'Llenar rondas al azar' }));

    const rondas = itemsDe('Rondas');
    expect(rondas).toHaveLength(3);
    const textos = rondas.map((ronda) =>
      PREGUNTAS_CIENCIAS.find((texto) => ronda.textContent.includes(texto)),
    );
    expect(textos.every((texto) => texto !== undefined)).toBe(true);
    expect(new Set(textos).size).toBe(3);
  });

  it('adds a question by hand from the bank picker and then hides it there', async () => {
    await sembrar();
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await usuario.type(await screen.findByLabelText('Buscar preguntas'), 'VOLCAN');
    const agregar = await screen.findByRole('button', {
      name: 'Agregar «Menciona un volcán famoso» a las rondas',
    });
    await usuario.click(agregar);

    expect(itemsDe('Rondas').map((ronda) => ronda.textContent)).toEqual([
      expect.stringContaining('Menciona un volcán famoso'),
    ]);
    expect(agregar).not.toBeInTheDocument();
    expect(screen.getByText(/No se muestran las que ya están en el juego/u)).toBeInTheDocument();
  });

  it('blocks the start and lists the problems in Spanish', async () => {
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await usuario.clear(await screen.findByLabelText('Nombre del juego'));
    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir ronda final' }));
    await usuario.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Escribe el nombre del juego.');
    expect(aviso).toHaveTextContent('El juego necesita al menos una ronda.');
    expect(aviso).toHaveTextContent('La ronda final necesita exactamente 5 preguntas.');
    expect(await entorno.repositorios.juegos.listar()).toEqual([]);
    expect(await entorno.repositorios.partidas.obtenerEnCurso()).toBeUndefined();
  });

  it('fills rounds and the final round at random from sets and starts the partida', async () => {
    await sembrar();
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await usuario.click(await screen.findByRole('radio', { name: 'Aleatoria' }));
    await usuario.click(await screen.findByRole('checkbox', { name: /Ciencias 2B/u }));
    await usuario.click(screen.getByRole('checkbox', { name: /Historia/u }));
    await usuario.clear(screen.getByLabelText('Número de rondas'));
    await usuario.type(screen.getByLabelText('Número de rondas'), '2');
    await usuario.click(screen.getByRole('button', { name: 'Llenar rondas al azar' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir ronda final' }));
    await usuario.click(screen.getByRole('button', { name: 'Llenar ronda final al azar' }));

    expect(itemsDe('Rondas')).toHaveLength(2);
    expect(itemsDe('Preguntas de la ronda final')).toHaveLength(5);

    await usuario.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    const partida = await entorno.repositorios.partidas.obtenerEnCurso();
    const ids = [
      ...(partida?.config.rondas.map((ronda) => ronda.pregunta.id) ?? []),
      ...(partida?.config.rondaFinal?.preguntas.map((pregunta) => pregunta.id) ?? []),
    ];
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    expect(screen.getByText(`Panel ${partida?.id ?? ''}`)).toBeInTheDocument();
  });
});

describe('VistaConfigurarJuego: saved games', () => {
  it('opens an "Importar y jugar" game prefilled and confirms before replacing a partida in progress', async () => {
    const anterior = await entorno.repositorios.partidas.crear({
      juegoId: 'otro',
      config: configPrueba(),
    });
    const juego = await importarYJugar();
    const { usuario } = renderizar(rutaConfigurarJuego(juego.id));

    expect(await screen.findByDisplayValue('Repaso')).toBeInTheDocument();
    await expect.poll(() => itemsDe('Rondas').length).toBe(4);
    await usuario.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    const dialogo = await screen.findByRole('dialog', { name: '¿Iniciar una nueva partida?' });
    expect(dialogo).toHaveAccessibleDescription(
      'Hay una partida en curso. Si inicias una nueva, la anterior se dará por terminada.',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Iniciar nueva partida' }));

    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    const nueva = await entorno.repositorios.partidas.obtenerEnCurso();
    expect(nueva?.juegoId).toBe(juego.id);
    expect(nueva?.config.rondas.map((ronda) => ronda.multiplicador)).toEqual([1, 1, 2, 3]);
    expect((await entorno.repositorios.partidas.obtener(anterior.id))?.estado).toBe('terminada');
  });

  it('persists edits to a saved game', async () => {
    const juego = await importarYJugar();
    const [primera, segunda] = juego.rondas;
    const { usuario } = renderizar(rutaConfigurarJuego(juego.id));

    const nombre = await screen.findByDisplayValue('Repaso');
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Repaso final');
    await usuario.selectOptions(await screen.findByLabelText('Multiplicador de la ronda 1'), 'x3');
    await usuario.click(screen.getByRole('button', { name: 'Subir la ronda 2' }));
    await usuario.click(screen.getByRole('button', { name: 'Quitar la ronda 4' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar juego' }));

    expect(await screen.findByText('Juego guardado.')).toBeInTheDocument();
    const guardado = await entorno.repositorios.juegos.obtener(juego.id);
    expect(guardado?.nombre).toBe('Repaso final');
    expect(guardado?.rondas.slice(0, 2)).toEqual([
      { preguntaId: segunda?.preguntaId, multiplicador: 1 },
      { preguntaId: primera?.preguntaId, multiplicador: 3 },
    ]);
    expect(guardado?.rondas).toHaveLength(3);
  });

  it('lists saved games, most recent first, with Editar, Iniciar and Eliminar', async () => {
    const repaso = await importarYJugar();
    entorno.reloj.avanzar();
    await entorno.repositorios.juegos.crear(
      crearJuegoPorDefecto({ nombre: 'Otro', preguntaIds: repaso.rondas.map((r) => r.preguntaId) }),
    );
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await expect
      .poll(() => screen.queryAllByRole('link', { name: /^Editar el juego/u }).length)
      .toBe(2);
    expect(
      itemsDe('Juegos guardados').map((item) => within(item).getByRole('heading').textContent),
    ).toEqual(['Otro', 'Repaso']);
    expect(screen.getByRole('link', { name: 'Editar el juego Repaso' })).toHaveAttribute(
      'href',
      rutaConfigurarJuego(repaso.id),
    );

    await usuario.click(screen.getByRole('button', { name: 'Eliminar el juego Otro' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar el juego «Otro»?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar juego' }));
    await expect.poll(() => itemsDe('Juegos guardados').length).toBe(1);
    expect((await entorno.repositorios.juegos.listar()).map((j) => j.nombre)).toEqual(['Repaso']);

    await usuario.click(screen.getByRole('button', { name: 'Iniciar el juego Repaso' }));
    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    expect((await entorno.repositorios.partidas.obtenerEnCurso())?.juegoId).toBe(repaso.id);
  });

  it('says when the game does not exist', async () => {
    renderizar(rutaConfigurarJuego('no-existe'));

    expect(await screen.findByText('No se encontró el juego solicitado.')).toBeInTheDocument();
  });
});

describe('VistaConfigurarJuego: robustness', () => {
  it('never creates duplicate games when save and start are triggered again before re-render', async () => {
    await sembrar();
    const { usuario } = renderizar(RUTAS.configurarJuego);
    await usuario.click(await screen.findByRole('radio', { name: 'Aleatoria' }));
    await usuario.click(await screen.findByRole('checkbox', { name: /Historia/u }));
    await usuario.click(screen.getByRole('button', { name: 'Llenar rondas al azar' }));
    const formulario = screen.getByRole('form', { name: 'Nuevo juego' });

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    await expect.poll(() => screen.queryByText('Juego guardado.')).not.toBeNull();
    expect(await entorno.repositorios.juegos.listar()).toHaveLength(1);
  });

  it('clears the final-round questions when the final round is turned off', async () => {
    await sembrar();
    const { usuario } = renderizar(RUTAS.configurarJuego);

    await usuario.click(await screen.findByRole('radio', { name: 'Aleatoria' }));
    await usuario.click(await screen.findByRole('checkbox', { name: /Ciencias 2B/u }));
    await usuario.click(screen.getByRole('checkbox', { name: /Historia/u }));
    await usuario.click(screen.getByRole('button', { name: 'Llenar rondas al azar' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir ronda final' }));
    await usuario.click(screen.getByRole('button', { name: 'Llenar ronda final al azar' }));
    expect(itemsDe('Preguntas de la ronda final')).toHaveLength(5);

    await usuario.click(screen.getByRole('checkbox', { name: 'Incluir ronda final' }));
    await usuario.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    expect(await screen.findByText(/^Panel /u)).toBeInTheDocument();
    const [guardado] = await entorno.repositorios.juegos.listar();
    expect(guardado?.reglas.rondaFinal).toMatchObject({ activa: false, preguntaIds: [] });
    expect((await entorno.repositorios.partidas.obtenerEnCurso())?.config.rondaFinal).toBeNull();
  });
});
