# Architektur

Dieser Überblick richtet sich an Entwicklerinnen und Entwickler, die am Projekt mitarbeiten. Er beschreibt das Monorepo-Layout, den In-Process-Worker, den Datenbank-Layer, den Domänenkern, den Send-Flow sowie das Auth-Modell.

## Monorepo-Layout

Das Projekt ist ein pnpm-Monorepo mit zwei Paketen:

- **`packages/frontend`** — React-Router-7-Anwendung. Enthält die Adminoberfläche und die gesamte HTTP-Schicht. API-Endpunkte sind als Resource-Routes unter `app/routes/api.*.ts` implementiert und müssen manuell in `app/routes.ts` registriert werden. Eine Route, die dort fehlt, liefert in der Produktion einen 500-Fehler.
- **`packages/backend`** — Domänenlogik, Persistenz und Worker. Enthält **keine eigene HTTP-Schicht** — alle API-Endpunkte liegen im Frontend-Paket.

## In-Process-Worker

`packages/backend/src/worker.ts` läuft im selben Prozess wie der Webserver.

Der Worker besteht aus zwei unabhängigen Loops:

- **Mail-Job-Loop**: ruft in Intervallen von `MAILER_WORKER_INTERVAL_MS` Millisekunden (Default: 2 500 ms) `processDueJobs()` aus `service.ts` auf und verarbeitet fällige Jobs in der Queue.
- **Retention-Loop**: ruft in Intervallen von `MAILER_RETENTION_INTERVAL_MS` Millisekunden (Default: 3 600 000 ms) `runRetention()` aus `service.ts` auf und bereinigt abgelaufene Datensätze.

**Bootstrap**: Der Worker startet über `startWorkerLoop()`, das von `ensureRuntimeStarted()` in `packages/frontend/app/lib/server/bootstrap.server.ts` beim ersten Request aufgerufen wird.

**Graceful Shutdown**: Bei SIGTERM oder SIGINT stoppt der Worker neue Ticks und wartet bis zu `MAILER_SHUTDOWN_TIMEOUT_MS` Millisekunden (Default: 10 000 ms) auf den laufenden Tick. Danach wird die Datenbankverbindung geschlossen.

**Startup-Reclaim**: Beim Start werden Jobs, die sich noch im Zustand `processing` befinden, zurückgekehrt – ein Schutz gegen Verluste nach einem harten Shutdown zwischen Job-Claim und finalem Statuswechsel.

## DB-Layer

`packages/backend/src/db.ts` — SQLite über `better-sqlite3`.

**Pfad**: Die Umgebungsvariable `MAILER_DB_PATH` legt den Datenbankpfad fest. In der lokalen Entwicklung ohne Konfiguration wird `tmp/mailer.sqlite` im Arbeitsverzeichnis verwendet. Außerhalb der lokalen Entwicklung ist `MAILER_DB_PATH` Pflicht.

**Verbindungs-Härtung**:

| PRAGMA         | Wert     | Wirkung                                                     |
| -------------- | -------- | ----------------------------------------------------------- |
| `journal_mode` | `WAL`    | Write-Ahead-Log, bessere Nebenläufigkeit und Crash-Recovery |
| `busy_timeout` | `5000`   | Bis zu 5 Sekunden auf Lock warten statt sofort SQLITE_BUSY  |
| `synchronous`  | `NORMAL` | Empfohlene Durability-Stufe bei WAL                         |

**Migrationen**: Beim ersten Aufruf von `getDatabase()` werden ausstehende Migrationen automatisch bis zur aktuellen Schema-Version (8) angewendet. Kein externes Tool nötig.

**Haupttabellen**: `application_admins`, `applications`, `smtp_configs`, `application_admin_tokens`, `application_tokens`, `mail_jobs`, `job_events`, `audit_logs`, `api_request_failures`.

**Indizes auf `mail_jobs`**:

