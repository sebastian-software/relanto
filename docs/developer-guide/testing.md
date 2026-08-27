# Teststrategie

## Test-Runner

Das Projekt verwendet **Vitest** in beiden Paketen.

## Testorte

| Paket                          | Datei-Muster                            |
| ------------------------------ | --------------------------------------- |
| Backend (`@relanto/backend`)   | `packages/backend/src/*.test.mjs`       |
| Frontend (`@relanto/frontend`) | `packages/frontend/app/**/*.test.ts(x)` |

## Coverage

Coverage wird mit dem v8-Provider gemessen (`coverage.provider = "v8"`).

### Backend

```bash
pnpm --filter @relanto/backend test:coverage
```

Thresholds aus `packages/backend/vitest.config.ts`:

| Statements | Branches | Functions | Lines |
| ---------- | -------- | --------- | ----- |
| 80 %       | 70 %     | 88 %      | 80 %  |

### Frontend

```bash
pnpm --filter @relanto/frontend test:coverage
```

Thresholds aus `packages/frontend/vitest.config.ts`:

| Statements | Branches | Functions | Lines |
| ---------- | -------- | --------- | ----- |
| 58 %       | 50 %     | 70 %      | 58 %  |

Coverage für beide Pakete auf einmal:

```bash
pnpm test:coverage
```

## OpenAPI-Frischhalte- und Deckungstest

`packages/backend/src/openapi/openapi.test.ts` erzwingt zwei Invarianten:

1. **Freshness** – `packages/backend/openapi.json` muss mit dem aus dem Code generierten Dokument übereinstimmen. Die Spec aktualisiert sich nicht automatisch. Nach Änderungen an Routen oder Schemas muss sie manuell neu erzeugt werden:

   ```bash
   pnpm --filter @relanto/backend openapi:generate
   ```

2. **Deckung** – Die in `packages/frontend/app/routes.ts` registrierten API-Routen und die in der Spec deklarierten Operationen müssen in beide Richtungen übereinstimmen. Aktuell sind 25 Operationen registriert.

Schlägt einer dieser Tests fehl, blockiert das auch den lokalen Gate `pnpm agent:check`.

## Befehle

| Befehl                                 | Zweck                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| `pnpm agent:check`                     | Lokaler Gate: lint, format:check, typecheck, build, test |
| `pnpm test:coverage`                   | Coverage-Bericht für alle Pakete                         |
| `pnpm --filter @relanto/backend test`  | Backend-Tests isoliert ausführen                         |
| `pnpm --filter @relanto/frontend test` | Frontend-Tests isoliert ausführen                        |

`pnpm agent:check` ist der Standard-Check vor einem Commit. CI führt zusätzlich `standards check`, `pnpm audit` und Trivy aus – agent:check und CI sind nicht identisch.

## Konventionen

- Backend-Tests haben die Endung `.test.mjs`, damit sie im ESM-Modus laufen.
- Frontend-Komponententests laufen mit JSDOM als Testumgebung (konfiguriert in `packages/frontend/vitest.config.ts`).
