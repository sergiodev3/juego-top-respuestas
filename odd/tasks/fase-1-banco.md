# Fase 1 — Data model (Dexie) + question bank + sample data

## Objective

Persist question sets and questions locally with Dexie behind repository interfaces, provide the question bank UI (CRUD, search, topic filter, duplicate), and seed a sample set of 10 questions.

## Problem / Why

Every later phase (import, game config, engine snapshots, backups) reads and writes the bank. The data layer must be sync-ready (future Express + PostgreSQL) without rewriting the app.

## Scope

- In: shared domain model + Zod schemas (`src/shared/modelo`), Dexie schema v1 with all four spec tables (`sets`, `preguntas`, `juegos`, `partidas`) plus `meta`, repository interfaces + Dexie implementation for sets and preguntas, `navigator.storage.persist()` at startup, one-time seed, bank UI.
- Out: repositories for juegos/partidas (Fase 4), import (Fase 2), backups (Fase 7).

## Decisions (minor, chosen by parent)

- Soft delete via `eliminadoEn` (tombstones) so a future sync can propagate deletions without a migration; queries hide deleted rows. Deleting a set soft-deletes its questions.
- Seed runs once, tracked in `meta` (`semillaAplicada`), so deleting the sample set does not bring it back.
- Domain types + Zod schemas live in `src/shared/modelo` (reused by import in Fase 2 and by the engine snapshot types).
- Reactive reads with `dexie-react-hooks` `useLiveQuery`; no Zustand needed yet.
- Delivery: one branch per phase, no remote/PRs; size heuristic advisory only (`exception-ok`), commits split by work unit.

## Tasks

- [x] T1.1 Data layer: model + Zod, Dexie schema v1, repositories, storage persist, seed — test-first with fake-indexeddb (route: delegated writer — 2+ non-trivial files) — commit `f95dcef`
- [x] T1.2 Bank UI: sets list/create/edit/delete/duplicate, set detail with questions CRUD, answers editor (≤8, auto-sorted, synonyms), search + topic filter, duplicate question, confirmations (route: delegated writer, same worker) — commit `477ad5a` (+ `f710d2a` chore: ignore `.atl/`)
- [ ] T1.3 Verify (typecheck, lint, format:check, test, build), work-unit commits, RDD assessment

## Acceptance criteria

- First launch shows the sample set "Cultura general escolar" with 10 questions; data survives reload.
- Create/edit/delete/duplicate sets and questions; answers sorted by points desc, max 8, points ≥ 0 integers; friendly Spanish validation errors.
- Search by question text and filter by tema; deleted items disappear (soft delete).
- Repositories have tests against fake-indexeddb; Zod schemas have tests.

## Test-first

Runner: Vitest. RED → GREEN for repository behavior, seed idempotency, schema validation and answer sorting before implementation.

## Progress / evidence

- Branch `feat/fase-1-banco` created from `feat/fase-0-scaffold` @ 67f9d7e. Last reviewed boundary: af606b2.

- RED observed: each test file failed on missing modules before implementation; editor test failed on missing accessible name, fixed with `aria-label`.
- Writer GREEN: typecheck 0, lint 0, format:check clean, test 9 files / 55 passed, build OK.
- Parent spot check: test 55/55, lint 0.
- Versions: dexie 4.4.6, dexie-react-hooks 4.4.0, zod 4.6.7, fake-indexeddb 6.2.5, jsdom 29.1.1, @testing-library/react 16.3.3.
- Writer decisions: fully blank answer rows dropped; empty tema allowed ("Sin tema"); repos re-validate input and throw `ErrorRegistroNoEncontrado`; duplicated sets get " (copia)", questions don't; `<dialog>` stubbed in jsdom setup; per-file `// @vitest-environment jsdom`.
- Incident: `npm run format` reformatted untracked `.atl/skill-registry.md`; fixed by adding `.atl` to `.prettierignore` and regenerating the registry (which also added `.atl/` to `.gitignore`).

## Next step

RDD assessment over `af606b2..HEAD`, then user approval before Fase 2.
