# Fase 7 — JSON backups, offline PWA check, README and local launcher

Objective: ship backups (export / restore), prove the production build works offline, document the project and make it trivial to run on the host's laptop without a deploy.
Branch: `feat/fase-7-respaldos` (from `main` @ `e55e95e`). Delivery: one work-unit commit per task; push/PR only on request. Test runner: `npm run test` (Vitest).

## Specs

- S1: "Respaldos: exportar todo a JSON, importar/restaurar JSON (con opción de combinar o reemplazar)." (docs/SPEC.md, view 8)
- S2: "Manejo de errores amable y en español; nunca perder datos del usuario." A invalid or newer-version file is rejected with a Spanish message and nothing is written; the restore is one all-or-nothing transaction.
- S3: "Fase 7: respaldos JSON, PWA offline completa, README y despliegue". The production build precaches every emitted asset and navigations fall back to `/index.html`.
- S4: "README con instrucciones para correr, compilar, desplegar en Vercel y el formato de importación."
- S5: User request (L1): "¿no ocupo hacer el deploy para usarlo mañana verdad? puedo empaquetar la app para usarlo aqui en mi computadora mañana" — a one-click local launcher (build + preview on a fixed port) so no deploy is needed.

## Tasks

- [x] T7.1 (S1, S2) Backup domain + service: `esquemaRespaldo` in `shared/modelo`, `ServicioRespaldos` (`exportar`, `restaurar(respaldo, 'combinar' | 'reemplazar')`) in `src/db`, pure `leerRespaldo(texto)` and helpers in `features/respaldos/dominio`. Route: inline, test-first.
- [x] T7.2 (S1, S2) `/respaldos` view: export button (downloads `top-respuestas-respaldo-YYYY-MM-DD.json`), file picker, summary preview, mode choice, confirmation for "reemplazar", result summary; remove `VistaEnConstruccion`. Route: inline, test-first.
- [ ] T7.3 (S3) Offline PWA check on the production build (precache list vs `dist`, manifest, SW served from preview). Route: inline.
- [ ] T7.4 (S4, S5) README, `npm run local` + `iniciar-top-respuestas.bat`, CLAUDE.md Fase 7 section. Route: inline.
- [ ] T7.5 Verify (typecheck, lint, format:check, test, build), commits.

## Decisions (minor, chosen by parent)

- Backup file: `{ app: 'top-respuestas', version: 1, exportadoEn, datos: { sets, preguntas, juegos, partidas } }`. Soft-deleted rows and `meta` are not exported. Self-contained: every question's `setId` must be a set in the file.
- Merge ("combinar"): per id, a record is added when missing; when it exists, the one with the newer `actualizadoEn` wins (a tie keeps the local one). Nothing is deleted.
- Replace ("reemplazar"): clears `sets`, `preguntas`, `juegos` and `partidas` and writes the file, in one transaction. `meta` stays, so the sample set is never re-seeded.
- README is in Spanish (the host is Spanish-speaking and SPEC asks for it); code comments stay in English.

## Log

- L1 (2026-10-22): "sí, procede con todo" — after "¿no ocupo hacer el deploy para usarlo mañana verdad? puedo empaquetar la app para usarlo aqui en mi computadora mañana".
