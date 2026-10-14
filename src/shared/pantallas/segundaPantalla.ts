/**
 * Opens the projector board on the second screen. The Window Management API
 * (`getScreenDetails`, Chromium only, asks for permission) lets us place a popup on the
 * projector; everywhere else we open a normal window and the host drags it over.
 * Fullscreen always needs one click inside the board window (browser rule).
 */

/** The subset of the Window Management API's `ScreenDetailed` we use (not in lib.dom yet). */
export interface PantallaDetallada {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly availLeft: number;
  readonly availTop: number;
  readonly availWidth: number;
  readonly availHeight: number;
  readonly isPrimary: boolean;
  readonly label?: string;
}

export interface DetallesPantallas {
  readonly screens: readonly PantallaDetallada[];
  readonly currentScreen: PantallaDetallada;
}

/** What we need from an opened window. */
export interface VentanaTablero {
  closed: boolean;
  focus(): void;
}

/** What we need from `window` (injectable for tests). */
export interface EntornoVentanas {
  open(url: string, destino: string, caracteristicas?: string): VentanaTablero | null;
  getScreenDetails?: () => Promise<DetallesPantallas>;
}

export type ResultadoAbrirTablero =
  | {
      readonly modo: 'segundaPantalla';
      readonly ventana: VentanaTablero;
      readonly requiereInstrucciones: false;
    }
  | {
      readonly modo: 'ventanaNormal';
      readonly ventana: VentanaTablero;
      readonly requiereInstrucciones: true;
    }
  | { readonly modo: 'bloqueado' };

export type ResultadoReconectarTablero =
  | ResultadoAbrirTablero
  | {
      readonly modo: 'enfocada';
      readonly ventana: VentanaTablero;
      readonly requiereInstrucciones: false;
    };

/** Window name: opening again with the same name reuses the board window. */
export const NOMBRE_VENTANA_TABLERO = 'top-respuestas-tablero';

/**
 * Picks the projector: a non-primary screen, preferring one that is not the panel's current
 * screen. `null` when there is only one screen.
 */
export function elegirPantallaProyector(
  pantallas: readonly PantallaDetallada[],
  actual?: PantallaDetallada,
): PantallaDetallada | null {
  const secundarias = pantallas.filter((pantalla) => !pantalla.isPrimary);
  return secundarias.find((pantalla) => pantalla !== actual) ?? secundarias[0] ?? null;
}

/** `null` when the API is missing, permission is denied, or there is no second screen. */
async function buscarProyector(entorno: EntornoVentanas): Promise<PantallaDetallada | null> {
  if (typeof entorno.getScreenDetails !== 'function') {
    return null;
  }
  try {
    const detalles = await entorno.getScreenDetails();
    return elegirPantallaProyector(detalles.screens, detalles.currentScreen);
  } catch {
    return null;
  }
}

/**
 * Opens (or reuses) the board window. Call it from a click handler: the permission prompt and
 * the popup both need the user gesture. `ventanaNormal` means the host must drag the window to
 * the projector (show instructions); `bloqueado` means the browser blocked the popup.
 */
export async function abrirTablero(
  url: string,
  entorno: EntornoVentanas = window,
): Promise<ResultadoAbrirTablero> {
  const proyector = await buscarProyector(entorno);
  if (proyector !== null) {
    const posicion = [
      `left=${String(proyector.availLeft)}`,
      `top=${String(proyector.availTop)}`,
      `width=${String(proyector.availWidth)}`,
      `height=${String(proyector.availHeight)}`,
    ].join(',');
    const ventana = entorno.open(url, NOMBRE_VENTANA_TABLERO, `popup,${posicion}`);
    if (ventana !== null) {
      return { modo: 'segundaPantalla', ventana, requiereInstrucciones: false };
    }
  }
  const ventana = entorno.open(url, NOMBRE_VENTANA_TABLERO);
  return ventana === null
    ? { modo: 'bloqueado' }
    : { modo: 'ventanaNormal', ventana, requiereInstrucciones: true };
}

/**
 * Keeps the board window reference for "Abrir tablero" / "Reconectar tablero". `reconectar`
 * focuses the board when it is still open (it then asks the panel for the state on its own)
 * and opens it again otherwise.
 */
export function crearGestorTablero(entorno: EntornoVentanas = window) {
  let ventana: VentanaTablero | null = null;

  async function abrir(url: string): Promise<ResultadoAbrirTablero> {
    const resultado = await abrirTablero(url, entorno);
    if (resultado.modo !== 'bloqueado') {
      ventana = resultado.ventana;
    }
    return resultado;
  }

  return {
    abrir,
    async reconectar(url: string): Promise<ResultadoReconectarTablero> {
      if (ventana !== null && !ventana.closed) {
        ventana.focus();
        return { modo: 'enfocada', ventana, requiereInstrucciones: false };
      }
      return abrir(url);
    },
    ventana: (): VentanaTablero | null => ventana,
  };
}

export type GestorTablero = ReturnType<typeof crearGestorTablero>;
