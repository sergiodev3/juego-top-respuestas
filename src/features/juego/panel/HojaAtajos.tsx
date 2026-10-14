import type { ReactNode } from 'react';

import { DialogoInformacion } from '@/shared/ui/DialogoInformacion';

interface Atajo {
  teclas: readonly string[];
  descripcion: string;
}

const RONDA: readonly Atajo[] = [
  {
    teclas: ['1', '…', '8'],
    descripcion: 'Revelar la respuesta con ese número (durante el robo, es un robo exitoso).',
  },
  { teclas: ['X'], descripcion: 'Marcar tache (durante el robo, «Robo fallido»).' },
  {
    teclas: ['A', 'B', 'C', 'D'],
    descripcion: 'Dar el turno al equipo con esa letra (el que presionó primero).',
  },
  { teclas: ['R'], descripcion: 'Revelar todas las respuestas al final de la ronda.' },
  {
    teclas: ['Espacio'],
    descripcion:
      'Siguiente paso: «Jugar» cuando el ganador del cara a cara decide jugar, o pasar a la siguiente ronda.',
  },
];

const SIEMPRE: readonly Atajo[] = [
  { teclas: ['Z'], descripcion: 'Deshacer la última acción.' },
  { teclas: ['M'], descripcion: 'Silenciar o activar el sonido.' },
  { teclas: ['?'], descripcion: 'Mostrar u ocultar esta lista de atajos.' },
];

const RONDA_FINAL: readonly Atajo[] = [
  { teclas: ['Espacio'], descripcion: 'Iniciar o pausar el tiempo del jugador.' },
];

function Teclas({ teclas }: { teclas: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {teclas.map((tecla) =>
        tecla === '…' ? (
          <span key={tecla} aria-hidden="true">
            …
          </span>
        ) : (
          <kbd
            key={tecla}
            className="min-w-7 rounded border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-center font-mono text-sm font-semibold text-slate-900"
          >
            {tecla}
          </kbd>
        ),
      )}
    </span>
  );
}

function Seccion({
  titulo,
  atajos,
  children,
}: {
  titulo: string;
  atajos: readonly Atajo[];
  children?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-slate-900">{titulo}</h3>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
        {atajos.map((atajo) => (
          <div key={atajo.descripcion} className="contents">
            <dt>
              <Teclas teclas={atajo.teclas} />
            </dt>
            <dd>{atajo.descripcion}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

interface HojaAtajosProps {
  abierta: boolean;
  onCerrar: () => void;
}

/** Help sheet listing every panel shortcut (header button or `?`). */
export function HojaAtajos({ abierta, onCerrar }: HojaAtajosProps) {
  return (
    <DialogoInformacion
      abierto={abierta}
      titulo="Atajos de teclado"
      textoCerrar="Cerrar"
      onCerrar={onCerrar}
    >
      <div className="space-y-4 text-sm">
        <Seccion titulo="Durante una ronda" atajos={RONDA} />
        <Seccion titulo="En cualquier momento" atajos={SIEMPRE} />
        <Seccion titulo="Ronda final" atajos={RONDA_FINAL}>
          <p>
            Las respuestas se registran con el campo de texto y la lista de coincidencias; los
            números, <kbd>X</kbd>, <kbd>A</kbd>–<kbd>D</kbd> y <kbd>R</kbd> no hacen nada.
          </p>
        </Seccion>
        <p className="border-t border-slate-200 pt-3">
          Los atajos no funcionan mientras escribe en un campo ni con un diálogo abierto. La barra
          espaciadora no activa el botón enfocado; para eso use <kbd>Enter</kbd>.
        </p>
      </div>
    </DialogoInformacion>
  );
}
