import { useId, useState, type SubmitEvent } from 'react';

import {
  esquemaDatosSet,
  MAX_GRUPO,
  MAX_MATERIA,
  MAX_NOMBRE_SET,
  type DatosSet,
} from '@/shared/modelo';
import { AvisoError } from '@/shared/ui/AvisoError';
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ERROR_CAMPO,
  CLASE_ETIQUETA,
} from '@/shared/ui/clases';

type CampoSet = keyof DatosSet;

const CAMPOS: { campo: CampoSet; etiqueta: string; maximo: number; ayuda?: string }[] = [
  { campo: 'nombre', etiqueta: 'Nombre', maximo: MAX_NOMBRE_SET },
  { campo: 'materia', etiqueta: 'Materia', maximo: MAX_MATERIA, ayuda: 'Opcional' },
  { campo: 'grupo', etiqueta: 'Grupo', maximo: MAX_GRUPO, ayuda: 'Opcional. Ej.: 2B' },
];

interface FormularioSetProps {
  titulo: string;
  inicial?: DatosSet | undefined;
  onGuardar: (datos: DatosSet) => Promise<void>;
  onCancelar: () => void;
}

/** Presentational create/edit form for a question set. */
export function FormularioSet({ titulo, inicial, onGuardar, onCancelar }: FormularioSetProps) {
  const id = useId();
  const [valores, setValores] = useState<DatosSet>(
    inicial ?? { nombre: '', materia: '', grupo: '' },
  );
  const [errores, setErrores] = useState<Partial<Record<CampoSet, string>>>({});
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorGuardado(null);
    const resultado = esquemaDatosSet.safeParse(valores);
    if (!resultado.success) {
      const nuevos: Partial<Record<CampoSet, string>> = {};
      for (const issue of resultado.error.issues) {
        const [campo] = issue.path;
        if (campo === 'nombre' || campo === 'materia' || campo === 'grupo') {
          nuevos[campo] ??= issue.message;
        }
      }
      setErrores(nuevos);
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      await onGuardar(resultado.data);
    } catch {
      setErrorGuardado('No se pudo guardar el set. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      noValidate
      aria-labelledby={`${id}-titulo`}
      onSubmit={(evento) => void guardar(evento)}
      className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id={`${id}-titulo`} className="text-xl font-bold">
        {titulo}
      </h2>
      {errorGuardado && <AvisoError>{errorGuardado}</AvisoError>}
      <div className="grid gap-4 sm:grid-cols-3">
        {CAMPOS.map(({ campo, etiqueta, maximo, ayuda }) => {
          const error = errores[campo];
          const idCampo = `${id}-${campo}`;
          const descripciones = [ayuda && `${idCampo}-ayuda`, error && `${idCampo}-error`]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={campo}>
              <label htmlFor={idCampo} className={CLASE_ETIQUETA}>
                {etiqueta}
              </label>
              <input
                id={idCampo}
                value={valores[campo]}
                maxLength={maximo}
                required={campo === 'nombre'}
                aria-invalid={error !== undefined}
                aria-describedby={descripciones || undefined}
                onChange={(evento) => {
                  setValores((actuales) => ({ ...actuales, [campo]: evento.target.value }));
                }}
                className={`${CLASE_CAMPO} mt-1`}
              />
              {ayuda && (
                <p id={`${idCampo}-ayuda`} className="mt-1 text-sm text-slate-600">
                  {ayuda}
                </p>
              )}
              {error && (
                <p id={`${idCampo}-error`} className={CLASE_ERROR_CAMPO}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={CLASE_BOTON_PRIMARIO} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar set'}
        </button>
        <button type="button" className={CLASE_BOTON_SECUNDARIO} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
