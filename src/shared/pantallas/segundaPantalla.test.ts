import { describe, expect, it, vi } from 'vitest';

import {
  abrirTablero,
  crearGestorTablero,
  elegirPantallaProyector,
  NOMBRE_VENTANA_TABLERO,
  type DetallesPantallas,
  type EntornoVentanas,
  type PantallaDetallada,
  type VentanaTablero,
} from './segundaPantalla';

function pantalla(cambios: Partial<PantallaDetallada> = {}): PantallaDetallada {
  return {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1040,
    isPrimary: true,
    ...cambios,
  };
}

const LAPTOP = pantalla({ label: 'Laptop' });
const PROYECTOR = pantalla({
  label: 'Proyector',
  isPrimary: false,
  left: 1920,
  availLeft: 1920,
  availTop: 10,
  availWidth: 1280,
  availHeight: 720,
});

function ventana(focus: () => void = vi.fn()): VentanaTablero {
  return { closed: false, focus };
}

function entorno(
  opciones: {
    detalles?: () => Promise<DetallesPantallas>;
    abrir?: (caracteristicas: string | undefined) => VentanaTablero | null;
  } = {},
) {
  const open = vi.fn(
    (_url: string, _destino: string, caracteristicas?: string): VentanaTablero | null =>
      opciones.abrir ? opciones.abrir(caracteristicas) : ventana(),
  );
  const resultado: EntornoVentanas = { open };
  if (opciones.detalles) {
    resultado.getScreenDetails = opciones.detalles;
  }
  return { entorno: resultado, open };
}

describe('elegirPantallaProyector', () => {
  it('picks a non-primary screen, preferring one other than the current', () => {
    const otraSecundaria = pantalla({ isPrimary: false, label: 'Otra' });

    expect(elegirPantallaProyector([LAPTOP, PROYECTOR], LAPTOP)).toBe(PROYECTOR);
    expect(elegirPantallaProyector([otraSecundaria, PROYECTOR], otraSecundaria)).toBe(PROYECTOR);
    expect(elegirPantallaProyector([PROYECTOR, LAPTOP])).toBe(PROYECTOR);
  });

  it('returns null with a single screen or none', () => {
    expect(elegirPantallaProyector([LAPTOP], LAPTOP)).toBeNull();
    expect(elegirPantallaProyector([])).toBeNull();
  });
});

describe('abrirTablero', () => {
  it('opens a popup at the bounds of the projector screen when the API is available', async () => {
    const { entorno: env, open } = entorno({
      detalles: () => Promise.resolve({ screens: [LAPTOP, PROYECTOR], currentScreen: LAPTOP }),
    });

    const resultado = await abrirTablero('/tablero', env);

    expect(open).toHaveBeenCalledWith(
      '/tablero',
      NOMBRE_VENTANA_TABLERO,
      'popup,left=1920,top=10,width=1280,height=720',
    );
    expect(resultado).toMatchObject({ modo: 'segundaPantalla', requiereInstrucciones: false });
  });

  it.each([
    ['the API is missing', undefined],
    ['permission is denied', () => Promise.reject(new DOMException('denied', 'NotAllowedError'))],
    [
      'there is a single screen',
      () => Promise.resolve({ screens: [LAPTOP], currentScreen: LAPTOP }),
    ],
  ])('falls back to a normal window with instructions when %s', async (_caso, detalles) => {
    const { entorno: env, open } = entorno(detalles ? { detalles } : {});

    const resultado = await abrirTablero('/tablero', env);

    expect(open).toHaveBeenCalledWith('/tablero', NOMBRE_VENTANA_TABLERO);
    expect(resultado).toMatchObject({ modo: 'ventanaNormal', requiereInstrucciones: true });
  });

  it('falls back to a normal window when the positioned popup is blocked', async () => {
    const { entorno: env, open } = entorno({
      detalles: () => Promise.resolve({ screens: [LAPTOP, PROYECTOR], currentScreen: LAPTOP }),
      abrir: (caracteristicas) => (caracteristicas === undefined ? ventana() : null),
    });

    const resultado = await abrirTablero('/tablero', env);

    expect(open).toHaveBeenCalledTimes(2);
    expect(resultado).toMatchObject({ modo: 'ventanaNormal', requiereInstrucciones: true });
  });

  it('reports a blocked window when nothing can be opened', async () => {
    const { entorno: env } = entorno({ abrir: () => null });

    expect(await abrirTablero('/tablero', env)).toEqual({ modo: 'bloqueado' });
  });
});

describe('crearGestorTablero', () => {
  it('re-focuses the open board on reconnect and reopens it once closed', async () => {
    const focus = vi.fn();
    const abierta = ventana(focus);
    const { entorno: env, open } = entorno({ abrir: () => abierta });
    const gestor = crearGestorTablero(env);

    expect(await gestor.reconectar('/tablero')).toMatchObject({ modo: 'ventanaNormal' });
    expect(await gestor.reconectar('/tablero')).toEqual({
      modo: 'enfocada',
      ventana: abierta,
      requiereInstrucciones: false,
    });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);

    abierta.closed = true;
    await gestor.reconectar('/tablero');

    expect(open).toHaveBeenCalledTimes(2);
  });

  it('remembers the window opened through abrir', async () => {
    const abierta = ventana();
    const gestor = crearGestorTablero(entorno({ abrir: () => abierta }).entorno);

    expect(gestor.ventana()).toBeNull();
    await gestor.abrir('/tablero');

    expect(gestor.ventana()).toBe(abierta);
  });
});
