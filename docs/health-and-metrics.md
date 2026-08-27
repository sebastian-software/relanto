# Health- und Metrics-Endpunkte (generische Vorlage)

> **Hinweis:** Dies ist eine **generische, projektunabhängige Vorlage**. Sie ist **nicht** die verbindliche Dokumentation für Relanto und kann von der tatsächlichen Implementierung abweichen. Für Relanto ist ausschließlich [`health-and-metrics-relanto.md`](./health-and-metrics-relanto.md) maßgeblich.

Allgemeingültige Spezifikation und Implementierungsanleitung für Health- und Metrics-Endpunkte in kleinen Node.js-Diensten. Dient als Vorlage, die projektspezifisch angepasst wird.

## Überblick

| Endpunkt       | Zweck                                                   | Authentifizierung | HTTP-Methode |
| -------------- | ------------------------------------------------------- | ----------------- | ------------ |
| `GET /health`  | Verfügbarkeitsprüfung für Load Balancer und Uptime Kuma | Keine             | GET          |
| `GET /metrics` | Betriebsdaten für Monitoring-Dashboards                 | Bearer-Token      | GET          |

Beide Endpunkte geben JSON zurück und verwenden `Content-Type: application/json`.

---

## 1. Health-Endpunkt (`GET /health`)

### Zweck

Beantwortet die Frage: „Läuft der Dienst und kann er Anfragen entgegennehmen?" Wird von Load Balancern, Reverse Proxies und Uptime Kuma abgefragt. Gibt keine Betriebsdaten oder sensiblen Informationen preis.

### Response

**HTTP 200** -- Dienst ist verfügbar:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "hash": "a1b2c3d"
}
```

**HTTP 503** -- Dienst ist nicht verfügbar:

```json
{
  "status": "unhealthy",
  "version": "1.0.0",
  "hash": "a1b2c3d"
}
```

### Felder

| Feld      | Typ                        | Beschreibung                                                                                                 |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `status`  | `"healthy" \| "unhealthy"` | Gesamtstatus des Dienstes                                                                                    |
| `version` | `string`                   | Versionsnummer aus `package.json`                                                                            |
| `hash`    | `string \| undefined`      | Git-Commit-Hash (kurz) der deployen Version. Optional -- wird nur ausgegeben, wenn zur Build-Zeit verfügbar. |

### Wann ist der Dienst "unhealthy"?

Der Endpunkt gibt `503` zurück, wenn **mindestens eine** der konfigurierten Prüfungen fehlschlägt. Welche Prüfungen relevant sind, hängt vom Dienst ab:

| Prüfung                | Wann relevant                       | Kriterium                                                  |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Datenbank erreichbar   | Dienste mit Datenbank               | `SELECT 1` muss innerhalb von 2 Sekunden erfolgreich sein  |
| Worker-Loop aktiv      | Dienste mit Background-Worker       | Letzter Worker-Tick nicht älter als `2 * workerIntervalMs` |
| Cache erreichbar       | Dienste mit Redis/Memcached         | `PING` muss erfolgreich sein                               |
| Externe API erreichbar | Dienste mit kritischer Abhängigkeit | Nur wenn der Dienst ohne die API nicht funktionsfähig ist  |

**Faustregel:** Nur Abhängigkeiten prüfen, ohne die der Dienst keine Anfragen bearbeiten kann. Optionale Features (z.B. Analytics, Logging-Backend) gehören nicht in den Health-Check.

### Implementierungsdetails

#### Keine Authentifizierung

Der Health-Endpunkt darf **keine** Authentifizierung erfordern. Load Balancer und Monitoring-Tools müssen unauthentifiziert zugreifen können.

#### Datenbank-Check

```typescript
// SQLite (better-sqlite3, synchron)
function isDatabaseHealthy(): boolean {
  try {
    const db = getDatabase();
    const result = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    return result?.ok === 1;
  } catch {
    return false;
  }
}

// PostgreSQL / MySQL (async)
async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const result = await db.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

