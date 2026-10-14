// Test-only harness for the conductor panel: injected repositories, in-memory board channel,
// fake windows and a manual timer clock.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, vi } from 'vitest';

import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import type { Repositorios } from '@/db/repositorios';
import type { VistaTablero } from '@/engine';
import type { EntornoVentanas } from '@/shared/pantallas';
import { RUTAS, rutaPanel } from '@/shared/rutas';
import { crearCanal, type MensajeEstadoTablero, type MensajeSync } from '@/shared/sync';
import { CanalSyncProvider } from '@/shared/sync';
import { crearBusMemoria } from '@/test/transporteMemoria';

import { VistaPanel } from '../VistaPanel';
import type { RelojTemporizador } from './useTemporizador';

/** Manual clock: `avanzar` moves time and runs the scheduled timer ticks. */
export function crearRelojManual(inicio = 5_000_000) {
  let actual = inicio;
  const tareas = new Set<() => void>();
  const reloj: RelojTemporizador = {
    ahora: () => actual,
    programar(tarea) {
      tareas.add(tarea);
      return () => {
        tareas.delete(tarea);
      };
    },
  };
  return {
    reloj,
    avanzar(ms: number) {
      act(() => {
        actual += ms;
        for (const tarea of [...tareas]) {
          tarea();
        }
      });
    },
  };
}

/** Fake `window` for opening the board: no Window Management API, popups allowed by default. */
export function crearVentanasFalsas(bloqueado = false) {
  const open = vi.fn(() => (bloqueado ? null : { closed: false, focus: vi.fn() }));
  const entorno: EntornoVentanas = { open };
  return { entorno, open };
}

export interface OpcionesPanel {
  repositorios: Repositorios;
  partidaId: string;
  bus?: ReturnType<typeof crearBusMemoria>;
  ventanas?: ReturnType<typeof crearVentanasFalsas>;
  reloj?: ReturnType<typeof crearRelojManual>;
  /** Initial path; defaults to the partida's panel. */
  ruta?: string;
}

export function renderizarPanel({
  repositorios,
  partidaId,
  bus = crearBusMemoria(),
  ventanas = crearVentanasFalsas(),
  reloj = crearRelojManual(),
  ruta = rutaPanel(partidaId),
}: OpcionesPanel) {
  const vista = <VistaPanel entornoVentanas={ventanas.entorno} relojTemporizador={reloj.reloj} />;
  const router = createMemoryRouter(
    [
      { path: RUTAS.inicio, element: <p>Pantalla de inicio</p> },
      { path: RUTAS.panel, element: vista },
      { path: RUTAS.panelPartida, element: vista },
    ],
    { initialEntries: [ruta] },
  );
  const resultado = render(
    <RepositoriosProvider repositorios={repositorios}>
      <CanalSyncProvider canal={crearCanal(bus.crearTransporte())}>
        <RouterProvider router={router} />
      </CanalSyncProvider>
    </RepositoriosProvider>,
  );
  return { ...resultado, bus, ventanas, reloj, router, usuario: userEvent.setup() };
}

/** The action button, once it is enabled (the previous action finished saving). */
export async function botonHabilitado(nombre: string | RegExp): Promise<HTMLElement> {
  await screen.findByRole('button', { name: nombre });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: nombre })).toHaveAttribute('aria-disabled', 'false');
  });
  return screen.getByRole('button', { name: nombre });
}

/** Board views published over the fake channel, in order. */
export function vistasPublicadas(bus: ReturnType<typeof crearBusMemoria>): MensajeEstadoTablero[] {
  return bus.enviados
    .map((mensaje) => mensaje as MensajeSync)
    .filter((mensaje): mensaje is MensajeEstadoTablero => mensaje.tipo === 'ESTADO_TABLERO');
}

export function ultimaVista(bus: ReturnType<typeof crearBusMemoria>): VistaTablero | undefined {
  return vistasPublicadas(bus).at(-1)?.vista;
}
