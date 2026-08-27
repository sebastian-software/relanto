# Health- und Metrics-Endpunkte -- Relanto

Projektspezifische Umsetzung der [allgemeinen Spezifikation](./health-and-metrics.md) für Relanto.

## Architektur-Kontext

- **Framework:** React Router 7 (SSR, Node-Adapter)
- **Datenbank:** SQLite via `better-sqlite3` (synchron)
- **Worker:** In-Process Poll-Loop (`startWorkerLoop()` in `@relanto/backend/worker`)
- **Worker-Intervall:** Konfigurierbar via `MAILER_WORKER_INTERVAL_MS` (Default: 2500ms, Min: 250ms)
- **Route-Konvention:** API-Routen als Dateien unter `packages/frontend/app/routes/api.*.ts`

## Route-Dateien

| Endpunkt       | Datei                                         |
| -------------- | --------------------------------------------- |
| `GET /health`  | `packages/frontend/app/routes/api.health.ts`  |
| `GET /metrics` | `packages/frontend/app/routes/api.metrics.ts` |

Beide Routen exportieren einen `loader` (GET-Handler). Sie verwenden **nicht** die bestehende `requireApiAccess()`-Authentifizierung, da sie ein eigenes, unabhängiges Token-Schema nutzen.

## Health-Endpunkt

### Prüfungen

1. **SQLite erreichbar** -- `getDatabase().prepare("SELECT 1 AS ok").get()` (synchron)
2. **Worker-Loop aktiv** -- `getLastTickAt()` darf nicht älter als `2 * getWorkerIntervalMs()` sein

### Beispiel-Response

```json
{
  "status": "healthy",
  "version": "<version>",
  "hash": "376fc0b"
}
```

### Worker-Tick-Tracking

Der Worker (`packages/backend/src/worker.ts`) trackt `lastTickAt` und exportiert es als `getLastTickAt()`; `getLastTickAt` wird über `packages/backend/src/index.ts` re-exportiert. Der Zeitstempel wird am Ende jedes Ticks gesetzt, sodass der Health-Endpunkt einen hängenden Worker erkennt.

```typescript
// packages/backend/src/worker.ts
let lastTickAt: number | undefined;

function tickWorker(): void {
  if (tickInFlight) return;
  tickInFlight = true;

  void processDueJobs()
    .catch((error: unknown) => {
      console.error("[mailer-worker]", error);
    })
    .finally(() => {
      lastTickAt = Date.now();
      tickInFlight = false;
    });
}

export function getLastTickAt(): number | undefined {
  return lastTickAt;
}
```

### Version und Hash

Die Version kommt zur Laufzeit aus `packages/frontend/package.json`. Der Hash wird via `RELANTO_GIT_SHORT_SHA` (Fallback `GITHUB_SHA`) bereitgestellt und zur Build-Zeit gesetzt; ohne diese Variablen fällt der Wert auf `dev` zurück (siehe `packages/frontend/app/lib/server/build-metadata.server.ts`).

## Metrics-Endpunkt

### Authentifizierung

Bearer-Token via `METRICS_TOKEN` Environment-Variable. Unabhängig von `MAILER_SECRET_KEY` und den Relanto-Anwendungs-Tokens.

### SMTP-Config-Status

Zeigt an, wie viele SMTP-Konfigurationen betriebsbereit sind. Wenn alle Configs disabled oder locked sind, kann Relanto keine Mails versenden -- auch bei gesundem Worker und leerer Queue.

**SQL:**

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE disabled_at IS NULL AND locked_at IS NULL) AS active,
  COUNT(*) FILTER (WHERE disabled_at IS NOT NULL OR locked_at IS NOT NULL) AS degraded