// Redis
async function isCacheHealthy(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
```

#### Worker-Check

Dienste mit einem Background-Worker (z.B. Job-Queue, Scheduler) sollten den letzten erfolgreichen Tick tracken. Dafür muss der Worker-Code angepasst werden:

**Worker-Modul erweitern:**

```typescript
// Im Worker-Modul (z.B. worker.ts)
let lastTickAt: number | undefined;

function tick(): void {
  if (tickInFlight) return;
  tickInFlight = true;

  void processJobs()
    .catch((error: unknown) => {
      console.error("[worker]", error);
    })
    .finally(() => {
      lastTickAt = Date.now();
      tickInFlight = false;
    });
}

// Exportiere den Zeitstempel für den Health-Check
export function getLastTickAt(): number | undefined {
  return lastTickAt;
}
```

**Worker-Status prüfen:**

```typescript
import { getLastTickAt } from "./worker";

function isWorkerHealthy(intervalMs: number): boolean {
  const lastTick = getLastTickAt();
  if (lastTick === undefined) return false;

  const maxAge = intervalMs * 2;
  return Date.now() - lastTick < maxAge;
}
```

#### Vollständiger Health-Handler

```typescript
export async function loader(): Promise<Response> {
  const dbHealthy = isDatabaseHealthy();
  const workerHealthy = isWorkerHealthy(WORKER_INTERVAL_MS); // weglassen, wenn kein Worker
  const healthy = dbHealthy && workerHealthy;

  return Response.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      version: APP_VERSION,
      ...(GIT_HASH ? { hash: GIT_HASH } : {}),
    },
    { status: healthy ? 200 : 503 },
  );
}
```

#### Version aus package.json lesen

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
})();
```

Alternativ die Version als Build-Zeit-Konstante über eine Environment-Variable oder einen Build-Step bereitstellen.

#### Git-Hash ermitteln

Der Git-Hash identifiziert den exakten Commit, der deployed wurde. Da zur Laufzeit in Produktionsumgebungen oft kein `.git`-Verzeichnis vorhanden ist, muss der Hash zur **Build-Zeit** erfasst werden.

**Variante A: Environment-Variable (empfohlen)**

Die CI/CD-Pipeline oder das Dockerfile setzt den Hash als Environment-Variable:

```dockerfile
# Dockerfile
ARG GIT_HASH
ENV GIT_HASH=$GIT_HASH
```

```bash
# CI/CD Build-Befehl
docker build --build-arg GIT_HASH=$(git rev-parse --short HEAD) .
```

```typescript
const GIT_HASH: string | undefined = process.env.GIT_HASH?.trim() || undefined;
```

**Variante B: Build-Zeit-Datei**

Für Deployments ohne Docker (z.B. direktes `node` auf dem Server) kann ein Build-Schritt den Hash in eine Datei schreiben:

```bash
# Im Build-Skript (package.json "build" oder CI-Step)
git rev-parse --short HEAD > .git-hash
```

```typescript
const GIT_HASH: string | undefined = (() => {
  try {
    return readFileSync(resolve(import.meta.dirname, "../.git-hash"), "utf-8").trim() || undefined;
  } catch {
    return undefined;
  }
})();
```

Die Datei `.git-hash` sollte in `.gitignore` eingetragen werden, da sie ein Build-Artefakt ist.

**Variante C: Zur Laufzeit aus Git lesen (nur Entwicklung)**

Funktioniert nur, wenn das `.git`-Verzeichnis vorhanden ist -- also typischerweise nur lokal:

```typescript
import { execSync } from "node:child_process";

const GIT_HASH: string | undefined = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return undefined;
  }
})();
```

Diese Variante eignet sich als Fallback für die Entwicklungsumgebung, sollte aber nicht die primäre Methode in Produktion sein.

---

## 2. Metrics-Endpunkt (`GET /metrics`)

### Zweck

Liefert Betriebsdaten über den Zustand des Dienstes: Queue-Größen, Fehlerraten, Worker-Status, Datenbankgröße. Diese Daten sind **vertraulich**, da sie Rückschlüsse auf Nutzungsvolumen, Systemlast und Angriffsfenster erlauben.

### Authentifizierung

Bearer-Token über den `Authorization`-Header:

```
GET /metrics
Authorization: Bearer <METRICS_TOKEN>
```

| Situation                   | HTTP-Status | Response                                            |
| --------------------------- | ----------- | --------------------------------------------------- |
| Kein `Authorization`-Header | `401`       | `{ "error": "Missing authorization", "ok": false }` |
| Falscher Token              | `403`       | `{ "error": "Invalid metrics token", "ok": false }` |
| Korrekter Token             | `200`       | Metrics-Payload (siehe unten)                       |

