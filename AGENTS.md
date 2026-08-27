# AGENTS.md

**Effective Flow project setup:** docs/adr/effective-flow-project-setup.md

Use `pnpm agent:check` to check code changes. Do not run agent:check on git commands.

## Routes

React Router 7 does **not** use file-based routing automatically. Every new route file under `packages/frontend/app/routes/` must also be registered in `packages/frontend/app/routes.ts`. A route file that is not listed there will return a 500 error in production.

## Sprache

Dokumentation und Fließtext auf Deutsch. Effective-Flow-Artefakte für Arbeitsabläufe – Pläne, Plan-Reviews, lokale Review-Berichte und Untersuchungsberichte – sind davon ausgenommen und bewusst auf Englisch verfasst. `LLMs.txt` ist bewusst auf Englisch gehalten, weil sie primär von LLMs für die API-Integration konsumiert wird. Code-Bezeichner (Variablennamen, Funktionen, Typen) immer auf Englisch. Commit-Messages auf Englisch.

## Commits & Releases

This repo uses release-please. Only `feat:`, `fix:`, and `deps:` trigger a release; `chore:` does not. For dependency or lockfile changes that should ship, use `fix(deps):` instead of `chore:`. To force a specific version from any commit, add a `Release-As: x.y.z` footer in the commit body.

## Architektur & Einstieg

- Architekturüberblick (Monorepo-Layout, Worker, DB-Layer, Domänenkern, Send-Flow, Auth): [`docs/developer-guide/architecture.md`](docs/developer-guide/architecture.md)
- Teststrategie (Vitest, Coverage-Thresholds, OpenAPI-Deckungstest, Befehle): [`docs/developer-guide/testing.md`](docs/developer-guide/testing.md)
