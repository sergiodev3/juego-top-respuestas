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
| `npm run test:coverage`                   | Vitest with v8 coverage; thresholds gate `src/engine/**`   |
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
    modelo/     domain types + Zod schemas (Pregunta, Respuesta, SetPreguntas, Juego)
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
- **Dependencies arrive in the phase that first needs them** (Dexie and Zod since Fase 1; SheetJS and PapaParse since Fase 2; Zustand, Framer Motion, Howler later). SheetJS is installed from the official CDN tarball (`cdn.sheetjs.com`), never from the npm registry.
- **Deploy**: static site on Vercel; `vercel.json` rewrites every path to `/index.html` (real files win by filesystem precedence).

## Data layer (Fase 1)

- **Model** (`src/shared/modelo`): Zod schemas are the source of truth; types come from `z.output`. `esquemaDatos*` schemas validate editable input and normalize it (trim, drop blank answer rows, sort answers by points desc via `ordenarRespuestas`, stable on ties). Validation messages are user-facing Spanish. Limits: 1-8 answers, answer text 1-80 chars, points integer >= 0.
- **Dexie schema** (`src/db/baseDatos.ts`): tables `sets`, `preguntas` (indexed by `setId`, `tema`), `juegos` (typed as `Juego` since Fase 2), `partidas`, and `meta` (key `clave`). `partidas` only has a placeholder type until Fase 4.
- **Records**: IDs from `crypto.randomUUID()`; `creadoEn`, `actualizadoEn`, `eliminadoEn` are epoch milliseconds. Every write sets `actualizadoEn`.
- **Soft delete**: delete sets `eliminadoEn` (tombstone for future sync); reads hide those rows. IndexedDB cannot index `null`, so filter `eliminadoEn === null` in code. Deleting a set soft-deletes its questions in the same transaction.
- **Repositories**: features use the interfaces in `src/db/repositorios.ts` (`RepositorioSets`, `RepositorioPreguntas`, `RepositorioJuegos`, `ServicioImportacion`), never Dexie. `crearRepositoriosDexie(db, { ahora, generarId })` implements them; writes re-validate with the schemas. React gets them from `RepositoriosProvider` (defaults to the app instance in `src/db/instancia.ts`) via `useRepositorios()`; read with `useLiveQuery(() => repositorios.x.y(...), deps)`. Repository reads must only await Dexie calls so `liveQuery` keeps tracking them.
- **Startup** (`src/app/main.tsx`): `solicitarAlmacenamientoPersistente()` (never throws) and `aplicarSemillaSiHaceFalta(baseDatos)`. The seed ("Cultura general escolar", 10 questions) runs once: the `semillaAplicada` flag in `meta` is written in the same transaction, so deleting the sample set never reseeds.
- **Adding a schema version**: never edit a shipped `this.version(n)` block. Add `this.version(n + 1).stores({ changed tables only })` with an optional `.upgrade(tx => ...)` that migrates existing rows, below the previous version in the `BaseDatosTopRespuestas` constructor, and add a test that opens an older-version database and checks the migrated data.

## Import and games (Fase 2)

- **Format**: one row per question, `Tema | Pregunta | R1 | Pts1 | … | R8 | Pts8 | Sinónimos`, synonyms as `R1: auto, coche; R3: celular`. Headers match ignoring case, accents and spaces (`Pts1` or `Puntos1`, `Sinónimos` or `Sinonimos`); column order is free and unknown columns are ignored. A missing `Pregunta` column or no `R1`-`R8` column fails the whole file.
- **Pure domain** (`src/features/importar/dominio`, no React or Dexie): `leerArchivo(nombre, bytes)` -> raw matrix -> `validarFilas(matriz)` -> rows with `numeroFila` (Excel row, header = first non-empty row), `estado`, exact Spanish `errores` (block the row) and `advertencias` (duplicates; never block). Empty rows are skipped. Valid rows reuse `esquemaDatosPregunta`, so imports obey the bank rules; synonyms attach to their answer before sorting by points. `marcarDuplicadosEnSet` adds the target-set duplicate warning.
- **CSV encoding**: strict UTF-8 first (`TextDecoder('utf-8', { fatal: true })`, BOM stripped), falling back to `windows-1252` (Excel on Windows). PapaParse auto-detects `,` or `;`. Templates are generated client-side (offline); the CSV template is UTF-8 with a BOM so Excel shows accents. Round-trip tests keep both templates importable with zero errors.
- **Lazy loading**: SheetJS and PapaParse are only reached through `await import('xlsx')` / `await import('papaparse')` inside the readers and template generators, so they build as separate chunks (still precached by the service worker). Never import them statically from app code; tests may.
- **SheetJS install**: from the official CDN tarball, not the npm registry (the registry copy is stale). Current: `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. To upgrade, check the latest version at https://cdn.sheetjs.com/ (list: `https://cdn.sheetjs.com/xlsx.lst`) and rerun the same command with the new version.
- **Juego** (`src/shared/modelo/juego.ts`): `equipos` (2-4, `{ id, nombre, color }`), `reglas` (`tachasMaximas`, `rondaFinal { activa, preguntaIds, segundos: [20, 25], meta: 200 }`), `rondas` (`{ preguntaId, multiplicador: 1 | 2 | 3 }`). `crearJuegoPorDefecto({ nombre, preguntaIds })` is pure: "Equipo A"/"Equipo B" (`COLORES_EQUIPOS`, AA contrast with white text), 3 strikes, the first 4 questions as rounds in order (x2 and x3 on rounds 3 and 4 only when there are exactly 4 rounds, otherwise all x1), final round off.
- **Import writes**: `repositorios.importacion.importarPreguntas(destino, preguntas)` and `importarYJugar(datosSet, preguntas)` validate everything first and write the set, questions (file order kept via `creadoEn` offsets) and the default game in one Dexie transaction. The UI keeps the parsed preview when a write fails. "Importar y jugar" navigates to `rutaConfigurarJuego(juegoId)` (`/juego/configurar/:juegoId`), which shows a read-only summary until Fase 4.

## Game engine (Fase 3)

- **Pure and event-sourced** (`src/engine`, import from `@/engine`): `reducir(config, eventos)` replays a log from `crearEstadoInicial(config)`; `validar` returns `{ ok: true } | { ok: false, codigo, motivo }` (stable code + Spanish message) for enabling panel actions; `aplicar` throws `EventoRechazadoError` on invalid events; `deshacer(eventos)` drops the last event; `proyectarTablero(config, estado)` is the only thing the board receives.
- **Snapshot config**: `ConfigPartida` is engine-owned (teams by index 0-3, rounds with `PreguntaSnapshot` + multiplier, `tachasMaximas`, optional final round with exactly 5 questions). The engine never imports `@/shared/modelo`; Fase 4 maps `Juego` + questions into it.
- **Replay never throws** on a bad stored event: it is skipped and listed in `estado.advertencias` (`{ indice, codigo, motivo }`).
- Rules source of truth: "Rules specification" in `odd/tasks/fase-3-motor.md`; overview, phase diagram and event table in `src/engine/README.md`. `npm run test:coverage` gates `src/engine/**` (lines/statements/functions >= 95%, branches >= 90%).

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
