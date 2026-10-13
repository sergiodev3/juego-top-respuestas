# Fase 0 — Project scaffold

## Objective

Bootstrap the "Top Respuestas" app: tooling, folder structure, Tailwind, basic PWA, so later phases only add features.

## Problem / Why

`docs/SPEC.md` requires React + Vite + TS strict + Tailwind + vite-plugin-pwa + Vitest + ESLint/Prettier, a feature-based structure and an up-to-date `CLAUDE.md`. Nothing exists yet besides the spec.

## Scope

- In: Vite React TS (strict, no `any`), Tailwind, ESLint + Prettier, Vitest, React Router with placeholder views (Spanish UI), folder skeleton, vite-plugin-pwa basic manifest + offline shell, `vercel.json` SPA rewrites, `.gitattributes` (LF), `CLAUDE.md`.
- Out: Dexie, engine, import libs (SheetJS/PapaParse), Zustand/Zod/Framer/Howler — installed in the phase that first needs them.

## Constraints

- UI copy in Spanish (México); domain identifiers in Spanish per spec; generic technical code may use English.
- Conventional commits, no AI attribution lines.
- Branch: `feat/fase-0-scaffold` (from `main` @ c250e22).

## Tasks

- [x] T0.1 Scaffold + tooling + structure + Tailwind + router placeholders + PWA + CLAUDE.md (route: delegated — writer trigger, 10+ non-trivial files)
- [x] T0.2 Verify: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` (PWA service worker generated)
- [ ] T0.3 Work-unit commit + RDD assessment

## Acceptance criteria

- `npm run dev` serves Inicio with links to every view; `/tablero` route exists.
- `npm run build` emits `sw.js` + `manifest.webmanifest`.
- Lint passes with `@typescript-eslint/no-explicit-any` as error; typecheck strict passes; Vitest runs ≥1 test.

## Test-first exception

Scaffold has no meaningful RED; checks are a smoke test plus typecheck/lint/build.

## Progress / evidence

- Branch created: `feat/fase-0-scaffold`.
- Writer evidence: typecheck exit 0; lint (`--max-warnings 0`) exit 0; format:check clean; test 2 files / 6 passed; build OK with `dist/sw.js` + `dist/manifest.webmanifest` (13 precached entries); engine import restriction verified with a throwaway file (5 errors, file removed).
- Parent spot check: lint exit 0, test 6/6 passed, `dist/sw.js` present.
- Resolved versions: vite 8.3.4, react 19.3.0, react-router 7.18.4, tailwindcss 4.3.3, vite-plugin-pwa 2.0.0, vitest 5.0.4, eslint 10.12.0, typescript 6.0.3.
- Version holds: TypeScript ~6.0 (typescript-eslint peer `<6.1`); react-router 7 (v8 needs Node >=22.22, machine has 22.18).

## Next step

T0.3 commit + RDD assessment, then user approval before Fase 1.