#### Token-Konfiguration

Der Token wird über eine Environment-Variable konfiguriert:

````
METRICS_TOKEN=ein-langer-zufaelliger-string-min-32-zeichen```

Token generieren:

```bash
openssl rand -base64 48
````

**Wichtig:** Dieser Token ist **unabhängig** von den Anwendungs-Tokens des Dienstes. Er wird nur für den Metrics-Endpunkt verwendet. Derselbe Token kann für alle Dienste verwendet werden, wenn sie vom selben Monitoring-System abgefragt werden.

#### Token-Validierung

```typescript
function validateMetricsToken(request: Request): boolean {
  const token = process.env.METRICS_TOKEN?.trim();

  // Wenn kein Token konfiguriert ist, ist der Endpunkt deaktiviert
  if (!token) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length).trim();

  // Timing-safe Vergleich, um Timing-Angriffe zu verhindern
  return timingSafeCompare(token, provided);
}
```

#### Timing-safe Vergleich

Verhindert, dass ein Angreifer den Token zeichenweise erraten kann, indem er Antwortzeiten misst. Welche Implementierung genutzt wird, hängt von der Laufzeitumgebung ab:

**Variante A: Node.js `crypto` (bevorzugt, wenn verfügbar)**

```typescript
import { timingSafeEqual } from "node:crypto";

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

**Variante B: Web Crypto API (für Laufzeiten ohne `node:crypto`)**

Für Umgebungen wie Convex, Cloudflare Workers oder Deno, in denen `node:crypto` nicht zur Verfügung steht oder ein explizites `"use node"` erfordern würde, kann die Web Crypto API genutzt werden:

```typescript
async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(a),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(a));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(b));
}
```

Diese Variante nutzt `crypto.subtle.verify`, das intern einen konstant-zeit Vergleich durchführt. Der HMAC wird mit dem erwarteten Token als Schlüssel berechnet -- stimmen die Eingaben überein, verifiziert `verify` die Signatur erfolgreich.

**Variante C: Eigene Implementierung (Fallback)**

Wenn weder `node:crypto` noch die Web Crypto API verfügbar sind:

```typescript
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
```

Der XOR-Vergleich durchläuft immer alle Zeichen und vermeidet so einen frühen Abbruch. **Hinweis:** Diese Variante bietet keinen Schutz gegen JIT-Compiler-Optimierungen, die den konstant-zeit Charakter theoretisch brechen könnten. Variante A oder B sind daher vorzuziehen.

**Welche Variante wählen?**

| Laufzeit                         | Empfehlung                          |
| -------------------------------- | ----------------------------------- |
| Node.js, Bun                     | Variante A (`node:crypto`)          |
| Convex, Cloudflare Workers, Deno | Variante B (Web Crypto API)         |
| Unbekannt / eingeschränkt        | Variante C (eigene Implementierung) |

Bei Variante B ist `timingSafeCompare` asynchron (`Promise<boolean>`) – der aufrufende Code muss entsprechend mit `await` arbeiten.

#### Uptime Kuma Konfiguration

In Uptime Kuma unter "HTTP(s) - Keyword" oder "HTTP(s) - JSON Query" Monitor:

1. URL: `https://dein-dienst.example.com/metrics`
2. Headers: `Authorization: Bearer <METRICS_TOKEN>`
3. Expected Status Code: `200`

### Response-Schema

**HTTP 200** -- Erfolgreiche Abfrage:

```json
{
  "ok": true,
  "uptime_seconds": 84200,
  "version": "1.0.0",
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
    "pending": 3,
    "processing": 1,
    "completed": 14523,
    "failed": 12
  },
  "activity": {
    "last_completed_at": "2026-04-21T09:58:12.000Z",
    "completed_last_hour": 42,
    "failed_last_hour": 0,
    "oldest_pending_at": "2026-04-21T09:55:00.000Z"
  },
  "errors_last_hour": {
    "network": 3,
    "auth": 1
  }
}
```

### Felder

#### Top-Level