| Index                                   | Spalten                                                                 | Zweck                     |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| `mail_jobs_status_created_at`           | `(status, created_at)` WHERE `deleted_at IS NULL`                       | Claim-Query, Queue-Zähler |
| `mail_jobs_status_updated_at`           | `(status, updated_at)` WHERE `deleted_at IS NULL`                       | Fehler-Metriken           |
| `mail_jobs_application_created_at`      | `(application_id, created_at)`                                          | Job-Listenendpunkte       |
| `mail_jobs_message_id`                  | `(message_id)`                                                          | Suche per Message-ID      |
| `mail_jobs_application_idempotency_key` | `(application_id, idempotency_key)` WHERE `idempotency_key IS NOT NULL` | Idempotenz-Deduplizierung |

**Kein Multi-Instanz-Betrieb**: SQLite unterstützt keinen gleichzeitigen Schreibzugriff aus mehreren Prozessen auf dieselbe Datei. Es darf immer nur eine Instanz laufen.

## Domänenkern

| Modul                  | Datei                   | Aufgabe                                                                          |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Dienste                | `src/service.ts`        | Jobs anlegen/verarbeiten, SMTP-Configs verwalten, Token-Logik, Send-/Retry-Logik |
| Sicherheit             | `src/security.ts`       | AES-256-GCM für SMTP-Passwörter, JWT HS256, Token-Hashing (SHA-256)              |
| Typen                  | `src/types.ts`          | Zod-Schemas für alle öffentlichen Datenstrukturen                                |
| Metriken               | `src/metrics.ts`        | Datenbankgesundheit und Queue-Zähler für den `/metrics`-Endpunkt                 |
| Strukturiertes Logging | `src/structured-log.ts` | Ein JSON-Objekt pro Event auf stdout (`job_result`, `api_request_rejected`)      |
| Datenbank              | `src/db.ts`             | SQLite-Verbindung, Migrationen                                                   |
| Umgebung               | `src/env.ts`            | Parsen und Validieren aller Umgebungsvariablen, Fail-fast beim Start             |
| Worker                 | `src/worker.ts`         | Mail-Job- und Retention-Loop                                                     |
| OpenAPI                | `src/openapi/`          | Spec-Generator, Routen-Registry, Antwort-Schemas                                 |

## Send-Flow

1. Client tauscht `client_id` und `client_secret` gegen ein kurzlebiges JWT: `POST /api/v1/token`.
2. Client sendet `POST /api/v1/send` mit `Authorization: Bearer <jwt>`.
3. Der Job wird in `mail_jobs` eingereiht (Modus `queued`) oder direkt zugestellt (Modus `direct`).
4. Der Worker ruft `processDueJobs()` auf und sendet die Mail per SMTP.
5. Status lässt sich über `GET /api/v1/jobs/:jobId` abfragen.

## Auth und Scopes

Alle `/api/v1/*`-Endpunkte außer `POST /api/v1/token` erfordern ein JWT Bearer Token.

| Scope                | Bedeutung                                                 |
| -------------------- | --------------------------------------------------------- |
| `send`               | Mail einreihen oder direkt senden                         |
| `readStatus`         | Job-Status-Metadaten lesen                                |
| `readConfig`         | SMTP-Konfiguration lesen (ohne Zugangsdaten)              |
| `validate`           | SMTP-Konfiguration validieren                             |
| `manageTokens`       | Token anlegen, rotieren, widerrufen                       |
| `manageApplications` | Anwendungen, SMTP-Configs und Queue-Operationen verwalten |

Die System-Admin-Oberfläche verwendet eine Session-basierte Anmeldung über Pocket ID (OIDC).

Die vollständige API-Beschreibung mit Request-/Response-Schemata steht in `LLMs.txt` (API-Semantik für Integrierende) und in der generierten OpenAPI-Spezifikation `packages/backend/openapi.json` (OpenAPI 3.1, 25 Operationen).
