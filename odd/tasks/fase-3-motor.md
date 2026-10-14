# Fase 3 — Game engine (pure TypeScript, fully tested, no UI)

## Objective

Implement the event-sourced game engine in `src/engine/`: `estado = reducir(config, eventos)`, rule validation, board projection, and the final round, with high test coverage. No React, Dexie, or UI.

## Problem / Why

The engine is the core of the app: the panel (Fase 4) dispatches events, persists the event log after each action, and the board renders a projection. Undo and crash recovery come from replaying the log, so the reducer must be deterministic and strict.

## Scope

- In: types, `reducir`, `aplicar`/`validar`, `deshacer`, `proyectarTablero`, final round, coverage threshold for `src/engine`.
- Out: persistence of partidas, panel/board UI, timer (UI-side), sounds.

## Rules specification (source of truth for this phase)

### Config snapshot (`ConfigPartida`)

`nombre`; `equipos` (2–4, `{ id, nombre, color }`); `rondas: { pregunta: PreguntaSnapshot, multiplicador: 1|2|3 }[]` (≥1); `tachasMaximas` (default 3); `rondaFinal: { preguntas: PreguntaSnapshot[] (exactly 5), segundos: [number, number], meta: number } | null`. `PreguntaSnapshot { id, tema, texto, respuestas: { texto, puntos, sinonimos }[] }` with answers already sorted by points desc (index 0 = top answer). Engine-owned types; no imports from db/features/app.

### Phases

`caraACara → enJuego → robo → finDeRonda`, plus `rondaFinal` and `juegoTerminado`. Teams are addressed by index (0–3 ↔ keys A–D).

### Cara a cara (face-off) — option A (all teams may buzz)

- `ASIGNAR_TURNO(e)`: team `e` buzzed first and is now the responder. Each attempt is one responder answering once.
- `REVELAR(i)` by the responder: reveals answer `i`, its points go into the round pot (`bolsa`), the attempt is recorded as a hit.
- `TACHE`: responder missed; recorded as a miss; does NOT count toward the 3 strikes.
- Resolution: immediately if a responder reveals index 0; otherwise once there are ≥2 attempts and ≥1 hit, the winner is the team with the highest-points hit (ties → earliest attempt). If all attempts miss, the face-off continues with new `ASIGNAR_TURNO`.
- After resolution the face-off awaits a decision. `ASIGNAR_TURNO(e)` at that point is a conductor correction that sets the winner to `e`.
- `JUGAR`: winner takes control → `enJuego`. `PASAR(equipo?)`: control goes to another team → `enJuego`. With 2 teams `equipo` is optional (defaults to the other team). With 3–4 teams it is required and must differ from the winner.
- Answers revealed during the face-off stay revealed and their points stay in the pot.

### En juego (control team answers)

- `REVELAR(i)` (not yet revealed): reveal, add points to the pot. If all answers are now revealed → the control team wins the pot × multiplier → `finDeRonda`.
- `TACHE`: strikes + 1. On reaching `tachasMaximas` → `robo`. With 2 teams the stealing team is the other team automatically. With 3–4 teams it is unset until `ASIGNAR_TURNO(e)` (e ≠ control team).

### Robo (steal)

- `ROBO_EXITOSO(i)`: reveals `i`, adds its points to the pot, the stealing team wins the pot × multiplier → `finDeRonda`.
- `ROBO_FALLIDO`: the control team wins the pot × multiplier → `finDeRonda`.
- Both require a stealing team to be set.

### Fin de ronda

- `REVELAR_TODAS`: reveal every remaining answer without adding points (marked as revealed-without-points).
- `SIGUIENTE_RONDA`: next round's `caraACara` (fresh round state); after the last round → `rondaFinal` if configured, else `juegoTerminado`. Only valid in `finDeRonda` (the UI confirms when answers remain hidden).

### Any time (except `juegoTerminado` unless stated)

