# Fase 6 — Printable host cards

## Objective

Let the host print question cards (and an optional paper scoreboard) so a game can be run or backed up on paper.

## Problem / Why

SPEC section 7: the host needs printed cards with every answer, points and synonyms, letter size with cut lines, for a whole set or just the questions of a game, plus an optional paper scoreboard as a backup. `/impresion` is still a placeholder (`VistaEnConstruccion`).

## Scope

- In: `/impresion` view (source = a set or a game, 2 or 4 cards per letter sheet, cut lines, `@media print`), card content (number/ID, tema, big question, answers sorted with points and synonyms), entry points from the bank and the saved games, optional paper scoreboard sheet.
- Out: backups, README, deploy (Fase 7). No PDF generation library: the browser's print dialog ("Guardar como PDF") covers it offline.

## Decisions (minor, chosen by parent)

- **Printing = browser print** (`window.print()`, injectable for tests) with Tailwind `print:` variants and `@page { size: letter; margin: … }`. The app shell (header/nav) and the on-screen controls are hidden when printing; the preview on screen looks like the printed sheets.
- **Source in the URL**: `/impresion?set=<id>` or `/impresion?juego=<id>` (bookmarkable, works from links); without a source the view shows a picker (sets and saved games). Layout `?por-hoja=2|4` (default 2).
- **Sheets**: portrait letter. 2 per sheet = two cards stacked with a dashed horizontal cut line; 4 per sheet = 2×2 grid with dashed cut lines. A pure function groups cards into sheets; each sheet breaks the page (`break-after: page`, `break-inside: avoid`).
- **Card number/ID**: set cards are numbered 1..N in bank order with a short ID (first 8 chars of the question id) for cross-checking; game cards show "Ronda N" (and "Ronda final · Pregunta N" for the final round, which has no points multiplier).
- **Game cards show points as played**: in x2/x3 rounds the points are already multiplied with a "Puntos x2" label, matching the board and the panel (Fase 5 decision: what is shown is what the team wins). Set cards show base points.
- **Deleted questions** in a game: the card is replaced by a short notice ("La pregunta de la ronda N ya no está en el banco.") instead of failing the whole print.
- **Paper scoreboard** (optional checkbox, only meaningful for a game but also available blank for a set): one extra sheet with team names (or blank rows for 4 teams), one column per round with its multiplier, final round and total.
- **Delivery**: one branch per phase (`feat/fase-6-impresion` from `main` @ `d26fbfb`), one work-unit commit per task, RDD per commit range; push/PR only on request.

## Tasks

- [x] T6.1 Print domain + cards view: pure `crearTarjetas` (from a set or a game + questions; numbering, ordering, multiplied points for games, missing-question notices) and `agruparEnHojas(tarjetas, porHoja)`; `/impresion` view with source picker, layout 2/4, on-screen preview, "Imprimir" button, print CSS (letter, cut lines, hidden shell) (route: delegated writer — domain + view + CSS; test-first)
- [ ] T6.2 Entry points + paper scoreboard: "Imprimir tarjetas" links from the set view in the bank and from saved games (list and editor); optional scoreboard sheet (route: delegated writer; test-first)
- [ ] T6.3 Verify (typecheck, lint, format:check, test, build), CLAUDE.md Fase 6 section, work-unit commits, RDD per commit range

## Acceptance criteria

- From a set or a game, the host gets letter-size sheets with 2 (or 4) cards each, dashed cut lines, and every card shows number/ID, tema, the question in large type, and all answers sorted by points with synonyms.
- Game cards follow round order (then the final round) and show points as played (multiplied in x2/x3 rounds).
- Printing hides the app shell and controls; nothing is cut across pages.
- Optional paper scoreboard sheet prints with teams and rounds.
- Works offline; all checks green.

## Test-first

Runner: Vitest. Pure domain (cards from set/game, sheet grouping, scoreboard rows) in node first; view behavior in jsdom (source picker, layout switch, print button calls the injected `imprimir`, missing-question notice). Print CSS itself is checked manually in the browser's print preview.

## Progress / evidence

- Branch `feat/fase-6-impresion` from `main` @ `d26fbfb` (Fase 5 merged via PR #1). Last reviewed commit: `098ee85` (Fase 5).

- T6.1 (delegated writer): pure `crearTarjetas({ tipo: 'set', preguntas } | { tipo: 'juego', juego, preguntasPorId })` (set: deleted questions skipped, "Pregunta N" with no gaps, base points; game: "Ronda N" with points multiplied directly — the engine helpers need `ConfigPartida` + round state — and "Puntos x2/x3" label, then "Ronda final · Pregunta N"; missing questions → notice cards), `agruparEnHojas`, `resumenImpresion`, `leerSeleccion(URLSearchParams)` (set wins when both are present; any `por-hoja` other than 4 = 2); `rutaImpresion({ set?, juego?, porHoja? })`; `VistaImpresion({ imprimir })` with `SelectorFuente`, controls `print:hidden`, sheets `section aria-label="Hoja i de n"`; print CSS: `@page { size: letter; margin: 10mm }`, Layout header `print:hidden`, sheet `print:h-[257mm]` + `print:break-after-page` (last auto) + `break-inside-avoid`, dashed cut lines. RED → GREEN: domain modules missing → 14/14; view 7/7 failed on the placeholder → 21 impresion tests green. Writer: typecheck, lint, format clean; test 65 files / 647; build OK (`VistaImpresion` chunk 10 kB, main 441 kB, 39 precached). Parent spot check: impresion + app 7 files / 33 passed, lint 0. ~1,100 authored lines (~445 tests; one coherent slice, not split).
  - Not checked yet (needs a real print preview, user's manual test): 4-per-sheet card with 8 long answers + synonyms, trailing blank page, 257 mm sheet fitting one page in Chrome/Edge/Firefox. Cards don't clip, so overflow would be visible.

## Next step

Commit T6.1, RDD, then T6.2 (delegated writer).
