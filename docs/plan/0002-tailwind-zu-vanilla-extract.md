# 0002: Tailwind durch vanilla-extract ersetzen

**Planungsstatus:** Umgesetzt

## Anforderung

Tailwind im Frontend vollständig entfernen, Styles auf vanilla-extract umstellen und die bestehende Beispieloberfläche sichtbar überarbeiten. Zusätzlich soll der bisherige Projektzustand als initiale Plan-Datei festgehalten werden.

## Architekturentscheidungen

- Tailwind wird vollständig aus Frontend-Dependencies, Vite-Plugin-Konfiguration und App-Code entfernt.
- Styling erfolgt künftig komponentennah über `.css.ts`-Dateien mit `vanilla-extract`.
- Gemeinsame Design-Tokens liegen zentral in `app/styles/theme.css.ts`.
- Globale Basisregeln und Error-State-Styles liegen in `app/root.css.ts`.
- Die Startseite wird nicht nur technisch migriert, sondern visuell als eigenständiges Editorial-Layout neu aufgebaut.

## Betroffene Dateien

| Datei                                          | Beschreibung                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `docs/plan/0001-initial-state.md`              | Dokumentiert den Ausgangszustand vor dem ersten Feature          |
| `packages/frontend/package.json`               | Tailwind entfernt, vanilla-extract-Basis ergänzt                 |
| `packages/frontend/vite.config.ts`             | Tailwind-Vite-Plugin durch vanilla-extract-Vite-Plugin ersetzt   |
| `packages/frontend/app/root.tsx`               | Root importiert neue globale Styles und neue Schriftarten        |
| `packages/frontend/app/root.css.ts`            | Globale Styles, Hintergründe und Error-UI in vanilla-extract     |
| `packages/frontend/app/styles/theme.css.ts`    | Zentrale Theme-Tokens für Farben, Abstände, Radien und Fonts     |
| `packages/frontend/app/welcome/welcome.tsx`    | Startseite auf neue Struktur und neues Layout umgebaut           |
| `packages/frontend/app/welcome/welcome.css.ts` | Komponentenspezifische Styles der Startseite                     |
| `packages/frontend/app/app.css`                | Entfernt, da Tailwind nicht mehr verwendet wird                  |
| `packages/frontend/README.md`                  | Styling-Dokumentation von Tailwind auf vanilla-extract angepasst |
| `pnpm-lock.yaml`                               | Lockfile nach Dependency-Änderungen aktualisiert                 |

## Implementierungsdetails

- `@tailwindcss/vite` und `tailwindcss` wurden aus dem Frontend entfernt.
- `@vanilla-extract/css` wurde ergänzt; `@vanilla-extract/vite-plugin` wird nun sowohl im Build- als auch im Test-Setup genutzt.
- Das neue visuelle Konzept nutzt ein helles, editoriales Erscheinungsbild mit warmem Verlauf, Glasflächen, dekorativen Orbits und klaren Typo-Hierarchien.
- Statt Utility-Klassen werden Layout, Typografie, Panels, Links und States jetzt typisiert in `root.css.ts` und `welcome.css.ts` beschrieben.
- Das globale Font-Setup wurde von Inter auf `Fraunces` und `Manrope` umgestellt.
- Die Beispielseite wurde in kleinere interne Komponenten zerlegt, damit die bestehende Lint-Regel zu Funktionslängen eingehalten wird.

## Testergebnisse

- `pnpm install` erfolgreich
- `pnpm format` erfolgreich
- `pnpm agent:check` erfolgreich
- `pnpm agent:check` meldet weiterhin einen bekannten Vitest-Hinweis ohne Fehlerstatus:
  - `Tests closed successfully but something prevents Vite server from exiting`
- Lint-Warnings ohne Build-Blocker:
  - `only-export-components` für `meta` in `app/routes/home.tsx`
  - `only-export-components` für `links` in `app/root.tsx`

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 2 | 0 | 2 |

- Hinweis: `only-export-components` in `packages/frontend/app/routes/home.tsx`
  - Problem: React-Fast-Refresh-Regel markiert das exportierte `meta`, obwohl es für React Router notwendig ist.
  - Empfehlung: Optional gezielt für Route-Module konfigurieren oder ignorieren.
  - Status: offen
- Hinweis: `only-export-components` in `packages/frontend/app/root.tsx`
  - Problem: React-Fast-Refresh-Regel markiert das exportierte `links`, obwohl es für React Router notwendig ist.
  - Empfehlung: Optional gezielt für Route-Module konfigurieren oder ignorieren.
  - Status: offen
