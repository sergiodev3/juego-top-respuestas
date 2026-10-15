# Fase 5 — Animations, sounds, keyboard shortcuts, projector polish

## Objective

Make the game feel like a TV show and fast to host: keyboard-driven panel, sounds, board animations, and a board that reads well from the back of the classroom.

## Problem / Why

Fase 4 is fully playable but mouse-only, silent and static. The SPEC (sections 5 and 6) asks for shortcuts with a help sheet, sounds (acierto, tache, revelar, ganador) with mute, flip / big X / score animations, a hidden cursor after inactivity and a waiting screen with the game name between rounds.

## Scope

- In: panel keyboard shortcuts + `?` help sheet; sound effects + mute (`M`); board animations; projector polish (typography, waiting screen with game name, round title card, hidden cursor); Fase 4 follow-ups (engine `motivo` in "usted", export `PREGUNTAS_RONDA_FINAL` from the engine, Inicio "Continuar partida" loading flicker).
- Out: printing (Fase 6); backups, README, deploy (Fase 7).

## Decisions (minor, chosen by parent)

- **Sounds are generated, not downloaded:** a Node script (`npm run sonidos`) synthesizes short WAV files into `public/sonidos/` (committed). No third-party license, no credits needed; works offline. Add `wav` to the service-worker precache patterns.
- **Sounds play in the panel window**, triggered by the event the host just saved (not on undo, not on load/replay). The panel always has a user gesture, so autoplay is never blocked; both windows share the laptop's audio output anyway. Mute state is a per-device convenience in `localStorage` (try/catch, defaults to sound on).
- **Sound map:** `acierto` = REVELAR / ROBO_EXITOSO during play and final-round answers that score; `tache` = TACHE, failed robo, final-round no-match/repeat; `revelar` = answers revealed by the host without points (revelar todas, final-round reveal of zero); `ganador` = game over.
- **Animation library:** `motion` (the current package name of Framer Motion, imported from `motion/react`). Honor `prefers-reduced-motion` (no flips/count-ups, instant state).
- **Libraries:** `howler` (+ `@types/howler`) behind a small `shared/sonido` service with an injectable player so tests never touch audio.
- **Shortcuts call the existing `useAccionesPanel` actions** (`ejecutar`), so validation, confirmations and reasons stay identical to the buttons. Ignored while typing in inputs/textareas/selects, while a dialog is open, and with Ctrl/Alt/Meta modifiers.
- **Delivery:** same as previous phases — one branch per phase (`feat/fase-5-pulido` from `main` @ `0b14e33`), one work-unit commit per task, RDD assessed per commit range. Last reviewed boundary: `c5bb0b3` (so `4368369` joins the first Fase 5 range).

## Tasks

