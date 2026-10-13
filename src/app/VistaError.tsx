import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { RUTAS } from '@/shared/rutas';

interface VistaErrorProps {
  /** Forces the "not found" message (used by the catch-all route). */
  noEncontrada?: boolean;
}

/** Friendly Spanish error and 404 view. */
export function VistaError({ noEncontrada = false }: VistaErrorProps) {
  const error = useRouteError();
  const esNoEncontrada = noEncontrada || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <section
      role="alert"
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-3xl font-bold">
        {esNoEncontrada ? 'Página no encontrada' : 'Algo salió mal'}
      </h1>
      <p className="text-lg text-slate-700">
        {esNoEncontrada
          ? 'La dirección que abriste no existe.'
          : 'Ocurrió un error inesperado. Tus datos guardados no se perdieron.'}
      </p>
      <Link
        to={RUTAS.inicio}
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
