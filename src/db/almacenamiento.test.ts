import { describe, expect, it } from 'vitest';

import { solicitarAlmacenamientoPersistente } from './almacenamiento';

describe('solicitarAlmacenamientoPersistente', () => {
  it('returns the browser answer when persistence is supported', async () => {
    expect(await solicitarAlmacenamientoPersistente({ persist: () => Promise.resolve(true) })).toBe(
      true,
    );
    expect(
      await solicitarAlmacenamientoPersistente({ persist: () => Promise.resolve(false) }),
    ).toBe(false);
  });

  it('skips the request when storage is already persistent', async () => {
    let solicitado = false;
    const resultado = await solicitarAlmacenamientoPersistente({
      persisted: () => Promise.resolve(true),
      persist: () => {
        solicitado = true;
        return Promise.resolve(true);
      },
    });

    expect(resultado).toBe(true);
    expect(solicitado).toBe(false);
  });

  it('returns false instead of throwing when unsupported or failing', async () => {
    expect(await solicitarAlmacenamientoPersistente(undefined)).toBe(false);
    expect(await solicitarAlmacenamientoPersistente({})).toBe(false);
    expect(
      await solicitarAlmacenamientoPersistente({
        persist: () => Promise.reject(new Error('Bloqueado')),
      }),
    ).toBe(false);
  });
});
