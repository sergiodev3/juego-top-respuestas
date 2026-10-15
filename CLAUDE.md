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
| `npm run sonidos`                         | Regenerate the WAV sound effects in `public/sonidos/`      |

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
    juego/      game setup (configurar), host panel (panel), pure setup domain (dominio)
    tablero/    projector board (rendered without the app shell)
    impresion/  printable host cards
    respaldos/  JSON export/restore
  shared/
    ui/         reusable presentational components
    sync/       BroadcastChannel panel <-> board messaging (Zod-validated)
    pantallas/  second-screen and fullscreen helpers
    sonido/     sound effects
    modelo/     domain types + Zod schemas (Pregunta, Respuesta, SetPreguntas, Juego, Partida)
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
- **Final round**: adds the `RF_RESPUESTA` event; the timer lives in the UI, not the engine. `RF_TERMINAR` adds the final-round total to the playing team's score; `TERMINAR_JUEGO` during the final round adds nothing.
- **Import synonyms** (`R1: auto, coche; R3: celular`) are mapped to their answers before answers are sorted by points.
- **Projector fullscreen** needs one click inside the board window (browser restriction). Window Management API (`getScreenDetails`) only on Chromium; fallback is `window.open` plus instructions.
- **Dependencies arrive in the phase that first needs them** (Dexie and Zod since Fase 1; SheetJS and PapaParse since Fase 2; Howler and `motion` (Framer Motion) since Fase 5). New dependencies are pinned to a release at least two weeks old. SheetJS is installed from the official CDN tarball (`cdn.sheetjs.com`), never from the npm registry.
- **Deploy**: static site on Vercel; `vercel.json` rewrites every path to `/index.html` (real files win by filesystem precedence).

## Data layer (Fase 1)

- **Model** (`src/shared/modelo`): Zod schemas are the source of truth; types come from `z.output`. `esquemaDatos*` schemas validate editable input and normalize it (trim, drop blank answer rows, sort answers by points desc via `ordenarRespuestas`, stable on ties). Validation messages are user-facing Spanish. Limits: 1-8 answers, answer text 1-80 chars, points integer >= 0.
- **Dexie schema** (`src/db/baseDatos.ts`): tables `sets`, `preguntas` (indexed by `setId`, `tema`), `juegos` (typed as `Juego` since Fase 2), `partidas` (typed as `Partida` since Fase 4, indexed by `juegoId`, `estado`), and `meta` (key `clave`). Current version: 2 (see Fase 4).
- **Records**: IDs from `crypto.randomUUID()`; `creadoEn`, `actualizadoEn`, `eliminadoEn` are epoch milliseconds. Every write sets `actualizadoEn`.
- **Soft delete**: delete sets `eliminadoEn` (tombstone for future sync); reads hide those rows. IndexedDB cannot index `null`, so filter `eliminadoEn === null` in code. Deleting a set soft-deletes its questions in the same transaction.
- **Repositories**: features use the interfaces in `src/db/repositorios.ts` (`RepositorioSets`, `RepositorioPreguntas`, `RepositorioJuegos`, `RepositorioPartidas`, `ServicioImportacion`), never Dexie. `crearRepositoriosDexie(db, { ahora, generarId })` implements them; writes re-validate with the schemas. React gets them from `RepositoriosProvider` (defaults to the app instance in `src/db/instancia.ts`) via `useRepositorios()`; read with `useLiveQuery(() => repositorios.x.y(...), deps)`. Repository reads must only await Dexie calls so `liveQuery` keeps tracking them.
- **Startup** (`src/app/main.tsx`): `solicitarAlmacenamientoPersistente()` (never throws) and `aplicarSemillaSiHaceFalta(baseDatos)`. The seed ("Cultura general escolar", 10 questions) runs once: the `semillaAplicada` flag in `meta` is written in the same transaction, so deleting the sample set never reseeds.
- **Adding a schema version**: never edit a shipped `this.version(n)` block. Add `this.version(n + 1).stores({ changed tables only })` with an optional `.upgrade(tx => ...)` that migrates existing rows, below the previous version in the `BaseDatosTopRespuestas` constructor, and add a test that opens an older-version database and checks the migrated data.

## Import and games (Fase 2)

