// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import type { Repositorios } from '@/db/repositorios';
import type { DatosPregunta } from '@/shared/modelo';
import { crearRepositoriosDexie } from '@/db/repositoriosDexie';
import {
  crearBaseDatosPrueba,
  crearEntornoPrueba,
  crearGeneradorIdsPrueba,
  crearRelojPrueba,
} from '@/test/baseDatosPrueba';

import { serializarRespaldo } from './dominio';
import { VistaRespaldos } from './VistaRespaldos';

type Entorno = ReturnType<typeof crearEntornoPrueba>;

let entorno: Entorno;

beforeEach(() => {
  entorno = crearEntornoPrueba();
});

afterEach(() => {
  entorno.db.close();
});

function pregunta(texto: string): DatosPregunta {
  return {
    texto,
    tema: 'Tema',
    respuestas: [
      { texto: 'A', puntos: 30, sinonimos: [] },
      { texto: 'B', puntos: 20, sinonimos: [] },
    ],
  };
}

/** A backup file made from a second database that has one set and two questions. */
async function archivoDeRespaldo(): Promise<File> {
  // Own id prefix: the file must not share ids with the test database.
  const db = crearBaseDatosPrueba();
  const reloj = crearRelojPrueba();
  const origen = {
    db,
    repositorios: crearRepositoriosDexie(db, {
      ahora: reloj.ahora,
      generarId: crearGeneradorIdsPrueba('archivo'),
    }),
  };
  const set = await origen.repositorios.sets.crear({
    nombre: 'Del archivo',
    materia: '',
    grupo: '',
  });
  await origen.repositorios.preguntas.crear(set.id, pregunta('Uno'));
  await origen.repositorios.preguntas.crear(set.id, pregunta('Dos'));
  const respaldo = await origen.repositorios.respaldos.exportar();
  origen.db.close();
  return new File([serializarRespaldo(respaldo)], 'respaldo.json', { type: 'application/json' });
}

function renderizar(
  props: Partial<Parameters<typeof VistaRespaldos>[0]> = {},
  repositorios: Repositorios = entorno.repositorios,
) {
  const descargar = vi.fn();
  const usuario = userEvent.setup();
  render(
    <RepositoriosProvider repositorios={repositorios}>
      <VistaRespaldos
        descargar={descargar}
        ahora={() => new Date(2026, 9, 5).getTime()}
        {...props}
      />
    </RepositoriosProvider>,
  );
  return { descargar, usuario };
}

async function elegirArchivo(usuario: ReturnType<typeof userEvent.setup>, archivo: File) {
  await usuario.upload(screen.getByLabelText('Archivo de respaldo'), archivo);
}

async function nombresDeSets(): Promise<string[]> {
  return (await entorno.repositorios.sets.listar()).map((set) => set.nombre);
}

