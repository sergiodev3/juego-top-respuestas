# Top Respuestas

Local-first classroom survey game in the style of "100 Mexicanos Dijeron" / Family Feud. One laptop drives two screens: the host panel (`/juego/panel`, single source of truth) on the laptop and a read-only projector board (`/tablero`) on the extended display. Teams buzz with physical buttons; the host assigns turns in the panel. School internet is unreliable, so the app runs fully offline (PWA + IndexedDB) and deploys as a static site on Vercel. The full product spec lives in `docs/SPEC.md`; feature progress lives in `odd/tasks/`.

## Commands

| Command                                   | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                             | Vite dev server                                            |
| `npm run build`                           | `tsc -b` + production build (emits `sw.js` and manifest)   |
| `npm run preview`                         | Serve the production build                                 |
| `npm run typecheck`                       | Type-check all TS project references                       |
| `npm run lint`                            | ESLint, zero warnings allowed                              |
| `npm run format` / `npm run format:check` | Prettier write / check                                     |
| `npm run test` / `npm run test:watch`     | Vitest (node environment, `src/**/*.test.ts(x)`)           |
| `npm run icons`                           | Regenerate PWA PNG icons from `public/favicon.svg` (sharp) |

Run `typecheck`, `lint`, `format:check`, and `test` before every commit.

## Folder structure

```
src/
  app/          entry (main.tsx), router, route table, Layout shell, Inicio and error views
  engine/       pure TypeScript game engine: event-sourced reducer, rules, projections
  db/           Dexie schema, migrations, repository interfaces
  features/
    banco/      question bank CRUD
    importar/   .xlsx/.csv import with preview and validation
    juego/      game setup (configurar) and host panel (panel)
    tablero/    projector board (rendered without the app shell)
    impresion/  printable host cards
    respaldos/  JSON export/restore
  shared/
    ui/         reusable presentational components
    sync/       BroadcastChannel panel <-> board messaging (Zod-validated)
    pantallas/  second-screen and fullscreen helpers
    sonido/     sound effects
    utils/      small generic helpers
    rutas.ts    path constants (RUTAS), shared so features never import from app/
```

Import with the `@/` alias (`@/shared/rutas`). Layer direction: `app` -> `features` -> `shared` / `db` / `engine`. The engine depends on nothing but itself; ESLint (`no-restricted-imports` on `src/engine/**`) rejects React, React DOM, Dexie, and `@/features`, `@/app`, `@/db` imports there.

## Approved architecture decisions

- **Event-sourced engine**: `state = reducir(config, eventos)`. `DESHACER` pops the last stored event; it is never stored itself.
- **Partida snapshot**: a partida stores a copy of its config and questions, so replay stays deterministic even if the bank later changes.
- **`tema` lives on each question**; sets carry `nombre`, `materia`, `grupo`.
- **IDs and timestamps**: IDs from `crypto.randomUUID()`; every record has `actualizadoEn`. Persistence sits behind repository interfaces for future sync with Express + PostgreSQL.
- **Board sync**: the panel is the single source of truth. The board receives only a projection (`proyectarTablero`) over BroadcastChannel, with Zod-validated messages.
- **3-4 teams**: all teams play every round; the host assigns with keys A-D whoever buzzed first in cara a cara and in robo.
- **Scoring**: cara a cara strikes do not count toward the 3; a successful robo banks the stolen answer too; the round multiplier is applied when points are awarded.
- **Final round**: adds the `RF_RESPUESTA` event; the timer lives in the UI, not the engine.
- **Import synonyms** (`R1: auto, coche; R3: celular`) are mapped to their answers before answers are sorted by points.
- **Projector fullscreen** needs one click inside the board window (browser restriction). Window Management API (`getScreenDetails`) only on Chromium; fallback is `window.open` plus instructions.
- **Dependencies arrive in the phase that first needs them** (Dexie, Zustand, Zod, PapaParse, Framer Motion, Howler). SheetJS is installed from the official CDN tarball (`cdn.sheetjs.com`), never from the npm registry.
- **Deploy**: static site on Vercel; `vercel.json` rewrites every path to `/index.html` (real files win by filesystem precedence).

## Conventions

- **UI copy in Spanish (es-MX)**, neutral and friendly, including errors. Code comments and docs in English.
- **Spanish domain identifiers** as named in the spec: events (`ASIGNAR_TURNO`, `REVELAR`, `TACHE`, `ROBO_EXITOSO`, `DESHACER`), states (`caraACara`, `enJuego`, `robo`, `finDeRonda`), views (`VistaBanco`), folder names (`banco`, `tablero`). Generic technical helpers may use English (`cx`).
- **Strict TypeScript, no `any`**: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`; `@typescript-eslint/no-explicit-any` is an error; lint runs type-aware `strictTypeChecked`.
- **Accessibility**: visible `:focus-visible` ring (global in `src/app/index.css`), labelled controls, high contrast on the board.
- **Tests** sit next to the code as `*.test.ts(x)`; the engine needs high rule coverage.
- **Commits**: Conventional Commits, no AI attribution or `Co-Authored-By` lines.
- **Work by phases** (Fase 0-7 in `docs/SPEC.md`): finish a phase, run checks, commit, summarize, and wait for the user's approval before starting the next.

## Tooling notes

- TypeScript is held on `~6.0` because `typescript-eslint` supports `typescript <6.1`.
- React Router is on v7: v8 requires Node `>=22.22`, and the local runtime is Node 22.18. Use `react-router` (not `react-router-dom`), `createBrowserRouter`, and `RouterProvider` from `react-router/dom`.
- Tailwind v4 via `@tailwindcss/vite`; styles start with `@import 'tailwindcss'` in `src/app/index.css`.
- The service worker (vite-plugin-pwa, `autoUpdate`) precaches js/css/html/svg/png/woff2/mp3/ogg and falls back to `/index.html` for navigations.
