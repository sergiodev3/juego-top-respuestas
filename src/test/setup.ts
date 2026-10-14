// Dexie captures the IndexedDB globals when it is first imported and liveQuery relies on
// them, so install the in-memory implementation before any test module loads Dexie.
// Test databases still get their own factory (see baseDatosPrueba.ts) for isolation.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// DOM-only setup: engine and db tests run in the `node` environment and skip it.
if (typeof document !== 'undefined') {
  const { cleanup, configure } = await import('@testing-library/react');
  afterEach(cleanup);
  // Live queries (Dexie liveQuery) can take over the 1 s default to settle when the whole
  // suite runs in parallel; give `findBy*`/`waitFor` more room to avoid timing flakes.
  configure({ asyncUtilTimeout: 5_000 });

  // jsdom does not implement modal dialogs yet; emulate the open/close state.
  if (typeof HTMLDialogElement !== 'undefined' && !('showModal' in HTMLDialogElement.prototype)) {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute('open', '');
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          if (!this.open) {
            return;
          }
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        },
      },
    });
  }
}
