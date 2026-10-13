# engine

Pure TypeScript game engine (Fase 3). Event-sourced: `state = reducir(config, eventos)`.

Rules: no React, React DOM, Dexie, or imports from `@/features`, `@/app`, or `@/db` (enforced by ESLint `no-restricted-imports`). Covered by Vitest.