FROM smtp_configs
```

Das `services`-Objekt in der Response wird für Relanto mit diesen SMTP-spezifischen Werten gefüllt:

| Generisch  | Relanto-Bedeutung                                  |
| ---------- | -------------------------------------------------- |
| `total`    | Gesamtzahl konfigurierter SMTP-Server              |
| `active`   | Weder disabled noch locked                         |
| `degraded` | Disabled (`disabled_at`) oder locked (`locked_at`) |

### Fehler-Aufschlüsselung

Schlüsselt `activity.failed_last_hour` nach Fehlerursache auf. Die Kategorien kommen aus dem `error_category`-Feld der `mail_jobs`-Tabelle (definiert als `MailerErrorCategory` in `types.ts`):

| Kategorie    | Bedeutung                                                                 |
| ------------ | ------------------------------------------------------------------------- |
| `auth`       | SMTP-Authentifizierung fehlgeschlagen (falsches Passwort, Konto gesperrt) |
| `config`     | Fehlerhafte SMTP-Konfiguration (falscher Host, Port)                      |
| `content`    | Mail-Inhalt abgelehnt (zu groß, ungültige Adressen)                       |
| `network`    | Netzwerkfehler (DNS, Timeout, Verbindung abgelehnt)                       |
| `rate_limit` | SMTP-Server hat Rate-Limit erreicht                                       |
| `tls`        | TLS-Handshake fehlgeschlagen (Zertifikat, Protokoll)                      |
| `unknown`    | Nicht kategorisierter Fehler                                              |

**SQL:**

```sql
SELECT error_category, COUNT(*) AS count
FROM mail_jobs
WHERE status = 'failed'
  AND updated_at >= ?  -- 1 Stunde zurück
  AND deleted_at IS NULL
  AND error_category IS NOT NULL
GROUP BY error_category
```

Nur Kategorien mit `count > 0` werden in der Response ausgegeben.

### Prozess-Speicher

Relanto läuft als einzelner Node.js-Prozess (React Router SSR + In-Process-Worker + SQLite). Speicherverbrauch wird via `process.memoryUsage()` ermittelt, keine Relanto-spezifische Anpassung nötig.

### Queue-Status-Werte

Die `mail_jobs`-Tabelle verwendet folgende Status-Werte (definiert in `packages/backend/src/types.ts` als `mailJobStatusSchema`):

| Status               | Beschreibung                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| `queued`             | Wartet auf Verarbeitung durch den Worker-Loop                            |
| `paused`             | Manuell pausiert (via API: `POST /api/v1/jobs/:jobId/pause`)             |
| `processing`         | Wird gerade durch den Worker verarbeitet                                 |
| `retry_scheduled`    | SMTP-Versand fehlgeschlagen, nächster Versuch geplant (`next_retry_at`)  |
| `sent`               | Erfolgreich an den SMTP-Server übergeben                                 |
| `failed`             | Endgültig fehlgeschlagen (permanenter Fehler oder max. Retries erreicht) |
| `delivery_uncertain` | Timeout oder keine Bestätigung vom SMTP-Server                           |
| `cancelled`          | Abgebrochen                                                              |

### Queue-Zählung SQL

```sql
SELECT status, COUNT(*) AS count
FROM mail_jobs
WHERE deleted_at IS NULL
GROUP BY status
```

Soft-deleted Jobs (`deleted_at IS NOT NULL`) werden nicht gezählt.

### Activity-Daten

Die allgemeine `getActivity()`-Funktion wird mit Relanto-spezifischen Parametern aufgerufen:

| Parameter               | Relanto-Wert                              | Erklärung                                          |
| ----------------------- | ----------------------------------------- | -------------------------------------------------- |
| `tableName`             | `mail_jobs`                               | Job-Tabelle                                        |
| `completedStatus`       | `sent`                                    | Erfolgreich versendete Mails                       |
| `failedStatus`          | `failed`                                  | Endgültig fehlgeschlagene Mails                    |
| `pendingStatuses`       | `["queued", "paused", "retry_scheduled"]` | Alle Status, in denen Jobs auf Verarbeitung warten |
| `completedTimestampCol` | `sent_at`                                 | Zeitstempel des erfolgreichen Versands             |
| `createdTimestampCol`   | `created_at`                              | Zeitstempel der Job-Erstellung                     |

**Feldnamen in der Response** verwenden die Relanto-spezifischen Begriffe:

| Generisch             | Relanto             |
| --------------------- | ------------------- |
| `last_completed_at`   | `last_sent_at`      |
| `completed_last_hour` | `sent_last_hour`    |
| `failed_last_hour`    | `failed_last_hour`  |
| `oldest_pending_at`   | `oldest_pending_at` |

**SQL-Queries:**

```sql
-- Letzter erfolgreicher Versand
SELECT sent_at FROM mail_jobs
WHERE status = 'sent' AND deleted_at IS NULL
ORDER BY sent_at DESC LIMIT 1

-- Versendete Mails in der letzten Stunde
SELECT COUNT(*) FROM mail_jobs
WHERE status = 'sent' AND sent_at >= ? AND deleted_at IS NULL

-- Fehlgeschlagene Mails in der letzten Stunde
SELECT COUNT(*) FROM mail_jobs
WHERE status = 'failed' AND updated_at >= ? AND deleted_at IS NULL