- [x] T5.1 Sounds: `scripts/generar-sonidos.mjs` + `npm run sonidos` (acierto, tache, revelar, ganador WAVs); `shared/sonido` service (Howler, injectable player, mute persisted); panel plays the sound for each saved event; mute button in the panel header; precache `wav` (route: delegated writer — 2+ non-trivial files; test-first for the event→sound mapping and the mute store)
- [x] T5.2 Keyboard shortcuts: `1`–`8` revelar (ROBO_EXITOSO in robo), `X` tache (robo fallido in robo), `A`–`D` asignar turno, `Z` deshacer, `Espacio` siguiente (the phase's next step: siguiente ronda / jugar…), `R` revelar todas, `M` silenciar, `?` help sheet dialog listing shortcuts; final-round mapping documented in the sheet; guards for inputs/dialogs/modifiers; disabled actions announce their reason (route: delegated writer; test-first with jsdom key events)
- [x] T5.3 Board animations: answer flip on reveal, big red X overlay on tache (1 / 2 / 3 X), score count-up when points are awarded, final-round reveals; reduced-motion fallback (route: delegated writer; test-first where deterministic — what is rendered after the animation, reduced-motion path)
- [x] T5.4 Projector polish: very large type and high contrast tuned for a projector (clamp-based sizes), waiting screen with the game name (keep last known name after `SIN_PARTIDA`), round title card (game name, "Ronda N", multiplier) at round start, hide the cursor after 3 s of inactivity on the board (route: delegated writer; test-first for the cursor timer and waiting screen)
- [x] T5.5 Fase 4 follow-ups: engine `motivo` strings in "usted"; export `PREGUNTAS_RONDA_FINAL` from `@/engine` and remove the duplicate in `shared/modelo`; Inicio "Continuar partida" shows a neutral loading state instead of the disabled card (route: delegated writer or inline depending on size; tests updated)
- [x] T5.7 Face-off miss X (added by user decision after T5.3): expose face-off misses in the projection (`proyectarTablero`) and the sync schema (`esquemaVistaTablero`, both-ways type test), and show one big red X on the board for each face-off miss without touching the 3-strike count (route: delegated writer — engine + sync + board; test-first, engine coverage gate)
- [ ] T5.6 Verify (typecheck, lint, format:check, test, build), work-unit commits per task, RDD per commit range, update CLAUDE.md (Fase 5 section)

## Acceptance criteria

- Every SPEC shortcut works in the panel, respects engine validation and confirmations, and never fires while typing or with a dialog open; `?` shows the sheet.
- Each sound plays once per saved action; undo and reload play nothing; `M` and the button mute/unmute and the choice survives a reload.
- Reveals flip, strikes show big X, scores animate; with reduced motion everything still renders correctly without animation.
- The board is legible from the back of a classroom, shows the game name while waiting and at each round start, and hides the cursor after inactivity.
- All checks green; app still works offline (sound files precached).

## Test-first

Runner: Vitest. Pure pieces (event→sound mapping, mute store, shortcut→action mapping, cursor inactivity timer) node tests first; panel/board behavior with jsdom + Testing Library (fake player, fake timers, `matchMedia` stub for reduced motion). Animations themselves are not asserted frame by frame; tests check the final rendered state.

## Progress / evidence

- Branch `feat/fase-5-pulido` from `main` @ `0b14e33`. Last reviewed commit: `c5bb0b3`.

- T5.1 (delegated writer): `scripts/generar-sonidos.mjs` (22050 Hz mono 16-bit WAVs, 18–66 KB), `src/shared/sonido` (`useSonidos()` → `{ silenciado, reproducir, alternarSilencio }`, Howler player created lazily, mute store `top-respuestas:silencio` via `useSyncExternalStore`), pure `sonidoDeEvento(config, evento, despues)` in `dominio/sonidos.ts`, panel plays only after a successful save; header mute button (single label "Silenciar sonido" + `aria-pressed`, accepted). The panel harness injects a fake player by default. RED → GREEN: mapping 7, mute store 5, Howler smoke 2, panel 3 of 5 failed first → 5/5. Also fixed a base lint error (`unbound-method` in `useTemporizador.test.ts` from `4368369`). Writer: typecheck, lint, format, test 54 files / 533, build OK (4 WAVs precached). Parent spot check: 533 passed, lint 0. ~880 authored lines (script + service + tests; not split).
  - Sound map: `ganador` when the phase becomes `juegoTerminado` (checked first); `acierto` REVELAR, ROBO_EXITOSO, RF_REVELAR > 0 pts; `tache` TACHE, ROBO_FALLIDO, RF_REVELAR with no match; `revelar` REVELAR_TODAS, RF_REVELAR of a 0-pt match.
  - Follow-up folded into T5.2: a repeated final-round answer is rejected by `validar` (never saved), so play `tache` in the panel when the host's answer is flagged as repeated (TV-show buzzer; UI-only sound).
  - Known: main chunk > 500 kB build warning (likely pre-existing; check in T5.6).

- T5.1 commit `18441a9`; RDD medium (range `c5bb0b3..18441a9`, 30 files / 1082 lines, includes `4368369` and the LICENSE merge); user granted; review-reliability approved; acknowledged (lineage review-855b26dab23cc9a5). Advisory (S): `ganador` fires on any event whose result is `juegoTerminado` — guard with "phase before was not `juegoTerminado`" (folded into T5.2). Last reviewed commit: `18441a9`.

- T5.2 (delegated writer): pure `comandoDeTecla(tecla, { fase, respuestas, equipos, jugarHabilitado })` in `dominio/atajos.ts`; `useAtajosPanel` (window keydown/keyup → existing action `ejecutar`, `alternarSilencio`, timer, help sheet; returns `{ aviso }` shown in a polite live region); `HojaAtajos` help sheet on `DialogoInformacion` + header button. Space: the shortcut always wins over a focused button (preventDefault on keydown and keyup; Enter still presses buttons). Final round: only Espacio (timer), Z, M, ? work. Guards: inputs/contenteditable, any open dialog (except `?` closing the sheet), Ctrl/Alt/Meta, repeat, save in flight. Follow-ups done: `sonidoDeEvento(config, evento, antes, despues)` plays `ganador` only on the transition into `juegoTerminado`; repeated final-round answer plays `tache` once per transition (UI-only, respects mute). RED → GREEN: sonidos 2 of 8 failed → 8/8; atajos module missing → 9/9; panel jsdom 14 of 16 failed → 16/16 (the 2 "nothing happens" guards passed early). Writer: typecheck, lint, format, test 56 files / 559, build OK. ~860 authored lines (16 jsdom tests + sheet copy; not split).
  - Parent spot check: lint 0; full suite 1 of 3 runs failed `VistaPanelRondaFinal.test.tsx` (passes alone and on 2 reruns); the writer saw a similar load-only timeout in `PanelImportacion.test.tsx`. Known flake under full-suite load → fix in T5.6.

- T5.2 commit `6e6aa4e`; RDD medium (13 files / 873 lines); user granted; review-reliability approved; acknowledged (lineage review-58bcc421bba08fd8). Last reviewed commit: `6e6aa4e`. Advisories (S, folded into T5.5): (1) `useAtajosPanel.ts:131` drops a key silently while a save is in flight; (2) `PanelRondaFinal.tsx:108` the repeated-answer `tache` effect depends on `reproducir`, so a changed `reproducir` identity (e.g. mute toggle) can replay the buzzer while still repeated — key it on the transition only.

- T5.3 (delegated writer): answer flip (`motion.li`, `initial={false}` so mount/reconnect never replays; `TableroRonda` keyed by `ronda.numero`), `SobreposicionTachas` (big red X, only when `tachas` rises while mounted, 1.2 s, `role="img"`), `NumeroAnimado` + `useConteo` count-up (looks up `requestAnimationFrame` per call so fake timers drive it; `sr-only` final text next to an `aria-hidden` number), final-round flips/total, `MotionConfig reducedMotion="user"` + `useReducedMotion`. RED → GREEN: overlay, score count-up, pot, final-round total/flip; flip final-state guards passed early; reduced-motion verified by forcing the stub (2 of 3 fail). ~500 authored lines.
  - Parent: the writer installed `motion@14.2.0`, published one day earlier → pinned `motion@13.4.6` (2026-09-29, ≥ 2 weeks old); typecheck OK, board 24/24.
  - Flake: `VistaPanelRondaFinal.test.tsx` takes ~4 s alone with or without T5.3 (measured) but exceeds the 15 s `testTimeout` under full-suite load (12 workers); now fails most full runs → fix in T5.6. `PanelImportacion.test.tsx` flakes the same way.
  - Open: a face-off (cara a cara) miss is not in the projection (`caraACara.intentos` stays engine-side), so the board shows no X for it → product question to the user. Main chunk 841 kB with `motion` (board route not lazy) → T5.4/T5.6.

- T5.3 commit `120482f`; RDD medium (13 files / 663 lines); user granted; review-reliability approved with no advisories; acknowledged (lineage review-cd1c2a39618918a9). Last reviewed commit: `120482f`.
- User decision (2026-10-14): a face-off miss shows one big X on the board, as on TV → new task T5.7 (engine projection + sync schema + board).

- T5.7 (delegated writer): `VistaRonda.fallosCaraACara` = face-off attempts without an answer in the current round (a count only; kept for the whole round and reset at the next round, so undoing JUGAR never raises it and fakes an X); required in `esquemaVistaTablero`; `TableroRonda` reuses `SobreposicionTachas` with `maximas={1}` when the count rises while mounted. RED → GREEN: engine 6 failed first → 16/16 (the no-leak test passed early); sync 2 failed → green; board "one X per face-off miss" failed → green; reduced-motion test added after the code. Writer: typecheck, lint, format clean; coverage engine lines 98.75 / statements 98.78 / functions 100 / branches 93.77; test 58 files / 582. Parent spot check: engine + sync + board 20 files / 311 passed, lint 0. ~150 authored lines.

- T5.7 commit `480f87b`; RDD assess medium, 153 lines, `review_due: false` (`under_budget`) → stays pending in the slice; last reviewed boundary remains `120482f`.

- T5.4 (delegated writer): Tailwind `@theme` tokens `--text-tablero-*` = `clamp(min, min(Nvw, Mvh), max)` (fits 4:3 and 16:9), `h-dvh overflow-hidden`, answers in one column (≤ 4) or two (5–8, TV style), AAA text colors; last game name kept in `EstadoTablero.sinPartida.nombreJuego` by the pure reducer (protocol/schemas unchanged); `useTarjetaRonda` + `TarjetaRonda` full-screen card for 3 s when the same partida moves to a higher round or into the final round (nothing on mount/reconnect/undo/other partida); `useCursorInactivo` hides cursor + fullscreen button after 3 s idle; `/tablero` lazy via React Router `lazy` with a dark hydrate fallback. RED → GREEN: sync reducer 4 failed → 23/23; waiting name 1 → green; cursor hook missing → 3/3; idle cursor in view 1 → green; title card 3 of 4 → 4/4 (guard passed early); reduced-motion card and lazy route test written after the code. Writer: typecheck, lint, format clean; test 61 files / 594; build main chunk 836 → 689 kB, `motion` only in the `VistaTablero` chunk (147 kB, precached). Parent spot check: board + sync + app 12 files / 68 passed, lint 0. ~660 authored lines (more than half tests).
  - Not done (accepted): no title card for round 1 of a new partida ("Jugar de nuevo"), since it can't be told apart from reopening a partida mid-round. Not yet checked in a real browser at 1024×768 / 1920×1080 → user's manual test. Main chunk still > 500 kB → T5.6.

- T5.4 commit `0041805`; RDD medium (range `120482f..0041805` incl. T5.7, 26 files / 832 lines); user granted (after the 2026-10-14 pause); review-reliability approved; acknowledged (lineage review-df1ca7f6388d0b92). Last reviewed commit: `0041805`. Advisory (W): `src/engine/README.md:20` table row merged with the "Types" row → fixed inline (route: inline — one passive doc line).

- T5.5 (delegated writer): 8 engine strings to "usted" (7 defaults in `rechazos.ts` + 1 in `reglas/caraACara.ts`; `codigo` unchanged; 5 assertions updated, table test added); `PREGUNTAS_RONDA_FINAL` exported from `@/engine` and re-exported by `shared/modelo`; Inicio shows a neutral "Buscando una partida en curso…" card (`aria-busy`) while loading; shortcuts during a save announce "Espere un momento: se está guardando la jugada anterior."; the repeated-answer buzzer plays only on the false → true transition (ref), harness gained `renovarReproductor()` to make a real RED. RED → GREEN: engine 9 failed → 277/277; constant 1 → green; Inicio 1 → green; save message 1 → green; buzzer 1 → green. Writer: typecheck, lint, format clean; coverage engine lines 97.88 / branches 92.74 / functions 100; test 602–601 of 603 (flakes only). ~260 authored lines.
  - Parent (inline, one mechanical line + test): M and ? keep working during a save (they never touch the log). RED: aria-pressed stayed `false` → GREEN 18/18; lint, typecheck, format clean.
  - New flake under full-suite load: `src/app/rutaTablero.test.tsx` → T5.6.
  - Found: most of the app outside the panel still uses "tú" (Inicio, banco, importar, respaldos, Zod messages in `shared/modelo`) → product question to the user (one form for the whole app).

## Next step

Commit T5.5; ask the user tú vs usted for the whole app; then T5.6.