- **Format**: one row per question, `Tema | Pregunta | R1 | Pts1 | … | R8 | Pts8 | Sinónimos`, synonyms as `R1: auto, coche; R3: celular`. Headers match ignoring case, accents and spaces (`Pts1` or `Puntos1`, `Sinónimos` or `Sinonimos`); column order is free and unknown columns are ignored. A missing `Pregunta` column or no `R1`-`R8` column fails the whole file.
- **Pure domain** (`src/features/importar/dominio`, no React or Dexie): `leerArchivo(nombre, bytes)` -> raw matrix -> `validarFilas(matriz)` -> rows with `numeroFila` (Excel row, header = first non-empty row), `estado`, exact Spanish `errores` (block the row) and `advertencias` (duplicates; never block). Empty rows are skipped. Valid rows reuse `esquemaDatosPregunta`, so imports obey the bank rules; synonyms attach to their answer before sorting by points. `marcarDuplicadosEnSet` adds the target-set duplicate warning.
- **CSV encoding**: strict UTF-8 first (`TextDecoder('utf-8', { fatal: true })`, BOM stripped), falling back to `windows-1252` (Excel on Windows). PapaParse auto-detects `,` or `;`. Templates are generated client-side (offline); the CSV template is UTF-8 with a BOM so Excel shows accents. Round-trip tests keep both templates importable with zero errors.
- **Lazy loading**: SheetJS and PapaParse are only reached through `await import('xlsx')` / `await import('papaparse')` inside the readers and template generators, so they build as separate chunks (still precached by the service worker). Never import them statically from app code; tests may.
- **SheetJS install**: from the official CDN tarball, not the npm registry (the registry copy is stale). Current: `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. To upgrade, check the latest version at https://cdn.sheetjs.com/ (list: `https://cdn.sheetjs.com/xlsx.lst`) and rerun the same command with the new version.
- **Juego** (`src/shared/modelo/juego.ts`): `equipos` (2-4, `{ id, nombre, color }`), `reglas` (`tachasMaximas`, `rondaFinal { activa, preguntaIds, segundos: [20, 25], meta: 200 }`), `rondas` (`{ preguntaId, multiplicador: 1 | 2 | 3 }`). `crearJuegoPorDefecto({ nombre, preguntaIds })` is pure: "Equipo A"/"Equipo B" (`COLORES_EQUIPOS`, AA contrast with white text), 3 strikes, the first 4 questions as rounds in order (x2 and x3 on rounds 3 and 4 only when there are exactly 4 rounds, otherwise all x1), final round off.
- **Import writes**: `repositorios.importacion.importarPreguntas(destino, preguntas)` and `importarYJugar(datosSet, preguntas)` validate everything first and write the set, questions (file order kept via `creadoEn` offsets) and the default game in one Dexie transaction. The UI keeps the parsed preview when a write fails. "Importar y jugar" navigates to `rutaConfigurarJuego(juegoId)` (`/juego/configurar/:juegoId`), which opens the game prefilled in the setup form, ready to start.

## Game engine (Fase 3)

- **Pure and event-sourced** (`src/engine`, import from `@/engine`): `reducir(config, eventos)` replays a log from `crearEstadoInicial(config)`; `validar` returns `{ ok: true } | { ok: false, codigo, motivo }` (stable code + Spanish message) for enabling panel actions; `aplicar` throws `EventoRechazadoError` on invalid events; `deshacer(eventos)` drops the last event; `proyectarTablero(config, estado)` is the only thing the board receives.
- **Snapshot config**: `ConfigPartida` is engine-owned (teams by index 0-3, rounds with `PreguntaSnapshot` + multiplier, `tachasMaximas`, optional final round with exactly 5 questions). The engine never imports `@/shared/modelo`; Fase 4 maps `Juego` + questions into it.
- **Replay never throws** on a bad stored event: it is checked against `esquemaEvento` (Zod) and the rules, then skipped and listed in `estado.advertencias` (`{ indice, codigo, motivo }`, `EVENTO_MALFORMADO` for a bad shape). `reducir` expects a valid config (it throws otherwise); data read from storage must go through `reconstruir(config: unknown, eventos: unknown)`, which never throws and returns `{ ok: true, config, estado, advertencias } | { ok: false, errores }`. Zod is allowed in the engine (pure library).
- Rules source of truth: "Rules specification" in `odd/tasks/fase-3-motor.md`; overview, phase diagram and event table in `src/engine/README.md`. `npm run test:coverage` gates `src/engine/**` (lines/statements/functions >= 95%, branches >= 90%).

