// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DialogoConfirmacion } from './DialogoConfirmacion';

function renderizar(abierto: boolean) {
  const onConfirmar = vi.fn();
  const onCancelar = vi.fn();
  const utilidades = render(
    <DialogoConfirmacion
      abierto={abierto}
      titulo="¿Eliminar el set?"
      descripcion="Esta acción no se puede deshacer."
      textoConfirmar="Eliminar"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  );
  return { ...utilidades, onConfirmar, onCancelar };
}

describe('DialogoConfirmacion', () => {
  it('opens a labelled modal dialog and focuses the safe action', () => {
    renderizar(true);

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar el set?' });
    expect(dialogo).toHaveProperty('open', true);
    expect(dialogo).toHaveAccessibleDescription('Esta acción no se puede deshacer.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('stays closed while not requested and closes when the prop turns false', () => {
    const { rerender, onConfirmar, onCancelar } = renderizar(true);

    rerender(
      <DialogoConfirmacion
        abierto={false}
        titulo="¿Eliminar el set?"
        descripcion="Esta acción no se puede deshacer."
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    );

    expect(screen.getByRole('dialog', { hidden: true })).toHaveProperty('open', false);
  });

  it('calls onConfirmar or onCancelar from its buttons', async () => {
    const usuario = userEvent.setup();
    const { onConfirmar, onCancelar } = renderizar(true);

    await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('treats the Escape cancel event as cancel', () => {
    const { onCancelar } = renderizar(true);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});