- `AJUSTAR_PUNTOS(equipo, delta)`: integer delta, non-zero; scores may go negative (teacher's call).
- `TERMINAR_JUEGO`: → `juegoTerminado` (UI confirms).
- `DESHACER` is NOT an event: `deshacer(eventos)` returns the log without its last event.

### Ronda final ("Respuesta rápida")

- Entered after the last round when configured. The playing team defaults to the team with the highest score (ties → lowest index). `ASIGNAR_TURNO(e)` before any answer changes it.
- `RF_RESPUESTA { jugador: 1|2, pregunta: 0–4, indice: number | null, texto: string }`: records what the player said; `indice` = matched answer or `null` (no match, 0 points). Answering the same (jugador, pregunta) again replaces the previous answer (correction).
- Repeated answer: for player 2, an `indice` equal to player 1's non-null `indice` on the same question is rejected with reason code `RESPUESTA_REPETIDA` (the UI warns and plays the buzzer).
- `RF_REVELAR { jugador, pregunta }`: reveals that answer + points on the board (requires the answer to exist).
- `RF_SIGUIENTE_JUGADOR`: switches from player 1 to player 2; player 1's answers are hidden on the board while player 2 plays, and shown again when the round ends.
- `RF_TERMINAR`: ends the final round → `juegoTerminado`. Result: total = sum of revealed answer points across both players; `superoMeta = total ≥ meta`. Final-round points are a separate bonus result and are NOT added to team scores.
- The timer lives in the UI; the engine stores nothing time-based.

### Validation and replay

- `validar(config, estado, evento)` → `{ ok: true } | { ok: false, codigo, motivo }`, where `motivo` is user-facing Spanish (es-MX) and `codigo` is a stable string. The panel uses it to enable and disable actions.
- `aplicar` applies only valid events. `reducir(config, eventos)` replays the log. An invalid event in a stored log is skipped and reported in `estado.advertencias` (`{ indice, codigo, motivo }`) instead of throwing, so a partida can always be recovered.
- Pure and deterministic: no `Date`, `Math.random`, or I/O.

### Board projection (`proyectarTablero(config, estado)`)

Only what the students may see: game name, phase, round number/total, multiplier, question text, answers as `{ numero, revelada, texto?, puntos? }` (texto/puntos ONLY when revealed), strikes, pot, scores with team names/colors, team in control, stealing team, face-off winner, round winner and points awarded. For the final round: player answers with only revealed ones visible, player 1 hidden while player 2 plays, running total, goal, and the result when finished. Never leaks unrevealed answers or synonyms. Must be JSON-serializable (for BroadcastChannel + Zod in Fase 4).

## Tasks

- [x] T3.1 Types + face-off + en juego + robo + fin de ronda + adjustments + terminate + undo + validation + replay with warnings (route: delegated writer — 2+ non-trivial files; test-first)
- [x] T3.2 Final round + board projection + coverage threshold for `src/engine` (lines ≥ 95%, branches ≥ 90%) (route: same delegated writer; test-first)
- [x] T3.3 Verify (typecheck, lint incl. engine import restrictions, format:check, test, coverage), work-unit commits, RDD

## Acceptance criteria

- Every rule above has at least one test; full-game scenario tests for 2 teams and for 3–4 teams; undo by replay equals the previous state; the projection never contains an unrevealed answer text (property-style test over many states).
- Engine coverage meets the threshold; no imports outside `src/engine` except type-only from `@/shared` if strictly needed (prefer none).

## Test-first

Runner: Vitest (node env). RED → GREEN per rule group.

## Progress / evidence

- Branch `feat/fase-3-motor` from `feat/fase-2-importar` @ bfddb13. Last reviewed boundary: 95e2963 → T2.4 reviewed through `7888312`.

- RED observed per rule group against reject-everything stubs (face-off 23/29, en juego + robo 21, fin de ronda + generales, final round 20, projection 9) → GREEN. Replay/undo/scenario suites passed on first run (characterization).
- Spec gap closed (parent decision): `JUGAR`/`PASAR` when the face-off revealed every answer ends the round; the team taking control wins pot × multiplier (RED 3 → GREEN).
- Writer verification: typecheck, lint, format, test 31 files / 293 passed, coverage statements 98.95 / branches 93.84 / functions 100 / lines 98.93, build OK.
- Parent: under coverage the full suite showed 2 flaky jsdom timeouts (EditorPregunta, VistaConfigurarJuego) on a loaded machine; fixed by `testTimeout: 15_000` and scoping `test:coverage` to `src/engine`. Re-run: test 31/293 passed; coverage 11 files / 160 passed with thresholds met; format, lint, typecheck, build OK.
- Work units: T3.1 and T3.2 share `tipos.ts`, `index.ts`, `motor.ts`, `finDeRonda.ts → rondaFinal.ts`, so they are committed as one engine commit.
- Writer "spec questions" resolved conservatively (documented in `src/engine/README.md`): `TERMINAR_JUEGO` in final round → result null; `RF_RESPUESTA` only by the player in turn; correcting a revealed final answer hides it again; player 1 reveals stay hidden on the board while player 2 plays; `REVELAR_TODAS` rejected when nothing is hidden; `validarConfig` requires sorted answers; final-round board shows what the player said.

- [x] T3.3 commit `a734ed1`; RDD medium (`slice_budget_reached`, 32 files / 3345 lines); user granted; review-reliability approved; acknowledged (lineage review-002fdf8f8cb2a45f). Reviewed boundary → `a734ed1`.

- [x] T3.4 User decision + review warnings (route: delegated writer — 2+ non-trivial engine files; test-first):
  - User decision (2026-10-14): final-round points ARE added to the playing team's score on `RF_TERMINAR` (supersedes "separate bonus, not added"). `TERMINAR_JUEGO` during the final round still ends with `resultado: null` and adds nothing.
  - Safe rebuild entry point: `reconstruir(config: unknown, eventos: unknown)` → `{ ok: true, estado, advertencias } | { ok: false, errores: string[] }`; never throws. Config validated with a Zod schema + `validarConfig`; each stored event validated with a Zod event schema; malformed events are skipped into `advertencias` with code `EVENTO_MALFORMADO`. Zod is allowed in the engine (pure library).
  - Tests for malformed shapes of every event type and invalid/missing config.

  - Evidence: RED final-round scoring 6, schemas 63, corrupted-log 1, `reconstruir` 32 → GREEN. Writer: typecheck/lint/format clean, test 33 files / 389 passed, coverage 13 files / 256 passed, engine 98.78 / 93.77 / 100 / 98.75. Parent spot check: 389 passed, lint 0. New exports: `reconstruir`, `esquemaEvento`, `esquemaConfigPartida`, `ResultadoReconstruccion`, `EVENTO_MALFORMADO`. `reducir` now schema-checks stored events (malformed → `EVENTO_MALFORMADO`); `validar`/`aplicar` unchanged; unknown keys stripped for forward compatibility; schemas tied to TS types via `satisfies` + `expectTypeOf`.

## User confirmation (2026-10-14)

- Ran tests: 293 passed; coverage run shows 160 (engine-only by design since `test:coverage` is scoped to `src/engine`).

## Follow-ups (advisory; folded into T3.4)

- (W) `reducir` calls `crearEstadoInicial`, which throws on an invalid config — contradicts "replay never throws"; return a recoverable result (or validate the snapshot at load) and test it.
- (W) Runtime event-shape guard only checks `tipo`; malformed fields of known events reach rule code. Validate stored events with a Zod schema at the persistence boundary (Fase 4 already needs Zod schemas for events/messages) and add replay tests for malformed shapes.

- T3.4 commit `4e3b240`; RDD medium (16 files / 680 lines); user granted; review-reliability approved; acknowledged (lineage review-0efa2ebc1f4236b1). Advisory (S): config schema accepts fractional answer points — consider `Number.isInteger` on `puntos` in `esquemaConfigPartida`.

## Next step

Fase 3 complete. User asked to start Fase 4 after these fixes.
