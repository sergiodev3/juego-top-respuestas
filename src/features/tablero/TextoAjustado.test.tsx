// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ESCALA_MINIMA, TextoAjustado } from './TextoAjustado';

/** jsdom has no layout: fake the box (`caja`) and the unscaled text (`texto`) widths. */
function simularAnchos(disponible: number, natural: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset['ajuste'] === 'caja' ? disponible : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset['ajuste'] === 'texto' ? natural : 0;
  });
}

function transformacion(): string {
  return screen.getByText('Respuesta larga').style.transform;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TextoAjustado', () => {
  it('keeps the natural size when the text fits', () => {
    simularAnchos(800, 500);

    render(<TextoAjustado texto="Respuesta larga" />);

    expect(transformacion()).toBe('scale(1)');
  });

  it('shrinks to the available width when the text is wider', () => {
    simularAnchos(500, 1000);

    render(<TextoAjustado texto="Respuesta larga" />);

    expect(transformacion()).toBe('scale(0.5)');
  });

  it('never shrinks below the readable minimum', () => {
    simularAnchos(100, 1000);

    render(<TextoAjustado texto="Respuesta larga" />);

    expect(transformacion()).toBe(`scale(${String(ESCALA_MINIMA)})`);
  });

  it('keeps the natural size when there is no layout to measure', () => {
    simularAnchos(0, 0);

    render(<TextoAjustado texto="Respuesta larga" />);

    expect(transformacion()).toBe('scale(1)');
  });
});