## Partidas, sync and board (Fase 4)

- **Partida** (`src/shared/modelo/partida.ts`): `{ id, juegoId, config: ConfigPartida, eventos: Evento[], estado: 'enCurso' | 'terminada', creadoEn, actualizadoEn, eliminadoEn }`. The game state is never stored; it is rebuilt from the snapshot and the log.
- **`repositorios.partidas`**: `crear({ juegoId, config })` re-checks the config like a load (`ErrorConfigPartida` with Spanish `errores`) and ends any other `enCurso` partida in the same transaction (the UI confirms first); `obtener`, `obtenerEnCurso`; `agregarEvento(id, evento)` (shape-checked with `esquemaEvento`; rules are the caller's job via `validar`) and `deshacer(id)` are one read-modify-write transaction each and return the new log; `terminar(id)` is idempotent. Writes to an ended partida reject with `ErrorPartidaTerminada` ("La partida ya terminó."); missing ones with `ErrorRegistroNoEncontrado('partida')`.
- **Dexie v2**: same indexes; the upgrade gives v1 placeholder `partidas` rows an empty log and ends those without a snapshot (tested in `src/db/baseDatos.test.ts` by opening a real v1 database first).
- **Setup domain** (`src/features/juego/dominio`, pure): `crearConfigPartida(juego, preguntasPorId: ReadonlyMap)` deep-copies the questions into a `ConfigPartida` and returns `{ ok, config } | { ok: false, errores }` (missing/deleted questions: "La pregunta de la ronda N ya no está en el banco."; then `esquemaConfigPartida` + `validarConfig` through `reconstruir`). `crearJuegoRapido(set, preguntas, aleatorio)` picks up to 4 random non-deleted questions (inject the RNG) and reuses `crearJuegoPorDefecto`. `cargarPartida(partida | undefined)` wraps `reconstruir` and never throws.
- **Sync protocol** (`src/shared/sync`, import from `@/shared/sync`): BroadcastChannel `top-respuestas`, Zod discriminated union with `v: 1`. Panel -> board: `ESTADO_TABLERO { partidaId, secuencia, vista, temporizador: { restante, total, corriendo } | null }`, `SIN_PARTIDA`. Board -> panel: `SOLICITAR_ESTADO` (on mount, focus, visibility), `TABLERO_PRESENTE` (every 2 s). `esquemaVistaTablero` mirrors the engine `VistaTablero` (`satisfies` + an `expectTypeOf` test both ways). `crearCanal(transporte)` re-parses outgoing messages (unknown keys are stripped, so nothing beyond the projection leaves the panel) and ignores invalid incoming ones.
- **Staleness and presence**: the board keeps the newest view per partida (`reducirEstadoTablero`: `secuencia` <= current is ignored; another `partidaId` always wins). Panel sequences come from `crearContadorSecuencia(ahora)` (strictly increasing and never below `Date.now()`), so a reloaded panel is never taken for stale. The panel shows the board as connected while a board message is at most 5 s old (`tableroConectado`).
- **Hooks**: `usePublicadorTablero(datos | null)` (panel: publishes on value change, answers `SOLICITAR_ESTADO`, sends `SIN_PARTIDA` for `null` and on unmount, returns `{ tableroConectado }`) and `useSuscriptorTablero()` (board: returns `EstadoTablero`). They use the window's app channel (`obtenerCanalApp`) unless `CanalSyncProvider` injects one; tests use `crearBusMemoria()` from `src/test/transporteMemoria.ts`.
- **Second screen** (`src/shared/pantallas`): `abrirTablero(url)` asks `getScreenDetails` (Chromium only; needs permission) and opens a `popup` at the bounds of a non-primary screen (`elegirPantallaProyector`); otherwise (API missing, denied, single screen, positioned popup blocked) it opens a normal window and returns `requiereInstrucciones: true`; `{ modo: 'bloqueado' }` when `window.open` returns `null`. Call it from a click handler. `crearGestorTablero()` keeps the window: `reconectar` focuses it if still open, else reopens. Window name `top-respuestas-tablero`.
- **Board** (`/tablero`, `src/features/tablero`): container `VistaTablero` (subscription + "Pantalla completa" button via `usePantallaCompleta`, hidden while fullscreen or when unsupported) and presentational `PantallaTablero`, `TableroRonda`, `TableroRondaFinal`, `Marcador`. It renders only projection fields; hidden slots show just their number. Waiting screen ("Esperando al conductor…") before any state and after `SIN_PARTIDA`. Animations, title cards and cursor hiding: see Fase 5.
- **Inicio**: "Continuar partida" links to `rutaPanel(partidaId)` (`/juego/panel/:partidaId`) when `obtenerEnCurso()` returns one; "Nuevo juego rápido" links to `/juego/rapido`, "Configurar juego" to `/juego/configurar`.
- **`repositorios.juegos`**: `listar` (most recently updated first), `obtener`, `crear`, `actualizar(id, datos)` and `eliminar(id)` (soft delete; `ErrorRegistroNoEncontrado('juego')` for missing ones). `esquemaDatosJuego` has Spanish messages for strikes, final-round seconds/goal and a missing round question; `PALETA_EQUIPOS` (8 named colors, white text AA) lives in `src/shared/modelo/juego.ts`, which also re-exports the engine's `PREGUNTAS_RONDA_FINAL` (5).
- **Game setup** (`/juego/configurar` = saved games list + new-game form with defaults "Nuevo juego", Equipo A/B, 3 strikes, no final round; `/juego/configurar/:juegoId` = edit): container `VistaConfigurarJuego` -> `EditorJuego` (local form state, initialized once per game id) with `SeccionEquipos`, `SelectorPreguntas`, `SeccionRondas`/`SeccionRondaFinal`. Pure editing rules in `dominio/edicionJuego.ts` (`agregarEquipo`, `quitarEquipo`, `moverRonda`, `llenarRondas`, `llenarRondaFinal`, `elegirAlAzar`, `validarParaIniciar`, `mensajesValidacion`). Selection modes: manual picker (search + tema + set filters; questions already in the game are hidden), "Por tema" and "Aleatoria" (by set) random fills that replace the rounds or the final round and never repeat a question. Views take an injectable `aleatorio` (defaults to `Math.random`) for tests. "Guardar juego" validates with the schema only; "Iniciar partida" also requires >= 1 round, 5 final-round questions when on, distinct colors and no repeats, then saves, builds the snapshot (`prepararConfigPartida`) and starts.
- **Starting a partida** (`useIniciarPartida`, shared by the setup form, the saved-games list and the quick game): if `obtenerEnCurso()` returns one, a `DialogoConfirmacion` asks first ("Hay una partida en curso. Si inicias una nueva, la anterior se dará por terminada."); then `partidas.crear` and navigate to `rutaPanel(id)`. Render the returned `dialogo` once in the view.
- **Quick game** (`/juego/rapido`, `VistaJuegoRapido`): choose a set (radio; sets without questions are disabled with a reason) and press "Jugar": `crearJuegoRapido` -> `juegos.crear` -> `crearConfigPartida` -> confirm if needed -> `partidas.crear` -> panel. The created game is reused if "Jugar" is pressed again for the same set.
- **Setup form guards**: `EditorJuego` holds a synchronous `useRef` in-flight flag shared by "Guardar juego" and "Iniciar partida", so a second submit/click before the re-render never creates a second game. Turning the final round off clears its `preguntaIds`.

## Conductor panel (Fase 4)

- **Route**: `VistaPanel` (`/juego/panel/:partidaId`) remounts per id (`key`), so "Jugar de nuevo" starts clean; `/juego/panel` redirects to `obtenerEnCurso()` or explains how to start a game. Tests inject `entornoVentanas` (fake `window.open`) and `relojTemporizador` as props; `src/features/juego/panel/pruebaPanel.tsx` is the jsdom harness (in-memory bus, fake windows, manual clock, `botonHabilitado` waits for the previous save).
- **State** (`panel/usePartidaEnCurso`): loads with `cargarPartida(await partidas.obtener(id))`; `ok: false` renders `PartidaNoDisponible` (reasons, confirmed "Terminar partida" via `partidas.terminar`, link to Inicio). Holds `config` + the saved log; `estado` is always `reducir(config, savedLog)`. **Dispatch** = `validar` -> `partidas.agregarEvento` -> apply the returned log; undo = `partidas.deshacer`. Nothing is applied unsaved: a failed write shows a Spanish error and keeps the previous state. A ref serializes writes (calls during a save are ignored). Reaching `juegoTerminado` marks the partida `terminada` (no undo after that; ending actions confirm first); a loaded log that already ended is closed on load.
- **Actions** (`panel/useAccionesPanel`): named actions (`asignarTurno(e)`, `revelar(i)` -> `REVELAR` or `ROBO_EXITOSO` in `robo`, `tache`, `jugar`, `pasar(e?)`, `roboFallido`, `revelarTodas`, `siguienteRonda`, `terminarJuego`, `ajustarPuntos`, `rf*`, `deshacer`), each `{ habilitada, motivo, codigo, ejecutar() }`. `ejecutar` asks for confirmation when `confirmacionPara` says so (end of game, `RF_TERMINAR`, next round with hidden answers) and renders it through the hook's `dialogo`. Keyboard shortcuts call these same `ejecutar` functions. `BotonAccion` renders an action with `aria-disabled` (still focusable) and the reason as accessible description + tooltip.
- **Pure helpers** (`dominio/panel.ts`): `evaluarAccion`, `eventoRevelar`, `guiaPanel` (one "next step" sentence per phase), `accionSiguienteRonda`, `confirmacionPara`, `ganadoresJuego`, `ETIQUETAS_FASE`.
- **Layout** (`panel/PanelPartida`): header (name, round, multiplier, phase, board status, open/reconnect, Deshacer, Terminar partida), "Siguiente paso" guidance (`role="status"`), current question with every answer (points, synonyms, "Visible en el tablero"/"Oculta" taken from the projection itself), phase-aware `AccionesRonda`, `MarcadorPanel` (keys A-D, roles in words, strikes, pot, "Ajustar puntos" dialog), `PanelRondaFinal` (team change before the first answer, per-question text + match picker, prominent "Respuesta repetida" from `RESPUESTA_REPETIDA`, reveal, next player, finish) and `FinDeJuego` (winners, final scores, final-round result, "Volver al inicio", "Jugar de nuevo" = `prepararConfigPartida` with the same juego, falling back to the old snapshot).
- **Board**: `usePublicadorTablero({ partidaId, vista: proyectarTablero(config, estado), temporizador })` memoized; `useAbrirTablero` keeps `crearGestorTablero()` in a ref and shows the instructions dialog (`requiereInstrucciones`) or a pop-up blocked alert.
- **Final-round timer** (`panel/useTemporizador`, UI only): per-player seconds from `config.rondaFinal.segundos`, start/pause/reset, resets when the player changes, publishes whole seconds `{ restante, total, corriendo }` only during `rondaFinal`. Clock/scheduler injectable (`RelojTemporizador`).

## Sounds, shortcuts, animations and board polish (Fase 5)

- **Sounds** (`src/shared/sonido`, import from `@/shared/sonido`): four generated WAVs in `public/sonidos/` (`acierto`, `tache`, `revelar`, `ganador`; `npm run sonidos`, no third-party license). `useSonidos()` returns `{ silenciado, reproducir(nombre | null), alternarSilencio }`; the Howler player is created lazily and swallows audio errors; mute is a `useSyncExternalStore` store in `localStorage` (`top-respuestas:silencio`, try/catch, default sound on). `SonidosProvider` injects a fake player in tests (`pruebaPanel.tsx` does it by default).
- **When sounds play**: only in the panel window, after the host's event is saved (`usePartidaEnCurso.despachar`), via pure `sonidoDeEvento(config, evento, antes, despues)` (`features/juego/dominio/sonidos.ts`): `ganador` on the transition into `juegoTerminado`; `acierto` for REVELAR, ROBO_EXITOSO and scoring RF_REVELAR; `tache` for TACHE, ROBO_FALLIDO and no-match RF_REVELAR; `revelar` for REVELAR_TODAS and 0-point RF_REVELAR. Undo, load and failed writes are silent. A repeated final-round answer (rejected by `validar`, never saved) plays `tache` from `PanelRondaFinal` once per false -> true transition.
- **Shortcuts** (`panel/useAtajosPanel`, pure mapping `comandoDeTecla` in `dominio/atajos.ts`): `1`-`8` revelar (ROBO_EXITOSO in robo), `X` tache (robo fallido in robo), `A`-`D` asignar turno, `R` revelar todas, `Espacio` siguiente (jugar in cara a cara when enabled, siguiente ronda in finDeRonda, start/pause the timer in the final round), `Z` deshacer, `M` silenciar, `?` help sheet (`HojaAtajos`). Final round: only Espacio, Z, M, ?. Ignored in inputs/contenteditable, with any open dialog (except `?` closing the sheet), with Ctrl/Alt/Meta and on auto-repeat. Space always wins over a focused button (preventDefault on keydown and keyup; Enter presses buttons). Disabled actions and game actions pressed during a save announce their reason in a polite live region; M and ? keep working during a save.
- **Board animations** (`motion`, import from `motion/react`): answer slots flip with `initial={false}` so mount/reconnect never replays; `TableroRonda` is keyed by round number. `SobreposicionTachas` shows big red X only when `tachas` rises while mounted, and one X when `fallosCaraACara` rises (face-off misses, projected by the engine as a count that resets each round). `NumeroAnimado` + `useConteo` count scores, pot and the final-round total, with an `sr-only` final value next to the `aria-hidden` number. `MotionConfig reducedMotion="user"` + `useReducedMotion` honor reduced motion.
- **Board polish**: Tailwind `@theme` tokens `--text-tablero-*` (`clamp(min, min(Nvw, Mvh), max)`) in `src/app/index.css`; `h-dvh overflow-hidden`; one answer column up to 4 answers, two for 5-8. The waiting screen shows the last game name (`EstadoTablero.sinPartida.nombreJuego`). `useTarjetaRonda` + `TarjetaRonda` show a 3 s card (game name, "Ronda N de M", "Puntos dobles/triples", "Ronda final") when the same partida moves forward a round while mounted. `useCursorInactivo` hides the cursor and the fullscreen button after 3 s idle. `/tablero` is a lazy route, so `motion` lives in its own chunk.
- **Lazy routes** (`src/app/rutas.tsx`): every view except Inicio and the 404 loads through `rutaDiferida(path, cargar)` (React Router `lazy`, blank `aria-busy` fallback); `/tablero` has a dark fallback. All chunks stay precached (`dist/sw.js`). Main chunk ~440 kB; `rutasDiferidas.test.tsx` guards which routes are eager.
- **Testing motion**: `motion` captures `requestAnimationFrame` at import, so Vitest fake timers can't drive its frame loop; assert final state only. `useConteo` looks up `requestAnimationFrame` per call so fake timers drive count-ups. Reduced-motion tests stub `window.matchMedia` for a whole file.

## Testing

- Vitest runs in `node` by default. Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock on the first line (Vitest 5 has no `environmentMatchGlobs`).
- `src/test/setup.ts` installs `fake-indexeddb/auto` before any module loads Dexie (Dexie captures the globals on import and `liveQuery` needs them), registers jest-dom matchers, and in jsdom adds Testing Library cleanup plus a `<dialog>` `showModal`/`close` shim (jsdom lacks them).
- Use `crearEntornoPrueba()` (`src/test/baseDatosPrueba.ts`) for a fresh, isolated database per test with a deterministic clock (`reloj.avanzar`) and sequential ids (`id-1`, `id-2`, ...). Close it in `afterEach`.
- Test repositories through their interface; inject `entorno.repositorios` into `RepositoriosProvider` for view tests.
- Vitest runs with `maxWorkers: '50%'` (`vite.config.ts`): the default oversubscribed this laptop and made jsdom tests time out. Prefer fixing slow or racy tests over raising timeouts (wait for `toBeEnabled()` before clicking controls enabled by live queries; split long flows).
- Tests that render the router call `precargarRutas` (`src/test/precargarRutas.ts`) in `beforeAll`, so the first lazy import doesn't eat a `findBy*` timeout.

## Conventions

- **UI copy in Spanish (es-MX)**, neutral and friendly, addressing the user as "tú" everywhere (panel, board, dialogs, validation and engine `motivo` messages; third-person sentences about teams keep "su"/"puede"). Code comments and docs in English.
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
- The service worker (vite-plugin-pwa, `autoUpdate`) precaches js/css/html/svg/png/woff2/mp3/ogg/wav and falls back to `/index.html` for navigations.
- Zod is v4: customize messages with `{ error: '...' }`. React 19.3 types deprecate `FormEvent`; use `SubmitEvent<HTMLFormElement>` for form submit handlers.
- Confirmations use `DialogoConfirmacion` (`src/shared/ui`, native `<dialog>`), never `window.confirm`/`alert`.