-- Ältester wartender Job
SELECT created_at FROM mail_jobs
WHERE status IN ('queued', 'paused', 'retry_scheduled') AND deleted_at IS NULL
ORDER BY created_at ASC LIMIT 1
```

**Alarm-Szenarien für Relanto:**

| Szenario                     | Bedingung                                    | Bedeutung                                    |
| ---------------------------- | -------------------------------------------- | -------------------------------------------- |
| SMTP-Server nicht erreichbar | `sent_last_hour = 0`, `failed_last_hour > 0` | Alle Versandversuche scheitern               |
| Worker hängt                 | `sent_last_hour = 0`, `queue.queued > 0`     | Jobs werden nicht abgearbeitet               |
| Hohe Fehlerrate              | `failed_last_hour > 10`                      | Viele Mails scheitern (Schwellwert anpassen) |
| Queue staut sich             | `oldest_pending_at` älter als 30 Minuten     | Jobs warten ungewöhnlich lange               |

### Datenbank-Größe

Die SQLite-Dateigroesse wird via `statSync(getMailerDbPath())` ermittelt. Der Pfad kommt aus der Environment-Variable `MAILER_DB_PATH`.

### Beispiel-Response

```json
{
  "ok": true,
  "uptime_seconds": 84200,
  "version": "<version>",
  "process": {
    "memory_rss_bytes": 67108864,
    "memory_heap_used_bytes": 41943040
  },
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 1,
      "size_bytes": 524288
    },
    "worker": {
      "status": "healthy",
      "interval_ms": 2500,
      "last_tick_at": "2026-04-21T10:00:02.000Z",
      "last_tick_age_ms": 1200
    }
  },
  "services": {
    "total": 3,
    "active": 2,
    "degraded": 1
  },
  "queue": {
    "queued": 3,
    "paused": 0,
    "processing": 1,
    "retry_scheduled": 2,
    "sent": 14523,
    "failed": 12,
    "delivery_uncertain": 0,
    "cancelled": 0
  },
  "activity": {
    "last_sent_at": "2026-04-21T09:58:12.000Z",
    "sent_last_hour": 42,
    "failed_last_hour": 0,
    "oldest_pending_at": "2026-04-21T09:55:00.000Z"
  },
  "errors_last_hour": {}
}
```

## Uptime Kuma Konfiguration

Alle Monitors verwenden den Typ **"HTTP(s) - JSON Query"** und senden den `Authorization: Bearer <METRICS_TOKEN>`-Header mit.

### Monitor 1: Health (Verfuegbarkeit)

| Einstellung          | Wert                                 |
| -------------------- | ------------------------------------ |
| Name                 | `Relanto Health`                     |
| Typ                  | HTTP(s)                              |
| URL                  | `https://relanto.example.com/health` |
| Method               | GET                                  |
| Expected Status Code | `200`                                |
| Heartbeat Interval   | 60s                                  |
| Headers              | -- (keine Auth nötig)                |

Dieser Monitor prüft nur, ob der Dienst antwortet und HTTP 200 zurückgibt. Kein JSON Query nötig -- der Health-Endpunkt gibt bei Problemen bereits 503 zurück.

### Monitor 2: Mail-Versand aktiv

Erkennt: SMTP-Server nicht erreichbar, Worker hängt, alle Configs disabled.

| Einstellung        | Wert                                    |
| ------------------ | --------------------------------------- |
| Name               | `Relanto Mail-Versand`                  |
| Typ                | HTTP(s) - JSON Query                    |
| URL                | `https://relanto.example.com/metrics`   |
| Headers            | `Authorization: Bearer <METRICS_TOKEN>` |
| JSON Path          | `$.activity.sent_last_hour`             |
| Expected Value     | `> 0`                                   |
| Heartbeat Interval | 300s (5 Min.)                           |

**Hinweis:** Dieser Monitor schlägt fehl, wenn länger als 1 Stunde keine Mail versendet wurde. Wenn das im Normalbetrieb vorkommen kann (z.B. nachts), das Intervall anpassen oder diesen Monitor nur während der Geschäftszeiten aktiv schalten.

### Monitor 3: Fehlerrate

Erkennt: Hohe Fehlerrate, SMTP-Authentifizierungsprobleme, TLS-Fehler.

| Einstellung        | Wert                                    |
| ------------------ | --------------------------------------- |
| Name               | `Relanto Fehlerrate`                    |
| Typ                | HTTP(s) - JSON Query                    |
| URL                | `https://relanto.example.com/metrics`   |
| Headers            | `Authorization: Bearer <METRICS_TOKEN>` |
| JSON Path          | `$.activity.failed_last_hour`           |
| Expected Value     | `< 5`                                   |
| Heartbeat Interval | 300s (5 Min.)                           |

