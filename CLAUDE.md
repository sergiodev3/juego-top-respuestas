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
| `npm run test` / `npm run test:watch`     | Vitest (`src/**/*.test.ts(x)`, node env by default)        |
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
    modelo/     domain types + Zod schemas (Pregunta, Respuesta, SetPreguntas)
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
- **Dependencies arrive in the phase that first needs them** (Dexie and Zod since Fase 1; Zustand, PapaParse, Framer Motion, Howler later). SheetJS is installed from the official CDN tarball (`cdn.sheetjs.com`), never from the npm registry.
- **Deploy**: static site on Vercel; `vercel.json` rewrites every path to `/index.html` (real files win by filesystem precedence).

## Data layer (Fase 1)

- **Model** (`src/shared/modelo`): Zod schemas are the source of truth; types come from `z.output`. `esquemaDatos*` schemas validate editable input and normalize it (trim, drop blank answer rows, sort answers by points desc via `ordenarRespuestas`, stable on ties). Validation messages are user-facing Spanish. Limits: 1-8 answers, answer text 1-80 chars, points integer >= 0.
- **Dexie schema** (`src/db/baseDatos.ts`): tables `sets`, `preguntas` (indexed by `setId`, `tema`), `juegos`, `partidas`, and `meta` (key `clave`). `juegos`/`partidas` only have placeholder types until Fase 4.
- **Records**: IDs from `crypto.randomUUID()`; `creadoEn`, `actualizadoEn`, `eliminadoEn` are epoch milliseconds. Every write sets `actualizadoEn`.
- **Soft delete**: delete sets `eliminadoEn` (tombstone for future sync); reads hide those rows. IndexedDB cannot index `null`, so filter `eliminadoEn === null` in code. Deleting a set soft-deletes its questions in the same transaction.
- **Repositories**: features use the interfaces in `src/db/repositorios.ts` (`RepositorioSets`, `RepositorioPreguntas`), never Dexie. `crearRepositoriosDexie(db, { ahora, generarId })` implements them; writes re-validate with the schemas. React gets them from `RepositoriosProvider` (defaults to the app instance in `src/db/instancia.ts`) via `useRepositorios()`; read with `useLiveQuery(() => repositorios.x.y(...), deps)`. Repository reads must only await Dexie calls so `liveQuery` keeps tracking them.
- **Startup** (`src/app/main.tsx`): `solicitarAlmacenamientoPersistente()` (never throws) and `aplicarSemillaSiHaceFalta(baseDatos)`. The seed ("Cultura general escolar", 10 questions) runs once: the `semillaAplicada` flag in `meta` is written in the same transaction, so deleting the sample set never reseeds.
- **Adding a schema version**: never edit a shipped `this.version(n)` block. Add `this.version(n + 1).stores({ changed tables only })` with an optional `.upgrade(tx => ...)` that migrates existing rows, below the previous version in the `BaseDatosTopRespuestas` constructor, and add a test that opens an older-version database and checks the migrated data.

## Testing

- Vitest runs in `node` by default. Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock on the first line (Vitest 5 has no `environmentMatchGlobs`).
- `src/test/setup.ts` installs `fake-indexeddb/auto` before any module loads Dexie (Dexie captures the globals on import and `liveQuery` needs them), registers jest-dom matchers, and in jsdom adds Testing Library cleanup plus a `<dialog>` `showModal`/`close` shim (jsdom lacks them).
- Use `crearEntornoPrueba()` (`src/test/baseDatosPrueba.ts`) for a fresh, isolated database per test with a deterministic clock (`reloj.avanzar`) and sequential ids (`id-1`, `id-2`, ...). Close it in `afterEach`.
- Test repositories through their interface; inject `entorno.repositorios` into `RepositoriosProvider` for view tests.

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
- Zod is v4: customize messages with `{ error: '...' }`. React 19.3 types deprecate `FormEvent`; use `SubmitEvent<HTMLFormElement>` for form submit handlers.
- Confirmations use `DialogoConfirmacion` (`src/shared/ui`, native `<dialog>`), never `window.confirm`/`alert`.