| Feld             | Typ       | Beschreibung                                    |
| ---------------- | --------- | ----------------------------------------------- |
| `ok`             | `boolean` | Immer `true` bei HTTP 200                       |
| `uptime_seconds` | `number`  | Sekunden seit Prozessstart (`process.uptime()`) |
| `version`        | `string`  | Versionsnummer aus `package.json`               |

#### `process`

Prozess-Speicherverbrauch. Relevant für Dienste, bei denen alles im selben Prozess läuft (In-Process-Worker, SQLite). Ein schleichender Memory-Leak fällt sonst erst beim Crash auf.

| Feld                     | Typ      | Beschreibung                                                   |
| ------------------------ | -------- | -------------------------------------------------------------- |
| `memory_rss_bytes`       | `number` | Resident Set Size -- tatsaechlich belegter physischer Speicher |
| `memory_heap_used_bytes` | `number` | Vom V8-Heap belegter Speicher                                  |

```typescript
function getProcessMetrics(): { memory_rss_bytes: number; memory_heap_used_bytes: number } {
  const mem = process.memoryUsage();
  return {
    memory_rss_bytes: mem.rss,
    memory_heap_used_bytes: mem.heapUsed,
  };
}
```

#### `checks.database`

| Feld         | Typ                        | Beschreibung                                                     |
| ------------ | -------------------------- | ---------------------------------------------------------------- |
| `status`     | `"healthy" \| "unhealthy"` | Ergebnis des Datenbank-Checks                                    |
| `latency_ms` | `number`                   | Dauer des `SELECT 1`-Statements in Millisekunden                 |
| `size_bytes` | `number \| null`           | Datenbankgröße in Bytes (nur SQLite; bei Postgres/MySQL: `null`) |

#### `checks.worker` (optional)

Nur bei Diensten mit Background-Worker. Weglassen, wenn nicht vorhanden.

| Feld               | Typ                        | Beschreibung                        |
| ------------------ | -------------------------- | ----------------------------------- |
| `status`           | `"healthy" \| "unhealthy"` | Ob der Worker-Loop aktiv ist        |
| `interval_ms`      | `number`                   | Konfiguriertes Worker-Intervall     |
| `last_tick_at`     | `string \| null`           | ISO-Zeitstempel des letzten Ticks   |
| `last_tick_age_ms` | `number \| null`           | Millisekunden seit dem letzten Tick |

#### `services` (optional)

Nur bei Diensten mit konfigurierbaren Backends oder externen Abhängigkeiten (z.B. SMTP-Server, Webhook-Ziele, API-Anbindungen). Zeigt an, wie viele dieser Backends aktiv, deaktiviert oder eingeschränkt sind. Die konkreten Zustandsbezeichnungen sind projektspezifisch.

| Feld       | Typ      | Beschreibung                                                     |
| ---------- | -------- | ---------------------------------------------------------------- |
| `total`    | `number` | Gesamtzahl konfigurierter Backends                               |
| `active`   | `number` | Betriebsbereite Backends                                         |
| `degraded` | `number` | Deaktivierte, gesperrte oder anderweitig eingeschränkte Backends |

Ein Dienst, bei dem `active === 0` und `total > 0`, kann keine Arbeit verrichten, obwohl Worker und Datenbank gesund sind.

#### `errors_last_hour` (optional)

Nur bei Diensten mit kategorisierten Fehlern. Schlüsselt `activity.failed_last_hour` nach Fehlerursache auf. Die Kategorien sind projektspezifisch.

| Feld        | Typ      | Beschreibung                                                 |
| ----------- | -------- | ------------------------------------------------------------ |
| _Kategorie_ | `number` | Anzahl der Fehler dieser Kategorie in den letzten 60 Minuten |

Nur Kategorien mit `count > 0` werden ausgegeben. Ein leeres Objekt `{}` bedeutet keine Fehler.

**Typische Beispiele nach Diensttyp:**

SMTP-Versand: `{ "network": 3, "auth": 1, "tls": 0 }`
Webhook-Delivery: `{ "timeout": 5, "http_4xx": 2, "http_5xx": 1 }`
API-Proxy: `{ "upstream_timeout": 3, "rate_limited": 1 }`

#### `queue` (optional)

Nur bei Diensten mit Job-Queue. Zählt Jobs nach Status. Die konkreten Status-Werte und ihre Bedeutung sind projektspezifisch.

