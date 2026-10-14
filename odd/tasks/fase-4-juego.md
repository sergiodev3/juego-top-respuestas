# Fase 4 — Game configuration + conductor panel + synced board + second screen

## Objective

Play a real game: configure it (or start one in two clicks), run it from the conductor panel on the laptop, and show the board on the projector, kept in sync, recoverable after reload or crash.

## Problem / Why

Phases 1–3 built the bank, import and a pure engine. Nothing yet persists a running match, renders the board, or drives the engine from a UI.

## Scope

- In: partidas persistence (snapshot + event log saved after every action, resume via `reconstruir`), game configuration UI, conductor panel (all engine events, enabled via `validar`), final-round UI with timer, BroadcastChannel sync with Zod-validated messages, board view (functional, high-contrast; polish in Fase 5), second-screen opening via Window Management API with fallback.
- Out: animations, sounds, keyboard shortcuts, projector polish (Fase 5); printing (Fase 6); backups/README/deploy (Fase 7).

## Decisions (minor, chosen by parent)

- **Snapshot:** a partida stores a `ConfigPartida` built from the Juego + current questions at start time (pure function `crearConfigPartida(juego, preguntasPorId)`); later bank edits don't affect it.
- **Persistence:** each accepted event is appended and saved (Dexie) before the UI considers it done. A failed write is reported in Spanish, and the in-memory log is kept so nothing is lost. Undo = remove last event and save.
- **Loading:** always goes through `reconstruir`; `ok: false` shows a friendly error with the option to end the partida (never crashes). Engine warnings (skipped events) are surfaced discreetly in the panel.
- **One active partida:** starting a new one while another is "en curso" asks for confirmation and marks the old one "terminada". Inicio shows "Continuar partida" for the active one.
- **Quick game ("Nuevo juego rápido", 2 clicks):** choose a set → start. Defaults: 2 teams, up to 4 rounds with questions picked at random from the set (x2/x3 on rounds 3/4 when there are 4), final round off.
- **Question selection in configuration:** manual (pick from bank with search/tema filter), by tema (random among questions of chosen temas), random (from chosen sets). Selection happens at configuration time; the snapshot is deterministic.
- **Sync protocol (`src/shared/sync`):** channel `top-respuestas`. Messages (Zod discriminated union, versioned `v: 1`): panel→board `ESTADO_TABLERO { partidaId, secuencia, vista: VistaTablero }` and `SIN_PARTIDA`; board→panel `SOLICITAR_ESTADO` (on open/reconnect) and `TABLERO_PRESENTE` heartbeat (every 2 s; panel shows "Tablero conectado" if seen in the last 5 s). Board ignores invalid messages and stale `secuencia`. Board never receives unrevealed answers (it only gets `proyectarTablero`).
- **Second screen (`src/shared/pantallas`):** if `getScreenDetails` exists, request it on click, open the board popup on a non-primary screen at its bounds; otherwise (or on denial / single screen) `window.open` + an instructions dialog ("arrastre la ventana al proyector y presione el botón de pantalla completa"). Fullscreen requires one click inside the board (browser rule). "Reconectar tablero" re-focuses or reopens.
- **Final-round timer:** UI-only, 20 s / 25 s (configurable); shown in panel and board via the sync message (`temporizador { restante, corriendo } | null` sent alongside the view; not part of the engine).

## Tasks

- [x] T4.1 Infra: `RepositorioPartidas` (crear, obtener, obtenerEnCurso, agregarEvento, deshacer, terminar) + `crearConfigPartida` + quick-game defaults; sync protocol + Zod schemas (incl. `VistaTablero`) + BroadcastChannel adapter; second-screen helper; board view `/tablero` rendering the projection; Inicio "Continuar partida" (route: delegated writer A — 2+ non-trivial files; test-first)
- [x] T4.2 Configuration UI: `/juego/configurar` (new) and `/juego/configurar/:juegoId` (edit/saved): name, teams 2–4 (name, color), strikes, rounds (count, per-round multiplier, question per round), selection modes (manual / tema / random), final round (toggle, 5 questions, seconds, goal); "Iniciar partida"; "Nuevo juego rápido" from Inicio (route: delegated writer B; test-first)
- [ ] T4.3 Conductor panel `/juego/panel/:partidaId`: current question with all answers, points, synonyms and revealed markers; scores, strikes, turn, multiplier, phase; action buttons for every event, enabled/disabled via `validar` with the Spanish reason as tooltip/description; face-off flow, PASAR team picker (3–4 teams), steal assignment; final-round UI (player answers with match picker / no match, repeat warning, reveal, switch player, timer); undo; confirmations (terminar partida, siguiente ronda with hidden answers); open/reconnect board + connection indicator; publishes the projection on every change (route: delegated writer C; test-first)
- [ ] T4.4 Verify (typecheck, lint, format:check, test, build), work-unit commits per task, RDD per commit range

