// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Repositorios } from '@/db/repositorios';
import type { ConfigPartida, Evento } from '@/engine';
import { CLAVE_SILENCIO } from '@/shared/sonido';
import { crearEntornoPrueba } from '@/test/baseDatosPrueba';
import { configPrueba } from '@/test/fabricasPartida';

import {
  botonHabilitado,
  crearAlmacenamientoMemoria,
  crearSonidosFalsos,
  renderizarPanel,
} from './pruebaPanel';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

const EN_JUEGO: Evento[] = [
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 0 },
  { tipo: 'JUGAR' },
];

async function crearPartida(eventos: Evento[] = [], config: ConfigPartida = configPrueba()) {
  const partida = await entorno.repositorios.partidas.crear({ juegoId: 'juego-1', config });
  for (const evento of eventos) {
    await entorno.repositorios.partidas.agregarEvento(partida.id, evento);
  }
  return partida.id;
}

async function eventosGuardados(id: string): Promise<Evento[]> {
  return (await entorno.repositorios.partidas.obtener(id))?.eventos ?? [];
}

type Usuario = ReturnType<typeof renderizarPanel>['usuario'];

async function pulsar(usuario: Usuario, nombre: string) {
  await usuario.click(await botonHabilitado(nombre));
}

/** Waits until the saved log has `cantidad` events and the panel accepts actions again. */
async function esperarGuardado(id: string, cantidad: number) {
  await waitFor(async () => {
    expect(await eventosGuardados(id)).toHaveLength(cantidad);
  });
  await botonHabilitado('Deshacer');
}

describe('Panel sounds', () => {
  it('plays one sound per saved action and nothing for a loaded log or silent actions', async () => {
    const id = await crearPartida(EN_JUEGO);
    const { usuario, sonidos } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });
    await screen.findByRole('heading', { name: 'Juego de prueba' });
    expect(sonidos.reproducidos).toEqual([]);

    await pulsar(usuario, 'Revelar la respuesta 2');
    await esperarGuardado(id, 4);
    expect(sonidos.reproducidos).toEqual(['acierto']);

    await pulsar(usuario, 'Tache');
    await esperarGuardado(id, 5);
    expect(sonidos.reproducidos).toEqual(['acierto', 'tache']);
  });

  it('plays nothing on undo', async () => {
    const id = await crearPartida(EN_JUEGO);
    const { usuario, sonidos } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });

    await pulsar(usuario, 'Deshacer');
    await esperarGuardado(id, 2);
    expect(sonidos.reproducidos).toEqual([]);
  });

  it('plays nothing when the action cannot be saved', async () => {
    const id = await crearPartida(EN_JUEGO);
    const repositorios: Repositorios = {
      ...entorno.repositorios,
      partidas: {
        ...entorno.repositorios.partidas,
        agregarEvento: vi.fn(() => Promise.reject(new Error('disco lleno'))),
      },
    };
    const { usuario, sonidos } = renderizarPanel({ repositorios, partidaId: id });

    await pulsar(usuario, 'Revelar la respuesta 2');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la acción.');
    expect(sonidos.reproducidos).toEqual([]);
  });

  it('plays ganador when the host confirms the end of the game', async () => {
    const id = await crearPartida(EN_JUEGO);
    const { usuario, sonidos } = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
    });

    await pulsar(usuario, 'Terminar partida');
    const dialogo = await screen.findByRole('dialog', { name: '¿Terminar la partida?' });
    expect(sonidos.reproducidos).toEqual([]);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Terminar partida' }));

    await waitFor(() => {
      expect(sonidos.reproducidos).toEqual(['ganador']);
    });
  });

  it('mutes from the header and remembers the choice after a reload', async () => {
    const id = await crearPartida(EN_JUEGO);
    const { datos, almacenamiento } = crearAlmacenamientoMemoria();
    const primera = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      sonidos: crearSonidosFalsos(almacenamiento),
    });
    const silenciar = await screen.findByRole('button', { name: 'Silenciar sonido' });
    expect(silenciar).toHaveAttribute('aria-pressed', 'false');

    await primera.usuario.click(silenciar);
    expect(silenciar).toHaveAttribute('aria-pressed', 'true');
    expect(datos.get(CLAVE_SILENCIO)).toBe('true');

    await pulsar(primera.usuario, 'Tache');
    await esperarGuardado(id, 4);
    expect(primera.sonidos.reproducidos).toEqual([]);
    primera.unmount();

    const segunda = renderizarPanel({
      repositorios: entorno.repositorios,
      partidaId: id,
      sonidos: crearSonidosFalsos(almacenamiento),
    });
    const tras = await screen.findByRole('button', { name: 'Silenciar sonido' });
    expect(tras).toHaveAttribute('aria-pressed', 'true');

    await segunda.usuario.click(tras);
    expect(tras).toHaveAttribute('aria-pressed', 'false');
    await pulsar(segunda.usuario, 'Tache');
    await esperarGuardado(id, 5);
    expect(segunda.sonidos.reproducidos).toEqual(['tache']);
  });
});
