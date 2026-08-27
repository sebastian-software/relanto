# 0009: Minimale verbindliche Regression-Suite

**Planungsstatus:** Umgesetzt

## Anforderung

Aufbau einer kleinen, aber verbindlichen Regression-Suite fuer Relanto mit Mindestabdeckung fuer:

- Token-Authentifizierung
- SMTP-Config-Ownership
- Token-Management
- Job-Status-Uebergaenge

Zusatzanforderung:

- `agent:check` darf nicht mehr deshalb gruen sein, weil ein Workspace-Testlauf per `--passWithNoTests` leer durchlaeuft.

## Architekturentscheidungen

- Die Regression-Suite bleibt bewusst backend-zentriert, weil Authentifizierung, Ownership, Token-Management und Job-Zustandslogik im Backend-Service zentralisiert sind.
- Bereits vorhandene gezielte Regressionen fuer SMTP-Config-Ownership, Env-Haertung und Send-Mail-Payload-Limits bleiben bestehen und werden nicht dupliziert.
- Fuer den Frontend-Workspace wird kein grosses neues Testpaket aufgebaut; stattdessen wird der Test-Gate gehaertet, indem `packages/frontend` nicht mehr mit `--passWithNoTests` laeuft.
- Job-Status-Uebergaenge werden fuer stabile Regressionen auf Service-Ebene getestet. Fuer den `failed -> queued`-Pfad wird der Datenbankzustand im Test gezielt vorbereitet, statt instabile externe SMTP-Fehler erzwingen zu muessen.

## Betroffene Dateien

| Datei                                                                                                  | Beschreibung                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [packages/backend/src/regression-suite.test.mjs](../../packages/backend/src/regression-suite.test.mjs) | neue Mindestsuite fuer Token-Authentifizierung, Token-Management und Job-Status-Uebergaenge           |
| [packages/backend/src/service.test.mjs](../../packages/backend/src/service.test.mjs)                   | bestehende SMTP-Ownership-Regression bleibt Teil der Gesamtsuite                                      |
| [packages/frontend/package.json](../../packages/frontend/package.json)                                 | Frontend-Testlauf ohne `--passWithNoTests`, damit fehlende echte Tests nicht mehr still gruen bleiben |
| `review-report-2026-03-30-1.md`                                                                        | Finding `R-004` als umgesetzt markiert                                                                |

## Implementierungsdetails

- Die neue Backend-Suite deckt folgende Pflichtfaelle ab:
  - gueltiges Application-Token mit passendem Scope wird authentifiziert
  - Token mit fehlendem Scope wird abgewiesen
  - widerrufenes Admin-Token wird abgewiesen
  - rotiertes Application-Token invalidiert das alte Secret und akzeptiert nur noch das neue
  - widerrufenes Application-Token kann nicht mehr authentifizieren
  - `pauseJob()` setzt `queued -> paused`
  - `resumeJob()` setzt `paused -> queued`
  - `retryJob()` weist ungueltige Aufrufe auf `queued` ab und setzt `failed -> queued`
- Die bereits vorhandene Regression in `service.test.mjs` deckt weiter den SMTP-Ownership-Fall fuer Application-Admin-Grenzen ab.
- Der Frontend-Testbefehl lautet jetzt `vitest run`. Damit schlaegt ein spaeterer Zustand ohne echte Frontend-Tests wieder hart fehl.

## Testergebnisse

- `pnpm --filter @relanto/backend test` erfolgreich
- `pnpm --filter @relanto/frontend test` erfolgreich
- `pnpm agent:check` erfolgreich

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 0 | 0 | 0 |

- Interne Review-Pruefung der geaenderten Dateien ergab keine offenen Findings.
