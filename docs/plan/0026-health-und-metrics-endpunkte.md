# 0026: Health- und Metrics-Endpunkte

**Planungsstatus:** Umgesetzt

## Anforderung

Zwei neue API-Endpunkte fuer Monitoring via Uptime Kuma:

- `GET /health` — Offen, prueft DB- und Worker-Verfuegbarkeit, gibt 200/503 zurueck
- `GET /metrics` — Geschuetzt via Bearer-Token, liefert Betriebsdaten (Queue, Activity, SMTP-Status, Fehler, Speicher)

Spezifikation: `docs/health-and-metrics.md` (allgemein) und `docs/health-and-metrics-relanto.md` (projektspezifisch)

## Architekturentscheidungen

- **Eigenes Token-Schema:** `/metrics` nutzt `METRICS_TOKEN` env var statt der bestehenden `requireApiAccess()`-Auth, da es unabhaengig vom Anwendungs-Token-System ist
- **Backend-Modul `metrics.ts`:** Alle DB-Abfragen in eigenem Modul, nicht in den Route-Dateien — haelt die Routes duenn
- **Timing-safe Vergleich via SHA-256:** Hash-basiert statt Laengenvergleich, um Token-Laenge nicht zu leaken
- **SQLite-kompatibles SQL:** `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` statt PostgreSQL-`FILTER`
- **Worker-Heartbeat via `lastTickAt`:** Setzt Timestamp nach jedem Tick-Abschluss, Health-Check prueft gegen `2 * workerIntervalMs`

## Betroffene Dateien

| Datei                                         | Aenderung                                                   |
| --------------------------------------------- | ----------------------------------------------------------- |
| `packages/backend/src/worker.ts`              | `lastTickAt`-Tracking und `getLastTickAt()`-Export          |
| `packages/backend/src/metrics.ts`             | Neue Datei: 6 Metrics-Funktionen                            |
| `packages/backend/src/index.ts`               | Re-Exports fuer `getLastTickAt` und alle Metrics-Funktionen |
| `packages/frontend/app/routes/api.health.ts`  | Neue Datei: Health-Route                                    |
| `packages/frontend/app/routes/api.metrics.ts` | Neue Datei: Metrics-Route mit Token-Auth                    |
| `packages/backend/src/metrics.test.mjs`       | Neue Datei: Tests fuer alle Metrics-Funktionen              |

## Implementierungsdetails

### Backend (`packages/backend/src/metrics.ts`)

6 exportierte Funktionen:

- `checkDatabase()` — SELECT 1 mit Latenz-Messung, SQLite-Dateigroesse via statSync
- `checkWorker()` — Prueft lastTickAt gegen doppeltes Worker-Intervall
- `getQueueCounts()` — GROUP BY status auf mail_jobs (8 Status-Werte)
- `getActivity()` — last_sent_at, sent/failed_last_hour, oldest_pending_at
- `getSmtpConfigStatus()` — total/active/degraded via SUM/CASE
- `getErrorsLastHour()` — GROUP BY error_category (nur > 0)

### Frontend Routes

- `api.health.ts` — Kein Auth, prueft DB + Worker, gibt status/version/hash zurueck
- `api.metrics.ts` — Bearer-Token via METRICS_TOKEN, SHA-256-basierter timing-safe Vergleich, try/catch fuer DB-Fehler

## Testergebnisse

- 63 Backend-Tests (6 neue fuer Metrics-Funktionen)
- 62 Frontend-Tests
- Alle gruen, Lint/Format/Typecheck bestanden

## Review-Findings

| #   | Schweregrad | Problem                                       | Status                                            |
| --- | ----------- | --------------------------------------------- | ------------------------------------------------- |
| 1   | Wichtig     | timingSafeCompare leakte Token-Laenge         | Behoben (SHA-256 Hash)                            |
| 2   | Hinweis     | Unbenutztes DB/Worker-Detail im Health-Loader | Behoben (inline)                                  |
| 3   | Hinweis     | Worker initial "unhealthy" nach Kaltstart     | Akzeptiert (erwartetes Verhalten)                 |
| 4   | Wichtig     | Metrics-Queries ohne Fehlerbehandlung         | Behoben (try/catch im Loader)                     |
| 5   | Hinweis     | Duplizierte Version/Hash-Logik                | Akzeptiert (2 Dateien, kein eigenes Modul noetig) |
| 6   | Hinweis     | 404-Antwort verriet Endpunkt-Existenz         | Behoben (neutrale Meldung "Not found")            |
| 7   | Hinweis     | Nur Leer-DB-Tests                             | Akzeptiert (Basis-Tests reichen fuer v1)          |