**Typische Beispiele nach Diensttyp:**

Mail-Queue:

```json
{ "queued": 3, "processing": 1, "sent": 14523, "failed": 12, "retry_scheduled": 2 }
```

Task-/Job-Queue:

```json
{ "pending": 10, "running": 2, "completed": 500, "failed": 5, "retrying": 1 }
```

Build-Pipeline:

```json
{ "queued": 4, "building": 1, "succeeded": 230, "failed": 3, "cancelled": 1 }
```

Webhook-Delivery:

```json
{ "pending": 8, "delivering": 2, "delivered": 1200, "failed": 15 }
```

#### `activity` (optional)

Nur bei Diensten mit Job-Queue. Liefert Aktivitätsdaten, die Trends und Ausfälle sichtbar machen -- im Gegensatz zu `queue`, das nur den aktuellen Snapshot zeigt.

| Feld                  | Typ              | Beschreibung                                                                                                    |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `last_completed_at`   | `string \| null` | ISO-Zeitstempel des letzten erfolgreich abgeschlossenen Jobs. `null` wenn noch nie ein Job abgeschlossen wurde. |
| `completed_last_hour` | `number`         | Anzahl erfolgreich abgeschlossener Jobs in den letzten 60 Minuten.                                              |
| `failed_last_hour`    | `number`         | Anzahl fehlgeschlagener Jobs in den letzten 60 Minuten.                                                         |
| `oldest_pending_at`   | `string \| null` | ISO-Zeitstempel des ältesten wartenden Jobs. `null` wenn keine Jobs warten. Zeigt, ob sich die Queue staut.     |

**Was die Felder erkennen lassen:**

| Alarm-Szenario       | Erkennbar über                                                   |
| -------------------- | ---------------------------------------------------------------- |
| Kein Durchsatz mehr  | `completed_last_hour === 0` bei gleichzeitig `queue.pending > 0` |
| Lange nicht gesendet | Alter von `last_completed_at` (z.B. > 1 Stunde)                  |
| Fehlerrate steigt    | `failed_last_hour` überschreitet Schwellwert                     |
| Queue staut sich     | `oldest_pending_at` ist älter als erwartet (z.B. > 10 Minuten)   |
| Totaler Ausfall      | `completed_last_hour === 0` und `failed_last_hour > 0`           |

**Benennung projektspezifisch anpassen:** `completed` und `failed` sind generische Begriffe. Dienste können spezifischere Namen verwenden (z.B. `sent_last_hour` für Mail-Dienste, `delivered_last_hour` für Webhook-Dienste), solange das Schema innerhalb eines Projekts konsistent bleibt.

**Uptime Kuma Konfiguration (Beispiele für JSON Query Monitors):**

- Kein Durchsatz: `$.activity.completed_last_hour` erwartet `> 0`
- Fehlerrate: `$.activity.failed_last_hour` erwartet `< 5`

### Implementierungsdetails

#### Datenbank-Check mit Latenz

```typescript
function checkDatabase(): {
  status: "healthy" | "unhealthy";
  latency_ms: number;
  size_bytes: number | null;
} {
  const start = performance.now();

  try {
    const db = getDatabase();
    db.prepare("SELECT 1 AS ok").get();
    const latency_ms = Math.round(performance.now() - start);

    // SQLite-Dateigröße (nur möglich bei dateibasierten Datenbanken)
    let size_bytes: number | null = null;
    try {
      const stat = statSync(getDatabasePath());
      size_bytes = stat.size;
    } catch {
      // Ignorieren -- z.B. bei In-Memory-DBs oder Postgres
    }

    return { status: "healthy", latency_ms, size_bytes };
  } catch {
    return {
      status: "unhealthy",
      latency_ms: Math.round(performance.now() - start),
      size_bytes: null,
    };
  }
}
```

#### Queue-Zählung

Die Grundstruktur ist immer dieselbe – `GROUP BY status`. Tabelle, Spalte und Status-Werte projektspezifisch anpassen:

```typescript
function getQueueCounts(
  tableName: string,
  allStatuses: string[],
  excludeDeleted: boolean = true,
): Record<string, number> {
  const db = getDatabase();

  const where = excludeDeleted ? `WHERE deleted_at IS NULL` : "";
  const rows = db
    .prepare(
      `
    SELECT status, COUNT(*) AS count
    FROM ${tableName}
    ${where}
    GROUP BY status
  `,
    )
    .all() as Array<{ status: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const status of allStatuses) {
    counts[status] = 0;
  }
  for (const row of rows) {
    counts[row.status] = row.count;
  }

  return counts;
}
```

#### Activity-Daten

Ermittelt Aktivitätsdaten aus der Job-Tabelle. Die Feldnamen (`completed`/`failed`), Tabelle und Status-Werte projektspezifisch anpassen:

```typescript
function getActivity(
  tableName: string,
  completedStatus: string, // z.B. "sent", "completed", "delivered"
  failedStatus: string, // z.B. "failed"
  pendingStatuses: string[], // z.B. ["pending", "queued", "retry_scheduled"]
  completedTimestampCol: string, // z.B. "sent_at", "completed_at"
  createdTimestampCol: string, // z.B. "created_at"
  excludeDeleted: boolean = true,
): {
  last_completed_at: string | null;
  completed_last_hour: number;
  failed_last_hour: number;
  oldest_pending_at: string | null;
} {
  const db = getDatabase();
  const deletedFilter = excludeDeleted ? "AND deleted_at IS NULL" : "";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Letzter erfolgreicher Job
  const lastCompleted = db
    .prepare(
      `
    SELECT ${completedTimestampCol} AS ts
    FROM ${tableName}
    WHERE status = ? ${deletedFilter}
    ORDER BY ${completedTimestampCol} DESC
    LIMIT 1
  `,
    )
    .get(completedStatus) as { ts: string } | undefined;

  // Erfolgreiche Jobs in der letzten Stunde
  const completedCount = db
    .prepare(
      `
    SELECT COUNT(*) AS count
    FROM ${tableName}
    WHERE status = ? AND ${completedTimestampCol} >= ? ${deletedFilter}
  `,
    )
    .get(completedStatus, oneHourAgo) as { count: number };

  // Fehlgeschlagene Jobs in der letzten Stunde
  const failedCount = db
    .prepare(
      `
    SELECT COUNT(*) AS count
    FROM ${tableName}
    WHERE status = ? AND updated_at >= ? ${deletedFilter}
  `,
    )
    .get(failedStatus, oneHourAgo) as { count: number };

  // Ältester wartender Job
  const pendingPlaceholders = pendingStatuses.map(() => "?").join(", ");
  const oldestPending = db
    .prepare(
      `
    SELECT ${createdTimestampCol} AS ts
    FROM ${tableName}
    WHERE status IN (${pendingPlaceholders}) ${deletedFilter}
    ORDER BY ${createdTimestampCol} ASC
    LIMIT 1
  `,
    )
    .get(...pendingStatuses) as { ts: string } | undefined;

  return {
    last_completed_at: lastCompleted?.ts ?? null,
    completed_last_hour: completedCount.count,
    failed_last_hour: failedCount.count,
    oldest_pending_at: oldestPending?.ts ?? null,
  };
}
```

#### Worker-Check mit Details

```typescript
import { getLastTickAt } from "./worker";

function checkWorker(intervalMs: number): {
  status: "healthy" | "unhealthy";
  interval_ms: number;
  last_tick_at: string | null;
  last_tick_age_ms: number | null;
} {
  const lastTick = getLastTickAt();

  if (lastTick === undefined) {
    return {
      status: "unhealthy",
      interval_ms: intervalMs,
      last_tick_at: null,
      last_tick_age_ms: null,
    };
  }

  const ageMs = Date.now() - lastTick;
  return {
    status: ageMs < intervalMs * 2 ? "healthy" : "unhealthy",
    interval_ms: intervalMs,
    last_tick_at: new Date(lastTick).toISOString(),
    last_tick_age_ms: ageMs,
  };
}
```

#### Vollständiger Metrics-Handler

