# Fase 2 — Import .xlsx/.csv with templates, preview and validation

## Objective

Let the teacher set up a game in minutes: download a template, drop a filled .xlsx/.csv, see valid/invalid rows with exact per-row reasons, import into a set, or "Importar y jugar" in one step.

## Problem / Why

Typing questions one by one is too slow for class prep. Spec marks import as a priority feature.

## Scope

- In: SheetJS (from cdn.sheetjs.com tarball) + PapaParse; downloadable templates (.xlsx and .csv, generated client-side so they work offline); drag-and-drop + file picker; pure parse/validate module; preview table; import into a new or existing set; "Importar y jugar" creating a `Juego` with defaults; minimal `Juego` model + `RepositorioJuegos` (create/get/list) reused in Fase 4.
- Out: full game configuration UI and panel (Fase 4).

## Format

One row per question: `Tema | Pregunta | R1 | Pts1 | … | R8 | Pts8 | Sinónimos`; synonyms as `R1: auto, coche; R3: celular`, mapped to their answer before sorting by points.

## Decisions (minor, chosen by parent)

- Header matching is case/accent/space-insensitive; column order free; missing optional columns allowed.
- CSV encoding: try strict UTF-8, fall back to windows-1252 (Excel on Windows often saves CSV that way); CSV template written with UTF-8 BOM so Excel shows accents. Delimiter auto-detected (`,` or `;`).
- Errors block a row; warnings (e.g. duplicate question text in file or already in target set) don't.
- Import libraries are lazy-loaded (dynamic import) to keep the initial bundle small; still precached for offline.
- "Importar y jugar" defaults: 2 teams ("Equipo A", "Equipo B" with distinct colors), up to 4 rounds from the imported questions in file order, multipliers x1 for all except — when there are 4 rounds — round 3 x2 and round 4 x3; final round off; 3 strikes. Then navigates to the Configurar juego view, which for now shows the created game's summary.
- Target set for "Importar y jugar": new set named after the file.

## Tasks

- [x] T2.1 Import domain (pure, test-first): matrix → validated rows with exact Spanish reasons, synonyms mapping, sorting, header mapping, encoding detection, CSV/XLSX readers, template generation; `Juego` model + defaults + `RepositorioJuegos` (route: delegated writer — 2+ non-trivial files) — commit `0605265`
- [x] T2.2 Import UI: templates download, drag-and-drop, preview (valid/invalid with reasons, warnings), choose target set, import, "Importar y jugar" → Configurar juego summary (route: same delegated writer) — commit `53e2fd6`
- [ ] T2.3 Verify (typecheck, lint, format:check, test, build), work-unit commits, RDD assessment

## Acceptance criteria

- Downloaded templates re-import with zero errors (round-trip test for both formats).
- Invalid rows show row number and exact reason(s) in Spanish; valid rows import; answers sorted by points; synonyms land on the right answer.
- A CSV saved as windows-1252 imports accents correctly.
- "Importar y jugar" creates a set + a juego and lands on its summary in one click.

## Test-first

Runner: Vitest (node env for domain, jsdom for UI). RED → GREEN for parsing/validation rules, synonyms, encoding fallback, template round-trip, game defaults.

## Progress / evidence

- Branch `feat/fase-2-importar` from `feat/fase-1-banco` @ 4e97fcd. Last reviewed boundary: b95e679.

- RED observed per slice (missing modules; repo/service 8/8 failing; UI tests failing) → GREEN.
- Writer GREEN: typecheck 0, lint 0, format:check clean, test 20 files / 123 passed, build OK (xlsx 492 kB and papaparse 19 kB in separate lazy chunks, precached; main chunk 561 kB warning pre-existing at 530 kB).
- Parent spot check: test 20 files / 123 passed.
- Versions: xlsx 0.20.3 (https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz; versions list at https://cdn.sheetjs.com/xlsx.lst), papaparse 5.7.0.
- Writer decisions: file-level errors returned as `{ok:false}`; synonym errors block the row; import service lives in db layer (single Dexie transaction); "Importar y jugar" always creates a new set; preview replaced by success message with link to set.
- Note: last reviewed boundary is b95e679 (review covered af606b2..b95e679); 4e97fcd (docs only) is part of this slice.

## Follow-ups

- Main chunk >500 kB (pre-existing): consider route-level code splitting in Fase 5/7.

## Next step

RDD assessment over `b95e679..HEAD`, then user approval before Fase 3.
