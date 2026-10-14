// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DatosPregunta } from '@/shared/modelo';

import { EditorPregunta } from './EditorPregunta';

function renderizar(opciones: { inicial?: DatosPregunta; onGuardar?: () => Promise<void> } = {}) {
  const onGuardar = vi.fn<(datos: DatosPregunta) => Promise<void>>(
    opciones.onGuardar ?? (() => Promise.resolve()),
  );
  const onCancelar = vi.fn();
  render(
    <EditorPregunta
      inicial={opciones.inicial}
      temas={['Ciencias', 'Historia']}
      onGuardar={onGuardar}
      onCancelar={onCancelar}
    />,
  );
  return { onGuardar, onCancelar, usuario: userEvent.setup() };
}

describe('EditorPregunta', () => {
  it('saves the answers sorted by points, dropping blank rows and splitting synonyms', async () => {
    const { onGuardar, usuario } = renderizar();

    await usuario.type(screen.getByLabelText('Pregunta'), 'Menciona una fruta');
    await usuario.type(screen.getByLabelText('Tema'), 'Alimentos');
    await usuario.type(screen.getByLabelText('Respuesta 1'), 'Pera');
    await usuario.type(screen.getByLabelText('Puntos de la respuesta 1'), '10');
    await usuario.type(screen.getByLabelText('Respuesta 2'), 'Manzana');
    await usuario.type(screen.getByLabelText('Puntos de la respuesta 2'), '45');
    await usuario.type(screen.getByLabelText('Sinónimos de la respuesta 2'), 'Manzanita, Roja');
    await usuario.click(screen.getByRole('button', { name: 'Guardar pregunta' }));

    expect(onGuardar).toHaveBeenCalledWith({
      texto: 'Menciona una fruta',
      tema: 'Alimentos',
      respuestas: [
        { texto: 'Manzana', puntos: 45, sinonimos: ['Manzanita', 'Roja'] },
        { texto: 'Pera', puntos: 10, sinonimos: [] },
      ],
    });
  });

  it('allows at most 8 answer rows', async () => {
    const { usuario } = renderizar();
    const agregar = screen.getByRole('button', { name: 'Agregar respuesta' });

    while (!agregar.hasAttribute('disabled')) {
      await usuario.click(agregar);
    }

    expect(screen.getAllByLabelText(/^Respuesta \d+$/)).toHaveLength(8);
    expect(screen.getByText('Máximo 8 respuestas por pregunta.')).toBeInTheDocument();
  });

  it('removes a row', async () => {
    const { usuario } = renderizar();
    const filasAntes = screen.getAllByLabelText(/^Respuesta \d+$/).length;

    await usuario.click(screen.getByRole('button', { name: 'Quitar respuesta 1' }));

    expect(screen.getAllByLabelText(/^Respuesta \d+$/)).toHaveLength(filasAntes - 1);
  });

  it('shows Spanish validation errors next to the fields and does not save', async () => {
    const { onGuardar, usuario } = renderizar();

    await usuario.type(screen.getByLabelText('Respuesta 2'), 'Sin puntos');
    await usuario.click(screen.getByRole('button', { name: 'Guardar pregunta' }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Pregunta')).toHaveAccessibleDescription(
      'Escribe el texto de la pregunta.',
    );
    expect(screen.getByLabelText('Puntos de la respuesta 2')).toHaveAccessibleDescription(
      'Escribe los puntos de la respuesta.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los campos marcados.');
  });

  it('loads an existing question for editing', () => {
    renderizar({
      inicial: {
        texto: 'Menciona un planeta',
        tema: 'Ciencias',
        respuestas: [{ texto: 'Marte', puntos: 30, sinonimos: ['Planeta rojo'] }],
      },
    });

    expect(screen.getByLabelText('Pregunta')).toHaveValue('Menciona un planeta');
    expect(screen.getByLabelText('Respuesta 1')).toHaveValue('Marte');
    expect(screen.getByLabelText('Puntos de la respuesta 1')).toHaveValue(30);
    expect(screen.getByLabelText('Sinónimos de la respuesta 1')).toHaveValue('Planeta rojo');
  });

  it('keeps the input and shows a friendly error when saving fails', async () => {
    const { usuario } = renderizar({ onGuardar: () => Promise.reject(new Error('Disco lleno')) });

    await usuario.type(screen.getByLabelText('Pregunta'), 'Menciona un color');
    await usuario.type(screen.getByLabelText('Respuesta 1'), 'Rojo');
    await usuario.type(screen.getByLabelText('Puntos de la respuesta 1'), '50');
    await usuario.click(screen.getByRole('button', { name: 'Guardar pregunta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar la pregunta. Intenta de nuevo.',
    );
    expect(screen.getByLabelText('Pregunta')).toHaveValue('Menciona un color');
    expect(screen.getByLabelText('Respuesta 1')).toHaveValue('Rojo');
  });

  it('cancels without saving', async () => {
    const { onGuardar, onCancelar, usuario } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
