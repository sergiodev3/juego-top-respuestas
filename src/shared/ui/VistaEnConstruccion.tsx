import type { ReactNode } from 'react';

interface VistaEnConstruccionProps {
  titulo: string;
  descripcion: string;
  children?: ReactNode;
}

/** Placeholder layout for views that will be implemented in later phases. */
export function VistaEnConstruccion({ titulo, descripcion, children }: VistaEnConstruccionProps) {
  return (
    <section aria-labelledby="titulo-vista" className="mx-auto max-w-4xl space-y-4">
      <h1 id="titulo-vista" className="text-3xl font-bold tracking-tight">
        {titulo}
      </h1>
      <p className="text-lg text-slate-700">{descripcion}</p>
      <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-slate-600">
        Esta sección estará disponible en una próxima fase.
      </p>
      {children}
    </section>
  );
}
