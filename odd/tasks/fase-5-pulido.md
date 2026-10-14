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
- [ ] T5.2 Keyboard shortcuts: `1`–`8` revelar (ROBO_EXITOSO in robo), `X` tache (robo fallido in robo), `A`–`D` asignar turno, `Z` deshacer, `Espacio` siguiente (the phase's next step: siguiente ronda / jugar…), `R` revelar todas, `M` silenciar, `?` help sheet dialog listing shortcuts; final-round mapping documented in the sheet; guards for inputs/dialogs/modifiers; disabled actions announce their reason (route: delegated writer; test-first with jsdom key events)
- [ ] T5.3 Board animations: answer flip on reveal, big red X overlay on tache (1 / 2 / 3 X), score count-up when points are awarded, final-round reveals; reduced-motion fallback (route: delegated writer; test-first where deterministic — what is rendered after the animation, reduced-motion path)
- [ ] T5.4 Projector polish: very large type and high contrast tuned for a projector (clamp-based sizes), waiting screen with the game name (keep last known name after `SIN_PARTIDA`), round title card (game name, "Ronda N", multiplier) at round start, hide the cursor after 3 s of inactivity on the board (route: delegated writer; test-first for the cursor timer and waiting screen)
- [ ] T5.5 Fase 4 follow-ups: engine `motivo` strings in "usted"; export `PREGUNTAS_RONDA_FINAL` from `@/engine` and remove the duplicate in `shared/modelo`; Inicio "Continuar partida" shows a neutral loading state instead of the disabled card (route: delegated writer or inline depending on size; tests updated)
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

## Next step

Commit T5.1, assess RDD, then T5.2 keyboard shortcuts (delegated writer).