Schwellwert `5` ist ein Startwert -- an das tatsächliche Versandvolumen anpassen. Bei hohem Volumen kann ein relativer Schwellwert sinnvoller sein (muss dann in der Anwendung berechnet werden).

### Monitor 4: SMTP-Configs aktiv

Erkennt: Alle SMTP-Server disabled oder locked -- kein Versand moeglich.

| Einstellung        | Wert                                    |
| ------------------ | --------------------------------------- |
| Name               | `Relanto SMTP aktiv`                    |
| Typ                | HTTP(s) - JSON Query                    |
| URL                | `https://relanto.example.com/metrics`   |
| Headers            | `Authorization: Bearer <METRICS_TOKEN>` |
| JSON Path          | `$.services.active`                     |
| Expected Value     | `> 0`                                   |
| Heartbeat Interval | 300s (5 Min.)                           |

### Monitor 5: Speicherverbrauch

Erkennt: Memory-Leak, bevor der Prozess crasht.

| Einstellung        | Wert                                    |
| ------------------ | --------------------------------------- |
| Name               | `Relanto Memory`                        |
| Typ                | HTTP(s) - JSON Query                    |
| URL                | `https://relanto.example.com/metrics`   |
| Headers            | `Authorization: Bearer <METRICS_TOKEN>` |
| JSON Path          | `$.process.memory_rss_bytes`            |
| Expected Value     | `< 536870912`                           |
| Heartbeat Interval | 300s (5 Min.)                           |

Der Schwellwert `536870912` (512 MB) ist ein konservativer Startwert. Nach einigen Tagen Betrieb den normalen RSS-Wert beobachten und den Schwellwert auf ca. 2x Normalbetrieb setzen.

### Zusammenfassung Monitors

| #   | Name         | Prüft                              | Intervall | Kritikalität |
| --- | ------------ | ---------------------------------- | --------- | ------------ |
| 1   | Health       | Dienst antwortet, DB + Worker ok   | 60s       | Kritisch     |
| 2   | Mail-Versand | Es werden Mails versendet          | 5 Min.    | Hoch         |
| 3   | Fehlerrate   | Nicht zu viele Fehler              | 5 Min.    | Hoch         |
| 4   | SMTP aktiv   | Mind. 1 SMTP-Config betriebsbereit | 5 Min.    | Hoch         |
| 5   | Memory       | Kein Memory-Leak                   | 5 Min.    | Mittel       |

### Notification-Empfehlung

- **Monitor 1 (Health):** Sofort benachrichtigen -- Dienst ist komplett ausgefallen.
- **Monitors 2-4:** Nach 2 aufeinanderfolgenden Fehlschlägen benachrichtigen (10 Min. Verzögerung). Vermeidet Fehlalarme bei kurzen Aussetzern.
- **Monitor 5 (Memory):** Nach 3 aufeinanderfolgenden Fehlschlägen (15 Min.). Speicher schwankt natürlich, nur ein dauerhafter Anstieg ist relevant.

## Environment-Variablen

Variablen für die Endpunkte:

| Variable                | Erforderlich | Default | Beschreibung                                                                   |
| ----------------------- | ------------ | ------- | ------------------------------------------------------------------------------ |
| `METRICS_TOKEN`         | Nein         | --      | Bearer-Token für `/metrics`. Wenn nicht gesetzt, gibt der Endpunkt 404 zurück. |
| `RELANTO_GIT_SHORT_SHA` | Nein         | `dev`   | Git-Commit-Hash für `/health`. Zur Build-Zeit setzen; Fallback `GITHUB_SHA`.   |

Bestehende, relevante Variablen:

| Variable                    | Beschreibung                                                |
| --------------------------- | ----------------------------------------------------------- |
| `MAILER_DB_PATH`            | Pfad zur SQLite-Datei (für `size_bytes` im DB-Check)        |
| `MAILER_WORKER_INTERVAL_MS` | Worker-Intervall (für `interval_ms` und Health-Schwellwert) |

## Betroffene Dateien

| Datei                                         | Rolle                                              |
| --------------------------------------------- | -------------------------------------------------- |
| `packages/backend/src/worker.ts`              | `lastTickAt`-Tracking und `getLastTickAt()`-Export |
| `packages/backend/src/index.ts`               | `getLastTickAt` re-exportiert                      |
| `packages/frontend/app/routes/api.health.ts`  | Health-Handler                                     |
| `packages/frontend/app/routes/api.metrics.ts` | Metrics-Handler mit Token-Auth                     |