```typescript
export async function loader({ request }: { request: Request }): Promise<Response> {
  // Authentifizierung
  const token = process.env.METRICS_TOKEN?.trim();

  if (!token) {
    return Response.json({ error: "Metrics endpoint not configured", ok: false }, { status: 404 });
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing authorization", ok: false }, { status: 401 });
  }

  const provided = header.slice("Bearer ".length).trim();

  if (!timingSafeCompare(token, provided)) {
    return Response.json({ error: "Invalid metrics token", ok: false }, { status: 403 });
  }

  // Daten sammeln -- projektspezifisch anpassen
  const processMetrics = getProcessMetrics();
  const database = checkDatabase();
  const worker = checkWorker(WORKER_INTERVAL_MS); // weglassen, wenn kein Worker
  const services = getServiceStatus(); // weglassen, wenn keine externen Backends
  const queue = getQueueCounts("jobs", ALL_STATUSES); // weglassen, wenn keine Queue
  const activity = getActivity(
    "jobs",
    "completed",
    "failed",
    ["pending"],
    "completed_at",
    "created_at",
  ); // weglassen, wenn keine Queue
  const errorsLastHour = getErrorsLastHour(); // weglassen, wenn keine kategorisierten Fehler

  return Response.json({
    ok: true,
    uptime_seconds: Math.floor(process.uptime()),
    version: APP_VERSION,
    process: processMetrics,
    checks: {
      database,
      worker, // weglassen, wenn kein Worker
    },
    services, // weglassen, wenn keine externen Backends
    queue, // weglassen, wenn keine Queue
    activity, // weglassen, wenn keine Queue
    errors_last_hour: errorsLastHour, // weglassen, wenn keine kategorisierten Fehler
  });
}
```

---

## 3. Projektübergreifende Konventionen

Diese Konventionen gelten für alle Dienste, um ein einheitliches Monitoring zu ermöglichen.

### Einheitliche Pfade

- Health: immer `GET /health`
- Metrics: immer `GET /metrics`

### Einheitliches Response-Schema

```typescript
// Health
type HealthResponse = {
  status: "healthy" | "unhealthy";
  version: string;
  hash?: string;
};

// Metrics
type MetricsResponse = {
  ok: true;
  uptime_seconds: number;
  version: string;
  process: {
    memory_rss_bytes: number;
    memory_heap_used_bytes: number;
  };
  checks: {
    database: {
      status: "healthy" | "unhealthy";
      latency_ms: number;
      size_bytes: number | null;
    };
    worker?: {
      status: "healthy" | "unhealthy";
      interval_ms: number;
      last_tick_at: string | null;
      last_tick_age_ms: number | null;
    };
  };
  services?: {
    total: number;
    active: number;
    degraded: number;
  };
  queue?: Record<string, number>;
  activity?: {
    last_completed_at: string | null;
    completed_last_hour: number;
    failed_last_hour: number;
    oldest_pending_at: string | null;
  };
  errors_last_hour?: Record<string, number>;
};
```

### Felder weglassen statt null

Dienste ohne Worker lassen `checks.worker` weg. Dienste ohne Queue lassen `queue` weg. So erkennt das Monitoring-Tool automatisch, welche Features ein Dienst hat.

### HTTP-Statuscodes

| Code  | Bedeutung                                         |
| ----- | ------------------------------------------------- |
| `200` | Alles in Ordnung                                  |
| `401` | Kein Authorization-Header (nur `/metrics`)        |
| `403` | Falscher Token (nur `/metrics`)                   |
| `404` | Metrics nicht konfiguriert (kein `METRICS_TOKEN`) |
| `503` | Dienst unhealthy (nur `/health`)                  |

### Environment-Variablen

| Variable        | Erforderlich | Default | Beschreibung                                                                                                       |
| --------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `METRICS_TOKEN` | Nein         | --      | Bearer-Token für den Metrics-Endpunkt. Wenn nicht gesetzt, gibt `/metrics` HTTP 404 zurück. Mindestens 32 Zeichen. |
| `GIT_HASH`      | Nein         | --      | Git-Commit-Hash. Zur Build-Zeit setzen (siehe Abschnitt "Git-Hash ermitteln").                                     |

### Gemeinsamer Metrics-Token

Für mehrere Dienste, die vom selben Uptime Kuma abgefragt werden, kann ein einziger `METRICS_TOKEN` verwendet werden. Das vereinfacht die Konfiguration, ohne die Sicherheit wesentlich zu reduzieren -- der Token schützt vor unautorisiertem Zugriff, nicht vor lateraler Bewegung innerhalb des Monitoring-Netzwerks.