describe('VistaRespaldos', () => {
  it('exports every record as a dated JSON file', async () => {
    const set = await entorno.repositorios.sets.crear({ nombre: 'Mi set', materia: '', grupo: '' });
    await entorno.repositorios.preguntas.crear(set.id, pregunta('Uno'));
    const { descargar, usuario } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Descargar respaldo' }));

    await waitFor(() => {
      expect(descargar).toHaveBeenCalledTimes(1);
    });
    const [blob, nombre] = descargar.mock.calls[0] as [Blob, string];
    expect(nombre).toBe('top-respuestas-respaldo-2026-10-05.json');
    const contenido = JSON.parse(await blob.text()) as { app: string; datos: { sets: unknown[] } };
    expect(contenido.app).toBe('top-respuestas');
    expect(contenido.datos.sets).toHaveLength(1);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Respaldo descargado (1 set, 1 pregunta, 0 juegos, 0 partidas).',
    );
  });

  it('shows a friendly error when the export fails', async () => {
    const { usuario } = renderizar(
      {},
      {
        ...entorno.repositorios,
        respaldos: {
          ...entorno.repositorios.respaldos,
          exportar: () => Promise.reject(new Error('boom')),
        },
      },
    );

    await usuario.click(screen.getByRole('button', { name: 'Descargar respaldo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo crear el respaldo. Intenta de nuevo.',
    );
  });

  it('previews a valid file and merges it by default', async () => {
    await entorno.repositorios.sets.crear({ nombre: 'Local', materia: '', grupo: '' });
    const { usuario } = renderizar();

    await elegirArchivo(usuario, await archivoDeRespaldo());

    expect(await screen.findByText(/respaldo\.json/)).toBeInTheDocument();
    expect(screen.getByText(/1 set, 2 preguntas, 0 juegos, 0 partidas/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Combinar/ })).toBeChecked();

    await usuario.click(screen.getByRole('button', { name: 'Restaurar respaldo' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo: se combinó el respaldo con tus datos. Nuevos: 3. Actualizados: 0. Sin cambios: 0.',
    );
    expect(await nombresDeSets()).toEqual(['Del archivo', 'Local']);
    expect(screen.queryByRole('button', { name: 'Restaurar respaldo' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before replacing and keeps the data on cancel', async () => {
    await entorno.repositorios.sets.crear({ nombre: 'Local', materia: '', grupo: '' });
    const { usuario } = renderizar();
    await elegirArchivo(usuario, await archivoDeRespaldo());
    await usuario.click(await screen.findByRole('radio', { name: /Reemplazar/ }));

    await usuario.click(screen.getByRole('button', { name: 'Restaurar respaldo' }));
    const dialogo = await screen.findByRole('dialog', { name: /Reemplazar todos tus datos/ });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    expect(await nombresDeSets()).toEqual(['Local']);
    expect(screen.getByRole('button', { name: 'Restaurar respaldo' })).toBeInTheDocument();
  });

  it('replaces everything after confirming', async () => {
    await entorno.repositorios.sets.crear({ nombre: 'Local', materia: '', grupo: '' });
    const { usuario } = renderizar();
    await elegirArchivo(usuario, await archivoDeRespaldo());
    await usuario.click(await screen.findByRole('radio', { name: /Reemplazar/ }));

    await usuario.click(screen.getByRole('button', { name: 'Restaurar respaldo' }));
    const dialogo = await screen.findByRole('dialog', { name: /Reemplazar todos tus datos/ });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Reemplazar datos' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo: se reemplazaron tus datos con el respaldo (1 set, 2 preguntas, 0 juegos, 0 partidas).',
    );
    expect(await nombresDeSets()).toEqual(['Del archivo']);
  });

  it('rejects a file that is not a backup and writes nothing', async () => {
    const { usuario } = renderizar();

    await elegirArchivo(
      usuario,
      new File(['{"hola":1}'], 'otro.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '«otro.json»: Este archivo no es un respaldo de Top Respuestas.',
    );
    expect(screen.queryByRole('button', { name: 'Restaurar respaldo' })).not.toBeInTheDocument();
    expect(await nombresDeSets()).toEqual([]);
  });

  it('keeps the preview and explains when the restore itself fails', async () => {
    const { usuario } = renderizar(
      {},
      {
        ...entorno.repositorios,
        respaldos: {
          ...entorno.repositorios.respaldos,
          restaurar: () => Promise.reject(new Error('boom')),
        },
      },
    );
    await elegirArchivo(usuario, await archivoDeRespaldo());

    await usuario.click(await screen.findByRole('button', { name: 'Restaurar respaldo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo restaurar el respaldo. No se cambió ningún dato.',
    );
    expect(screen.getByRole('button', { name: 'Restaurar respaldo' })).toBeEnabled();
  });

  it('lets the user discard the chosen file', async () => {
    const { usuario } = renderizar();
    await elegirArchivo(usuario, await archivoDeRespaldo());

    await usuario.click(await screen.findByRole('button', { name: 'Elegir otro archivo' }));

    expect(screen.queryByRole('button', { name: 'Restaurar respaldo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir archivo' })).toBeInTheDocument();
  });
});