## Acceptance criteria

- A full game can be played from the panel with the board in another window, staying in sync; closing and reopening the board recovers instantly; reloading the panel resumes the exact state.
- No unrevealed answer ever reaches the board window (messages carry only projections; test).
- Quick game: Inicio → "Nuevo juego rápido" → choose set → playing in 2 clicks.
- Every panel action respects engine validation; destructive actions confirm.

## Test-first

Runner: Vitest. Pure pieces (config builder, sync schemas/protocol logic, presence tracking, screen selection logic) node tests first; UI flows with jsdom + Testing Library (BroadcastChannel and `getScreenDetails` faked).

## Progress / evidence

- Branch `feat/fase-4-juego` from `feat/fase-3-motor` @ 11717b0. Last reviewed commit: `4e3b240`.

- T4.1 (writer A): RED → GREEN per slice (repo 8, migration, snapshot 8, cargarPartida 3, sync 14, screens 10, hooks 6, board 10/11, inicio 2); BroadcastChannel adapter test written after code (exception, runs on Node's real BroadcastChannel). Writer: typecheck/lint/format clean, test 44 files / 454 passed, coverage engine unchanged, build OK. Parent spot check: 454 passed, lint 0.
  - Dexie **v2** added (same indexes; upgrade normalizes placeholder partidas rows); upgrade test opens a real v1 DB first.
  - `secuencia` is clock-based and monotonic so a reloaded panel is never stale for an open board; `publicar` re-parses messages (strips non-projection fields); publisher sends `SIN_PARTIDA` on unmount / null data.
  - Deferred to Fase 5: hide the cursor on the board after inactivity. Known: Inicio "Continuar partida" briefly shows the disabled card while loading.
  - Handoff for B: quick game = `crearJuegoRapido` → `juegos.crear` → `crearConfigPartida` → `partidas.crear` (ends other active partida itself; UI must confirm first) → `rutaPanel(id)`.
  - Handoff for C: load with `cargarPartida(await partidas.obtener(id))`; `validar` → `agregarEvento`/`deshacer` (return saved log); `usePublicadorTablero({ partidaId, vista: proyectarTablero(...), temporizador })` memoized; `crearGestorTablero()` in a ref; instructions dialog when `requiereInstrucciones`; blocked-popup message when `bloqueado`.

- T4.1 commit `691e39f`; RDD medium (45 files / 3108 lines); user granted; review-reliability approved; acknowledged (lineage review-9f7830c4b91b2e36). Advisory (S): v2 upgrade only ends placeholder partidas with `config === undefined`; a row with `null`/unusable config stays `enCurso` → panel must offer "terminar partida" when `cargarPartida` fails (covered by T4.3 requirement).

- T4.2 (writer B): RED → GREEN (juegos repo 3, model 2, edicionJuego module, configurar view 9, quick game, app routes 2). Writer: typecheck/lint/format clean, test 46 files / 480 passed, build OK. Parent spot check: 480 passed, lint 0. Juegos repo gained `actualizar` + `eliminar` (soft). Pure editing domain in `dominio/edicionJuego.ts`; shared start flow `useIniciarPartida`; quick game at `/juego/rapido`; manual picker hides questions already used; random fills replace rounds without reuse; "Guardar" checks schema only, "Iniciar" runs full validation. ~2,600 authored lines incl. tests (coherent UI, not split). `PREGUNTAS_RONDA_FINAL` duplicated in `shared/modelo` because the engine doesn't export it (follow-up: export from engine).

## Next step

Commit T4.2 + RDD, then T4.3 delegated writer C (panel).
