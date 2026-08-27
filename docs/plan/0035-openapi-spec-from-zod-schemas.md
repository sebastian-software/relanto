# 0035: OpenAPI-3-Spec aus den Zod-Schemas ableiten

**Planungsstatus:** Umgesetzt

**Empfohlener Workflow:** /firmo build

Quelle: GitHub-Issue #119 (Epic #124, Phase 8). Die API ist bisher nur prosaisch (`LLMs.txt`) dokumentiert; es fehlt eine maschinenlesbare OpenAPI-Spec zum Generieren von Clients/Contract-Tests.

## Anforderung

Eine OpenAPI-3-Spec aus den bestehenden Zod-Schemas ableiten und als getrackte Datei ins Repo legen. In CI prüfen, dass die Spec (a) aktuell ist (deterministisch aus dem Code regenerierbar) und (b) deckungsgleich mit der Routenliste ist (jede `/api/v1`-Route + Methode ist in der Spec und umgekehrt).

## Architekturentscheidungen

- **AE1 — Native Zod-Konvertierung statt Zusatz-Lib.** Zod 4.4.3 bietet `z.toJSONSchema(schema, { target: "draft-2020-12" })` (Default-Target). Wir nutzen das nativ und setzen die Paths/Operations selbst zusammen. Keine neue Runtime-Dependency (`zod-openapi`/`@asteasolutions/...`). Begründung: minimale Abhängigkeiten (Projektlinie), volle Kontrolle, Zod ist ohnehin die Schema-Quelle.
- **AE1b — Ziel OpenAPI 3.1.** Die Spec wird als **OpenAPI 3.1.1** ausgegeben (`openapi: "3.1.1"`). OpenAPI 3.1 verwendet JSON Schema 2020-12 als Schema-Dialekt — exakt das, was Zods `target: "draft-2020-12"` erzeugt; die Konvertierung ist damit verlustärmer als beim `openapi-3.0`-Target (das auf draft-04 heruntergeht). 3.0 ist veraltet, 3.2.0 ist sehr neu mit noch dünnem Tooling-Support; 3.1 ist der robuste Sweet Spot. Zum Prüfungszeitpunkt sind Zod 4.4.3 (latest) und OpenAPI 3.1.2/3.2.0 die neuesten Stände; ein stabiles OpenAPI 4.x existiert nicht.
- **AE2 — Deskriptive Spec, nicht Runtime-Validator.** `.refine()`/`.superRefine()` (z. B. CRLF-Guard in `headerSafeString`, Host-Format, aggregierte Attachment-Größe in `sendMailInputSchema`) bilden sich nicht vollständig in JSON-Schema ab. Diese Constraints werden, wo sinnvoll, über ergänzende JSON-Schema-Metadaten angenähert (z. B. `pattern`, `maxLength`) bzw. in `description` dokumentiert. Die Laufzeit-Validierung bleibt unverändert im Code; die Spec ist bewusst deskriptiv.
- **AE3 — Response-Schemas als Zod nachziehen, driftsicher.** Die Response-Typen existieren bisher nur als TS-`type`. Wir definieren dafür Zod-Response-Schemas in einem neuen Modul und sichern per **Compile-Time-Konformitätsprüfung** gegen die bestehenden TS-Typen ab (`satisfies`/Type-Equality-Assertion), sodass ein Auseinanderlaufen den Typecheck rot macht. Die bestehenden TS-Typen bleiben als kanonische Quelle erhalten (minimaler Churn), die Zod-Schemas spiegeln sie.
- **AE4 — Einheitliches Error-Envelope als Component.** Das zentrale Fehlerformat aus `api._shared.ts` (`{ ok: false, error, issues? }`) wird als wiederverwendbare `components.schemas.Error` modelliert und von den dokumentierten Fehler-Statuscodes referenziert.
- **AE5 — Spec als getrackte JSON-Datei + Generator-Script.** Ausgabeziel `packages/backend/openapi.json` (`openapi: "3.1.1"`), erzeugt via `pnpm --filter @relanto/backend openapi:generate`. JSON statt YAML (kein Extra-Dep; `z.toJSONSchema` liefert JSON). Ein HTTP-Endpoint zum Ausliefern der Spec ist bewusst **nicht** Teil dieses Plans (möglicher Follow-up).
- **AE6 — CI-Absicherung als Vitest-Test (komponiert mit #98/SSOT).** Statt eines separaten CI-Steps läuft die Prüfung als Backend-Vitest-Test und damit automatisch unter `pnpm test` → `agent:check:ci`. Der Test (a) regeneriert die Spec in-memory und vergleicht sie mit der committeten Datei (Freshness), und (b) prüft die Deckung Spec ↔ `routes.ts`-Routenliste beidseitig.

## Akzeptanzkriterien

1. `packages/backend/openapi.json` existiert, ist valides OpenAPI 3.1 und enthält alle 25 API-Operationen (20 `/api/v1`-Routen inkl. Methodenvarianten + `/health`, `/metrics`) mit Pfad, Methode, Pfad-/Query-Parametern, Request-Body (aus dem jeweiligen Zod-Schema), Erfolgs-Response-Schema und den dokumentierten Fehler-Statuscodes.
2. `pnpm --filter @relanto/backend openapi:generate` erzeugt die Datei deterministisch; ein erneuter Lauf ohne Code-Änderung produziert keinen Diff.
3. Ein Vitest-Test schlägt fehl, wenn (a) die committete `openapi.json` von der frisch generierten abweicht oder (b) eine `/api/v1`-Route/Methode aus `routes.ts` in der Spec fehlt bzw. die Spec eine nicht existierende Route/Methode enthält.
4. Jede Operation trägt eine `operationId`, das nötige Security-/Scope-Hinweise (Bearer + benötigter Scope bzw. System-Admin) und die aus dem Code belegten Statuscodes.
5. `pnpm agent:check` ist vollständig grün (lint, format, typecheck, build, test). Die Compile-Time-Konformitätsprüfung der Response-Schemas gegen die TS-Typen ist Teil des Typechecks.

## Betroffene Dateien

| Datei                                          | Art                       | Zweck                                                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/openapi/responses.ts`    | neu                       | Zod-Response-Schemas (Envelopes: job, config(+admin view), token(+created), application, issued-access-token, validation-result, jobs/list …) + Compile-Time-Konformität gegen die TS-Typen aus `types.ts` |
| `packages/backend/src/openapi/registry.ts`     | neu                       | Zentrale Route→Operation-Zuordnung (Pfad, Methode, `operationId`, Request-Schema, Param-Schemas, Response-Schema je Statuscode, Scope). Single Source für Generator + Coverage-Test                        |
| `packages/backend/src/openapi/generate.ts`     | neu                       | Baut aus der Registry das OpenAPI-Dokument (via `z.toJSONSchema` + `components.schemas.Error`) und liefert es als Objekt                                                                                   |
| `packages/backend/scripts/generate-openapi.ts` | neu                       | CLI-Einstieg: schreibt `openapi.json` (stabile Key-Sortierung, Newline am Ende)                                                                                                                            |
| `packages/backend/openapi.json`                | neu (generiert, getrackt) | Die Spec                                                                                                                                                                                                   |
| `packages/backend/src/openapi/openapi.test.ts` | neu                       | Freshness- + Deckungs-Test gegen `routes.ts`                                                                                                                                                               |
| `packages/backend/package.json`                | ändern                    | Script `openapi:generate` (+ ggf. `openapi:check`)                                                                                                                                                         |
| `packages/backend/src/types.ts`                | evtl. leichte Ergänzung   | nur falls ergänzende JSON-Schema-Metadaten (`.meta({...})`/`pattern`) für refine-Constraints sinnvoll direkt am Schema liegen                                                                              |
| `LLMs.txt` / `packages/frontend/README.md`     | Doku (Phase 3)            | kurzer Verweis auf die generierte `openapi.json`                                                                                                                                                           |

Referenz-Quellen (unverändert): `packages/frontend/app/routes.ts` (Routen-Wahrheit), `packages/backend/src/types.ts` (Request-/Enum-Schemas), `packages/frontend/app/routes/api._shared.ts` (Error-Envelope, Scope-Durchsetzung), `LLMs.txt` (inhaltlicher Abgleich).

## Implementierungsdetails

- Die **Registry** ist die eine Stelle, die Routen, Methoden, Scopes und Schemas verknüpft; sowohl Generator als auch Coverage-Test lesen sie, damit sie nicht auseinanderlaufen. Die Routen-Strings werden gegen `routes.ts` abgeglichen (RR7-`:param` → OpenAPI-`{param}`).
- `z.toJSONSchema` mit `target: "draft-2020-12"` (passend zu OpenAPI 3.1); das Ergebnis pro Schema wird unter `components.schemas` referenziert (via `$ref`), um Duplikate zu vermeiden. Für nicht abbildbare `.refine`/`.superRefine`-Constraints (AE2) ergänzende Metadaten bzw. `description`. Zod emittiert `$ref`s standardmäßig unter `#/$defs/...`; beim Zusammenbau auf `#/components/schemas/...` umschreiben (bzw. `z.toJSONSchema` mit passendem `uri`/`io`-Setting konfigurieren).
- **Response-Konformität:** je Response-Schema eine Typ-Assertion, z. B. `type _Job = Expect<Equal<z.infer<typeof jobStatusViewSchema>, MailJobStatusView>>` (Helfer `Equal/Expect` lokal), damit Drift den Typecheck bricht.
- **Version** im `info.version` aus `packages/backend/package.json` (bzw. Root) lesen, damit die Spec mitwächst.
- `openapi.json` deterministisch schreiben (stabile Sortierung der Objekt-Keys, abschließender Newline), damit der Freshness-Diff robust ist.

## Validierungsplan

- `pnpm --filter @relanto/backend openapi:generate` erzeugt/aktualisiert `openapi.json`; zweiter Lauf ohne Änderung → kein Diff.
- Vitest: Freshness (regeneriert == committet) und beidseitige Deckung Spec ↔ `routes.ts`.
- Optional lokal: Spec durch einen Standard-OpenAPI-Validator prüfen (z. B. `redocly lint`/`swagger-cli` via `dlx`, nur manuell — keine neue Dependency).
- `pnpm agent:check` vollständig grün.

## Nicht im Scope

- HTTP-Endpoint zum Ausliefern der Spec und eine Swagger-/Redoc-UI (möglicher Follow-up).
- Vollständige Runtime-Validierungs-Parität der refine-Constraints in der Spec (bewusst deskriptiv, AE2).
- Umbau der bestehenden TS-Response-Typen auf `z.infer` als alleinige Quelle (nur driftsichere Spiegelung, AE3).

## Implementierungsdetails (umgesetzt)

- Neue Module unter `packages/backend/src/openapi/`: `responses.ts` (Zod-Response-Schemas + Compile-Time-Drift-Guard `Equal`/`Expect`/`Simplify` gegen die TS-Typen), `registry.ts` (Single Source für alle 25 Operationen), `generate.ts` (baut das Dokument), `openapi.test.ts` (Freshness + beidseitige Deckung). CLI: `scripts/generate-openapi.ts` (via `jiti`), Script `openapi:generate`.
- `z.toJSONSchema(registry, { target: "draft-2020-12", uri })` schreibt `$ref` direkt auf `#/components/schemas/…`; Request-Bodies `io: "input"`, Responses `io: "output"`; geteilte Enums werden beim Merge auf Identität geprüft.
- `info.version` ist bewusst eine stabile `API_VERSION` (`1.0.0`), entkoppelt von der npm-Paketversion (Review-Finding F1), damit Release-Versionsbumps den Freshness-Test nicht brechen.
- Ergebnis-Spec: OpenAPI 3.1.1, 19 Pfade, 25 Operationen, 51 Component-Schemas, `Error`-Envelope-Component.
- `.oxfmtrc.json` ignoriert `**/openapi.json`; `tsconfig.json` nimmt `scripts/**` in den Typecheck auf.

## Testergebnisse

- `pnpm agent:check`: grün (lint, format:check, typecheck, build; Backend 151 Tests inkl. 4 neuer OpenAPI-Tests, Frontend 201 Tests).
- `pnpm --filter @relanto/backend openapi:generate`: deterministisch (zweiter Lauf ohne Diff).
- Vitest erzwingt Freshness (regeneriert == committet) und beidseitige Routen/Methoden-Deckung gegen `routes.ts`.

## Review-Findings

**Datum:** 2026-07-08
**Reviewer:** nodejs-reviewer

### Zusammenfassung

| Status                  | Anzahl |
| ----------------------- | -----: |
| Behoben                 |      1 |
| Offen / Nicht umgesetzt |      3 |

Behoben: F1 (Wichtig) — `info.version` von der Paketversion entkoppelt. Offen (alle Hinweis): Health-/Metrics-/Send-Response ohne Drift-Guard, Coverage-Test-Methodenableitung mit blindem Fleck, duplizierte Retention-Grenzen. Keine kritischen Findings.

**Externer Review-Report:** `.firmo/review/review-report-2026-07-08-plan-0035.md`
