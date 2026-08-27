# @relanto/backend

Dieses Paket enthält die Domänenlogik, die Persistenz und den Mail-Worker von Relanto. Es stellt **keine eigene HTTP-Schicht** bereit – die API-Endpunkte liegen im Paket `packages/frontend` als React-Router-Resource-Routes.

## Modul-Übersicht

| Modul                  | Datei                   | Aufgabe                                                                               |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| Datenbank              | `src/db.ts`             | SQLite-Verbindung (better-sqlite3), Migrationen, WAL/busy_timeout/synchronous-Härtung |
| Umgebung               | `src/env.ts`            | Parsen und Validieren aller Umgebungsvariablen, Fail-fast beim Start                  |
| Dienste                | `src/service.ts`        | Jobs anlegen, SMTP-Configs verwalten, Token-Logik, Send-/Retry-Logik                  |
| Sicherheit             | `src/security.ts`       | AES-256-GCM (SMTP-Passwörter), JWT HS256, Token-Hashing (SHA-256)                     |
| Typen                  | `src/types.ts`          | Zod-Schemas für alle öffentlichen Datenstrukturen                                     |
| Worker                 | `src/worker.ts`         | Mail-Job- und Retention-Loop (In-Process, startet im Frontend-Prozess)                |
| Metriken               | `src/metrics.ts`        | Datenbankgesundheit und Queue-Zähler für den `/metrics`-Endpunkt                      |
| Strukturiertes Logging | `src/structured-log.ts` | JSON-Ereignisse auf stdout (`job_result`, `api_request_rejected`)                     |
| OpenAPI                | `src/openapi/`          | Spec-Generator, Routen-Registry, Antwort-Schemas                                      |

## Befehle

```bash
# Tests ausführen
pnpm --filter @relanto/backend test

# Coverage-Bericht erzeugen
pnpm --filter @relanto/backend test:coverage

# OpenAPI-Spec neu generieren (nach Änderungen an Routen oder Schemas)
pnpm --filter @relanto/backend openapi:generate
```

## Weiterführende Dokumentation

- Architekturüberblick: [`docs/developer-guide/architecture.md`](../../docs/developer-guide/architecture.md)
- API-Semantik für Integrierende: [`LLMs.txt`](../../LLMs.txt)
