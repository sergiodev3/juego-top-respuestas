/** Shared Tailwind class sets so controls look and behave the same across views. */

const BOTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const CLASE_BOTON_PRIMARIO = `${BOTON_BASE} bg-slate-900 text-white hover:bg-slate-700`;

export const CLASE_BOTON_SECUNDARIO = `${BOTON_BASE} border border-slate-400 bg-white text-slate-900 hover:bg-slate-100`;

export const CLASE_BOTON_PELIGRO = `${BOTON_BASE} bg-red-700 text-white hover:bg-red-800`;

/** Small text-like button for list actions. */
export const CLASE_BOTON_ACCION =
  'rounded-md px-2 py-1 text-sm font-medium text-slate-800 underline-offset-2 hover:bg-slate-100 hover:underline';

export const CLASE_BOTON_ACCION_PELIGRO =
  'rounded-md px-2 py-1 text-sm font-medium text-red-800 underline-offset-2 hover:bg-red-50 hover:underline';

export const CLASE_CAMPO =
  'block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 aria-invalid:border-red-700';

export const CLASE_ETIQUETA = 'block text-sm font-semibold text-slate-800';

export const CLASE_ERROR_CAMPO = 'mt-1 text-sm font-medium text-red-800';
