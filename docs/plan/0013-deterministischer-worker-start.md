# 0013: Deterministischer Worker-Start beim Prozessstart

**Planungsstatus:** Umgesetzt

## Anforderung

Der Relanto-Worker soll beim produktiven Prozessstart deterministisch starten statt erst beim ersten HTTP-Request. Der Pfad soll mit Restart- und Queue-Smoke-Tests validiert werden.

## Architekturentscheidungen

- Der produktive Startpfad von `@relanto/frontend` importiert vor `react-router-serve` einen dedizierten Startup-Hook.
- Der Worker bleibt als In-Process-Worker Teil des Single-Instance-Deployments.
- Request-basierte Initialisierung bleibt nur als idempotenter Fallback bestehen; der produktive Pfad haengt nicht mehr vom ersten Request ab.
- Beim Worker-Start wird sofort ein erster Tick ausgefuehrt, bevor das Intervall weiterlaeuft.

## Betroffene Dateien

| Datei                                     | Beschreibung                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `packages/backend/src/worker.ts`          | Sofortiger Initial-Tick beim Worker-Start                             |
| `packages/backend/src/worker.test.mjs`    | Queue- und Restart-Smoke-Tests fuer den Worker                        |
| `packages/frontend/package.json`          | Produktiver Startpfad mit `NODE_OPTIONS=--import=./serverStartup.mjs` |
| `packages/frontend/serverStartup.mjs`     | Prozessweiter Startup-Hook fuer den Worker                            |
| `packages/frontend/serverStartup.test.ts` | Test fuer den deterministischen Startup-Hook                          |
| `packages/frontend/README.md`             | Betriebsdoku fuer den neuen Startpfad                                 |
| `review-report-2026-03-30.md`             | Rueckverweis auf das umgesetzte Finding                               |

## Implementierungsdetails

- `startWorkerLoop()` fuehrt jetzt beim ersten Start sofort `processDueJobs()` aus und startet danach das Intervall.
- Das produktive Startskript von `@relanto/frontend` setzt `NODE_OPTIONS=--import=./serverStartup.mjs`, sodass der Worker schon beim Prozess-Boot initialisiert wird.
- `serverStartup.mjs` startet den Worker explizit beim Prozessstart.
- `worker.test.mjs` deckt zwei Integrationspfade ab:
  - wartender `queued`-Job wird nach Worker-Start ohne Request verarbeitet
  - nach `stopWorkerLoop()` verarbeitet ein erneuter Start neue wartende Jobs wieder

## Testergebnisse

- `pnpm --filter @relanto/backend test` gruen
- `pnpm --filter @relanto/frontend test` gruen
- `pnpm agent:check` gruen
- produktionsnaher Start-Smoke-Test: `@relanto/frontend start` erfolgreich
- HTTP-Smoke-Test: `HEAD /login` liefert `200 OK`

## Review-Findings und Behebung

- Keine offenen Review-Findings nach Umsetzung
