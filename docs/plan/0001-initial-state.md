# 0001: Ausgangszustand — relanto

**Planungsstatus:** Umgesetzt

## Anforderung

Dokumentation des Projektzustands vor dem ersten Feature-Workflow.

## Architekturentscheidungen

- Monorepo mit `pnpm`-Workspace und zwei Packages unter `packages/`
- Frontend als React-Router-7-Anwendung mit Vite und TypeScript
- Linting über ESLint und Oxlint, Formatierung über Prettier
- Tests über Vitest, aktuell ohne vorhandene Testfälle
- Styling im Frontend aktuell über Tailwind CSS v4 mit Utility-Klassen direkt in TSX
- Backend-Package ist derzeit nur als Platzhalter mit Lint-Konfiguration angelegt

## Betroffene Dateien

| Datei                                       | Beschreibung                                                      |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `package.json`                              | Root-Skripte für Lint, Format, Typecheck und Tests                |
| `pnpm-workspace.yaml`                       | Workspace-Definition für `packages/*`                             |
| `packages/frontend/package.json`            | Frontend-Abhängigkeiten und Skripte                               |
| `packages/frontend/vite.config.ts`          | Vite-Setup mit React Router, Tailwind-Vite-Plugin und Pfadaliasen |
| `packages/frontend/vitest.config.ts`        | Vitest-Setup mit jsdom und App-Setup-Datei                        |
| `packages/frontend/tsconfig.json`           | TypeScript-Konfiguration des Frontends                            |
| `packages/frontend/react-router.config.ts`  | React-Router-Konfiguration mit SSR                                |
| `packages/frontend/app/root.tsx`            | Root-Layout und ErrorBoundary der App                             |
| `packages/frontend/app/routes.ts`           | Routing-Konfiguration                                             |
| `packages/frontend/app/routes/home.tsx`     | Startseiten-Route                                                 |
| `packages/frontend/app/welcome/welcome.tsx` | Beispiel-UI mit Tailwind-Klassen                                  |
| `packages/frontend/app/app.css`             | Globales Styling über Tailwind-Import und Theme                   |
| `packages/backend/package.json`             | Platzhalter-Package für ein späteres Backend                      |
| `packages/backend/eslint.config.ts`         | ESLint-Konfiguration des Backend-Packages                         |
| `packages/backend/oxlint.config.ts`         | Oxlint-Konfiguration des Backend-Packages                         |
| `cspell.json`                               | Projektweite Wörterbuch-Konfiguration                             |
| `AGENTS.md`                                 | Projektregel zur Validierung über `pnpm agent:check`              |

## Implementierungsdetails

- Root verwendet `pnpm@10.33.0`
- Frontend nutzt `react@19`, `react-router@7.13.2`, `vite@7.3.1` und `typescript@5.9.3`
- Das Styling basiert derzeit auf `tailwindcss` und `@tailwindcss/vite`
- `@vanilla-extract/vite-plugin` ist bereits installiert, aber noch nicht im App-Code genutzt
- `packages/frontend/app/app.css` importiert Tailwind und setzt globale Theme-Werte
- Die Beispielkomponenten in `root.tsx` und `welcome.tsx` verwenden ausschließlich Tailwind-Utilities in `className`
- `pnpm agent:check` läuft aktuell erfolgreich; ESLint meldet nur zwei nicht-blockierende Warnings zu `only-export-components`
