# 0028: API-Fehler im Server-Log und im Admin-Audit-Panel nachvollziehbar machen

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-plan
**Empfohlener Workflow:** Feature (`/sf-build`)

## Anforderung

4xx-Antworten auf `/api/v1/*` sollen für Betreiber diagnostizierbar werden, ohne dass der API-Client den Response-Body verfügbar macht. Aktuell schreibt `react-router-serve` ausschließlich eine HTTP-Access-Zeile mit Methode, Pfad, Status und Dauer; der eigentliche Fehlergrund – fehlender Scope, ungültige Credentials, Zod-Validierungsfehler, Domain-Konflikt – steht nur im Response-Body und ist damit ohne Zugriff auf den Aufrufer nicht greifbar.

Zwei reale Vorfälle haben das Problem bestätigt: ein 401 auf `GET /api/v1/config` wegen fehlendem Scope `readConfig` wurde im Client als „Credentials abgelehnt" missinterpretiert; ein 400 auf `POST /api/v1/send` ließ sich ohne Client-Log nicht zuordnen.

Die Umsetzung ist ein Feature, weil zwei sichtbare Fähigkeiten neu hinzukommen: strukturiertes Server-Logging der Fehlerursache und ein Admin-UI-Panel mit persistiertem 4xx-Verlauf, gestützt von einer neuen Read-API und Retention-Logik.

Verifizierter Code-Kontext:

- HTTP-Access-Log stammt aus `react-router-serve` (`packages/frontend/package.json`); ein In-Process-Eingriff in dessen Format ist nicht vorgesehen. Zusätzliche Logs werden eigenständig geschrieben.
- 4xx-Quellen in API-Routen sind dreigeteilt:
  - `requireApiAccess` (`packages/frontend/app/lib/server/auth.server.ts:77-106`) wirft 401 mit `Response`-Objekten für „Missing authorization" und für Fehler aus `authenticateAccessToken`.
  - `withDomainErrorJson` (`packages/frontend/app/routes/api._shared.ts:96-124`) ist der zentrale Catch der meisten Routen. Er klassifiziert `Response`-Throws, Zod-Validation (400, Pfad `attachments` 413), Domain-Errors aus `DOMAIN_ERROR_STATUS_BY_MESSAGE` (`api._shared.ts:37-54`) und mappt Unbekanntes auf 500.
  - `api.send.ts` und `api.token.ts` besitzen eigene `try/catch`-Blöcke mit lokaler Fehlerklassifikation; siehe bestehendes TODO „auf `withDomainErrorJson` umstellen".
- `requireMethod` (`packages/frontend/app/routes/require-method.ts`) wirft 405 als `Response` und wird in den Routen innerhalb des `withDomainErrorJson`-Handlers aufgerufen, sodass die zentrale Catch-Stelle 405 mit erfasst.
- Audit-Log-Infrastruktur existiert bereits: Tabelle `audit_logs` (`packages/backend/src/db.ts:174-183`) und Helper `logAudit` (`packages/backend/src/service.ts:731-759`). Es werden ausschließlich Erfolgsaktionen geschrieben; es gibt keine Read-Query, keine API-Route und kein UI für Audit-Einträge.
- Worker führt Cleanup über `applyJobRetention` (`packages/backend/src/service.ts:469`, Aufruf in `worker.ts:2620`). Pattern lässt sich für eine eigene Retention-Funktion übernehmen.
- Dashboard ist eine Single-File-Route mit über 1800 Zeilen (`packages/frontend/app/routes/dashboard.tsx`). Eine eigene Subroute hält das überschaubar und nutzt das bestehende `requireSystemAdminUser`-Pattern.
- Backend-Logging existiert nur als `console.error("[mailer-worker]", error)` (`packages/backend/src/worker.ts:18`); es gibt keine Logger-Library und kein strukturiertes Format. Das neue Server-Log soll dieser Linie folgen.

## Architekturentscheidungen

- **Eigene Tabelle `api_request_failures` statt Wiederverwendung von `audit_logs`.** Begründung: `audit_logs` modelliert Akteur-Aktionen auf Entitäten; ein fehlgeschlagener Request hat häufig weder Akteur (ohne Bearer) noch klare Entität. Eine eigene Tabelle vermeidet künstliches Mapping und erlaubt klare Spalten für HTTP-Status, Pfad und Reason-Category.
- **Zentraler Helper `logApiFailure`** in einer neuen Server-only-Datei. Wird aus `withDomainErrorJson`, `requireApiAccess` sowie den Catch-Blöcken in `api.send.ts` und `api.token.ts` aufgerufen. Single Source of Truth für strukturierte stdout-Zeile und DB-Persistenz.
- **Reason-Kategorisierung als Enum**: `auth_missing` (kein Bearer), `auth_invalid` (Token- oder Credential-Verifikation fehlgeschlagen), `scope_missing` (Scope nicht im Token), `validation` (Zod), `domain_error` (gemapptes `DOMAIN_ERROR_STATUS_BY_MESSAGE`), `method_not_allowed` (405), `other` (Fallback). Vorteil: filterbar im UI, vereinfacht Trend-Analyse, hält Reason-Message frei von Klassifikationsfragmenten.
- **PII- und Secret-Schutz durch Felddefinition**: Persistiert werden ausschließlich HTTP-Status, Pfad, Methode, Reason-Category, Reason-Message (statisch oder schema-basiert), Issue-Pfade aus Zod (z. B. `["text"]`), `clientId` aus dem JWT- oder Token-Exchange-Payload, `tokenId` und `applicationId` falls authentifiziert. Niemals: Request-Body, Header-Werte außer ggf. später `user-agent`, Query-String-Inhalte, Zod-Issue-Values, Secret- oder Tokenmaterial. Diese Begrenzung steht im Helper, nicht in einer nachgelagerten Filterlogik.
- **Retention 30 Tage Default** mit ENV `API_FAILURE_RETENTION_DAYS`. Worker erhält einen zusätzlichen Aufruf `applyApiFailureRetention` neben `applyJobRetention`.
- **Sichtbarkeit nur System-Admin**. Die Read-Funktion wird über eine eigene Admin-Subroute zugänglich, geschützt durch das bestehende `requireSystemAdminUser`. Kein neuer REST-Endpunkt, weil nur die Admin-UI darauf zugreift.
- **Server-Log-Format**: einzeilige JSON-Ausgabe via `console.log` mit Prefix `[api-failure]`. Bewusst keine Logger-Library, konsistent mit `console.error("[mailer-worker]", …)`. Felder ohne Wert werden weggelassen, nicht als `null` geschrieben.
- **Best-effort-Persistenz**: Schlägt `recordApiFailure` aufgrund eines DB-Problems fehl, wird der Fehler auf stderr geloggt, aber nicht in die Response propagiert. Die strukturierte stdout-Zeile bleibt erhalten.
- **`withDomainErrorJson` erhält den Request als zweites Argument**, weil der zentrale Catch sonst Pfad, Methode und Bearer-Token nicht kennt. Bestehende Aufrufer werden mitangepasst.

## Betroffene Dateien

| Datei                                                                                                                             | Beschreibung                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/backend/src/db.ts`                                                                                                      | Tabelle `api_request_failures` im Initial-Schema und Migrationsschritt analog zu vorhandenen `migrate*Schema`-Helpern. Indizes auf `created_at`, `(application_id, created_at)`, `(reason_category, created_at)`.        |
| `packages/backend/src/types.ts`                                                                                                   | `apiFailureReasonSchema`-Enum, Typ `ApiRequestFailure`, Filter-Schema für die Read-Funktion.                                                                                                                             |
| `packages/backend/src/service.ts`                                                                                                 | Neue Funktionen `recordApiFailure`, `listApiFailures`, `applyApiFailureRetention`. `recordApiFailure` gibt nur Erfolg/Fehler intern bekannt; Fehler werden vom Aufrufer als nicht kritisch behandelt.                    |
| `packages/backend/src/env.ts`                                                                                                     | ENV `API_FAILURE_RETENTION_DAYS` mit Default 30 und Validierung als positive Ganzzahl.                                                                                                                                   |
| `packages/backend/src/index.ts`                                                                                                   | Re-Exporte für `recordApiFailure`, `listApiFailures`, `apiFailureReasonSchema`, `ApiRequestFailure`, `applyApiFailureRetention`.                                                                                         |
| `packages/backend/src/worker.ts`                                                                                                  | Aufruf von `applyApiFailureRetention` in der bestehenden Cleanup-Schleife.                                                                                                                                               |
| `packages/frontend/app/lib/server/api-failure-log.server.ts`                                                                      | Neuer Helper `logApiFailure({status, method, path, clientId?, tokenId?, applicationId?, tokenKind?, reasonCategory, reasonMessage, details?})`. Schreibt JSON-Zeile auf stdout und ruft `recordApiFailure` in Try/Catch. |
| `packages/frontend/app/lib/server/auth.server.ts`                                                                                 | `requireApiAccess` klassifiziert vor dem Throw: kein Bearer → `auth_missing`; Bearer vorhanden und Message beginnt mit „Token is missing required scope" → `scope_missing`; sonst → `auth_invalid`.                      |
| `packages/frontend/app/routes/api._shared.ts`                                                                                     | Signatur von `withDomainErrorJson` um `request` erweitern. Jeder 4xx-Zweig ruft `logApiFailure` mit der passenden Reason-Category. 500-Pfad bleibt für dieses Plan-Scope unbehandelt.                                    |
| `packages/frontend/app/routes/api.applications.ts`, `api.configs*.ts`, `api.jobs*.ts`, `api.tokens.$tokenId*.ts`, `api.config.ts` | Aufrufe von `withDomainErrorJson(handler)` zu `withDomainErrorJson(request, handler)` umstellen. Rein mechanische Anpassung.                                                                                             |
| `packages/frontend/app/routes/api.send.ts`                                                                                        | Lokalen Catch um `logApiFailure`-Aufrufe ergänzen. Reason-Categories: `validation`, `domain_error`, `auth_missing`/`auth_invalid`/`scope_missing` (passend zu bestehendem Throw-Pfad), `method_not_allowed`.             |
| `packages/frontend/app/routes/api.token.ts`                                                                                       | Analog `api.send.ts`. Token-Exchange-Failures werden mit der eingegebenen `client_id` aus dem Body als `clientId` geloggt, ohne `tokenId`/`applicationId`.                                                               |
| `packages/frontend/app/routes/dashboard.api-failures.tsx`                                                                         | Neue Subroute. Loader mit `requireSystemAdminUser` und `listApiFailures` aus Search-Params. UI: Filterleiste plus Tabelle mit Zeit, Methode/Pfad, Status, Reason-Category, Reason-Message, Client-/Application-Bezug.    |
| `packages/frontend/app/routes.ts`                                                                                                 | Route `api-failures` registrieren (Pflicht laut `AGENTS.md`).                                                                                                                                                            |
| `packages/frontend/app/routes/dashboard.tsx`                                                                                      | Navigations- oder Linkeintrag zur neuen Subroute.                                                                                                                                                                        |
| `packages/frontend/app/locales/en.ts`                                                                                             | Strings für Panel-Überschrift, Reason-Category-Labels, Tabellenspalten, leerer Zustand, Filterlabels.                                                                                                                    |
| `packages/backend/src/regression-suite.test.mjs`                                                                                  | Tests für `recordApiFailure`, `listApiFailures` mit Filter und Sortierung, `applyApiFailureRetention` mit Stichtag.                                                                                                      |
| `packages/frontend/app/routes/api.scope-matrix.test.ts` oder neuer Testteil                                                       | Verifizieren, dass `requireApiAccess` und `withDomainErrorJson` `logApiFailure` mit erwarteter Reason-Category aufrufen; Helper wird gemockt.                                                                            |
| `packages/frontend/app/routes/dashboard.api-failures.test.ts`                                                                     | Loader-Test: System-Admin-Schutz, Filter-Parsing aus URL, leerer Zustand.                                                                                                                                                |
| `deploy/quadlet/relanto.container.example`                                                                                        | `API_FAILURE_RETENTION_DAYS` als optionale ENV erwähnen.                                                                                                                                                                 |
| `README.md` und/oder `packages/frontend/README.md`                                                                                | Kurzhinweis auf neues Panel und neue ENV.                                                                                                                                                                                |

## Implementierungsdetails

### Vorgehen

1. Backend-Schema und -Service:
   - Tabelle `api_request_failures` in `db.ts` ergänzen (Initial-Schema und Migrationsschritt).
   - `apiFailureReasonSchema`, `ApiRequestFailure` und Filter-Schema in `types.ts`.
   - `recordApiFailure`, `listApiFailures`, `applyApiFailureRetention` in `service.ts`.
   - ENV-Wert in `env.ts`, Default 30 Tage.
   - Worker-Cleanup um `applyApiFailureRetention` erweitern.
2. Frontend-Helper `api-failure-log.server.ts`:
   - Strukturierte stdout-Zeile mit Prefix `[api-failure]`.
   - DB-Persistenz über `recordApiFailure`, Fehler werden auf stderr ausgegeben, aber nicht propagiert.
3. Integration in 4xx-Pfade:
   - `requireApiAccess` klassifiziert vor dem Throw und ruft `logApiFailure`.
   - `withDomainErrorJson` erhält Zugriff auf `request` und ruft `logApiFailure` pro Branch.
   - Aufrufer in den Routen werden auf die neue Signatur umgestellt.
   - `api.send.ts` und `api.token.ts` rufen den Helper aus ihren bestehenden Catch-Blöcken.
4. Admin-UI:
   - Neue Subroute `dashboard.api-failures.tsx` mit System-Admin-Schutz, Loader und Tabelle.
   - Filter über Search-Params (Zeitraum, Status, Reason-Category, Application-ID).
   - Verlinkung im Hauptdashboard.
5. i18n-Strings und Doku.
6. Tests und `pnpm agent:check`.

### Datenmodell

Spalten von `api_request_failures`:

- `id` TEXT PRIMARY KEY (`createId("apifail")`)
- `created_at` TEXT NOT NULL
- `http_status` INTEGER NOT NULL
- `request_method` TEXT NOT NULL
- `request_path` TEXT NOT NULL
- `reason_category` TEXT NOT NULL
- `reason_message` TEXT NOT NULL
- `client_id` TEXT NULL
- `token_id` TEXT NULL
- `token_kind` TEXT NULL
- `application_id` TEXT NULL
- `details_json` TEXT NULL

Indizes: `(created_at)`, `(application_id, created_at)`, `(reason_category, created_at)`.

`details_json` ist eng begrenzt: bei `validation` enthält es `issuePaths` (maximal die ersten zehn Pfade als Stringliste) und optional `issueCount`. Bei `scope_missing` enthält es `expectedScope`. Bei `domain_error` bleibt es leer oder enthält die Domain-Kategorie. Niemals Issue-Values oder andere Payload-Inhalte.

### Server-Log-Format

Eine einzeilige JSON-Zeile pro 4xx, illustrativ (kein wörtlich zu übernehmender Code):

`[api-failure] {"ts":"…","status":401,"method":"GET","path":"/api/v1/config","reason":"scope_missing","reasonMessage":"…","clientId":"appcli_…","applicationId":"app_…"}`

Felder ohne Wert werden weggelassen.

### Edge Cases

- **Anonymer Aufruf ohne Bearer**: `clientId`, `tokenId`, `applicationId` bleiben leer; Reason `auth_missing`.
- **Token gültig, Scope fehlt**: Werte aus dem dekodierten JWT übernehmen; Reason `scope_missing`; `details_json.expectedScope` wird gesetzt.
- **Token-Exchange mit falschen Credentials**: `clientId` aus dem Request-Body; Reason `auth_invalid`; `tokenId` und `applicationId` bleiben leer.
- **Zod-Validation**: `details_json.issuePaths` enthält bis zu zehn Pfade als Strings; `issueCount` zeigt die Gesamtzahl; keine Issue-Values.
- **Domain-Error**: `reason_message` ist eine bekannte Domain-Error-Message aus `DOMAIN_ERROR_STATUS_BY_MESSAGE`. Liegt eine Message außerhalb der Map, wird sie als `other` mit verkürzter Message gespeichert, um Leakage auszuschließen.
- **DB nicht erreichbar**: stdout-Log bleibt vorhanden, kein 500 für den API-Aufrufer.
- **Hohe 4xx-Rate (Scan-/Bot-Traffic)**: Tabelle wächst, Retention begrenzt die Größe. Rate-Limit ist explizit out-of-scope und bleibt beim bestehenden TODO „Rate-Limit-, Throttling- oder Anomalie-Logik".
- **Mehrere Zod-Issues**: persistiert wird die Anzahl plus die ersten zehn Pfade; nur der erste Issue fließt in `reason_message`, analog zur bestehenden Response.
- **5xx**: nicht durch dieses Plan-Scope erfasst.
- **JWT-Decode liefert keine `clientId`**: Eintrag wird trotzdem geschrieben, `clientId` bleibt leer.

## Akzeptanzkriterien

- [ ] Tabelle `api_request_failures` existiert sowohl in einer frisch initialisierten als auch in einer migrierten DB.
- [ ] Jede 4xx-Antwort auf einer Route unter `/api/v1/*` erzeugt genau eine stdout-Zeile mit Prefix `[api-failure]` und – bei erreichbarer DB – genau einen Eintrag in `api_request_failures`.
- [ ] Logzeile und DB-Eintrag enthalten kein Passwort, kein Token-Secret, keinen Request-Body, keine Zod-Issue-Values und keine vollen Header.
- [ ] Reason-Kategorien `auth_missing`, `auth_invalid`, `scope_missing`, `validation`, `domain_error`, `method_not_allowed`, `other` werden für die jeweiligen Code-Pfade korrekt vergeben.
- [ ] `details_json.issuePaths` enthält maximal zehn Einträge und niemals Issue-Values.
- [ ] Eine neue Admin-Subroute zeigt die letzten Einträge mit Filtern für Zeitraum, Status, Reason-Category und Application.
- [ ] Nur System-Admin-Sessions können das Panel laden; ohne Session erfolgt Redirect auf `/login`.
- [ ] ENV `API_FAILURE_RETENTION_DAYS` ist gesetzt; Worker entfernt Einträge älter als die konfigurierte Dauer.
- [ ] DB-Fehler beim Persistieren werden auf stderr geloggt, schlagen aber nicht auf die API-Response durch.
- [ ] `pnpm agent:check` ist grün.

## Validierungsplan

- Backend-Tests in `regression-suite.test.mjs`:
  - `recordApiFailure` schreibt die richtigen Felder; optionale Felder bleiben `null`; `details_json` wird als valides JSON gespeichert.
  - `listApiFailures` respektiert Filter (Zeitraum, Status, Reason-Category, Application-ID) und sortiert absteigend nach `created_at`.
  - `applyApiFailureRetention` entfernt Einträge älter als die konfigurierte Dauer, jüngere bleiben erhalten.
- Frontend-Tests:
  - `requireApiAccess` und `withDomainErrorJson` rufen `logApiFailure` mit erwarteten Reason-Categories auf (Helper gemockt).
  - Lokale Catch-Blöcke in `api.send.ts` und `api.token.ts` lösen passende Reason-Categories aus.
  - Loader von `dashboard.api-failures.tsx` schützt vor nicht-System-Admin-Sessions und reicht Search-Param-Filter korrekt durch.
- Manueller Verifikationspfad in Dev:
  - `POST /api/v1/token` mit falschem Secret erzeugt einen `auth_invalid`-Eintrag mit der eingegebenen `client_id`.
  - `GET /api/v1/config` mit Token ohne `readConfig` erzeugt einen `scope_missing`-Eintrag mit `details_json.expectedScope=readConfig`.
  - `POST /api/v1/send` ohne Feld `text` erzeugt einen `validation`-Eintrag mit `details_json.issuePaths=["text"]`.
  - Panel zeigt alle drei Einträge mit korrekten Werten.
- Abschluss mit `pnpm agent:check`.

## Annahmen und offene Punkte

- Annahme: Das Access-Log von `react-router-serve` bleibt unverändert. `[api-failure]`-Zeile wird zusätzlich geschrieben.
- Annahme: Reason-Category-Labels werden im UI über Palamedes-i18n übersetzt; intern bleiben die Codes wie `scope_missing`.
- Annahme: 5xx-Antworten bleiben out-of-scope; der Container-Log und gegebenenfalls künftiges Crash-Logging bleibt zuständig.
- Annahme: Die Umstellung von `api.send.ts` und `api.token.ts` auf `withDomainErrorJson` aus dem bestehenden TODO ist keine Voraussetzung. Sie bleiben mit lokalem Catch und rufen `logApiFailure` selbst.
- Annahme: Rate-Limit und Anomalie-Erkennung bleiben out-of-scope; sie werden über den bestehenden TODO-Eintrag weiter adressiert.
- Festlegung: Application-Admins erhalten in dieser Umsetzung **keinen** Zugriff auf das Panel; nur System-Admin sieht Failures. Eine Erweiterung kann später folgen.
- Offener Produktpunkt: Ob das Panel zusätzlich aggregierte Sichten zeigt („Top-Fehler letzte 24 h pro Application"). Erste Umsetzung ist eine reine Liste mit Filtern. Aggregation kann später ohne Datenmodell-Änderung ergänzt werden.
- Offener Punkt: Maximalanzahl persistierter Issue-Pfade ist im Plan auf zehn gesetzt; finale Festlegung erfolgt bei Implementierung, falls sich in Tests ein anderer sinnvoller Wert zeigt.

## Plan-Review

**Ergebnis:** Freigegeben

### Zusammenfassung

| Bereich     | Kritisch | Wichtig | Hinweis |
| ----------- | -------: | ------: | ------: |
| Architektur |        0 |       0 |       1 |
| Security    |        0 |       0 |       1 |
| Datenschutz |        0 |       0 |       1 |
| Fehlerfälle |        0 |       0 |       1 |
| Testbarkeit |        0 |       0 |       0 |
| Scope       |        0 |       0 |       1 |
| Wartbarkeit |        0 |       0 |       0 |

### Befunde

- **Architektur (Hinweis):** `withDomainErrorJson` wird auf die Signatur `(request, handler)` umgestellt. Die Anpassung ist mechanisch, betrifft aber alle aufrufenden Routen. Wenn der Refactoring-Aufwand minimiert werden soll, kann der Helper stattdessen das Request-Objekt über eine Closure-Variable im Caller akzeptieren; die gewählte Signaturvariante ist trotzdem die klarere und wird im Plan bewusst beibehalten.
- **Security (Hinweis):** Pfadwerte enthalten interne IDs wie `tokenId` oder `jobId`. Diese sind nicht geheim, eine Erwähnung im Datenschutz-Abschnitt der späteren Implementierung ist trotzdem sinnvoll.
- **Datenschutz (Hinweis):** Die PII-/Secret-Begrenzung steht im Helper, nicht in einer nachgelagerten Filterlogik. Dadurch ist eine Code-Review-Stelle ausreichend, um Verstöße zu erkennen. Die Begrenzung soll in einem Code-Kommentar am Helper festgehalten werden.
- **Fehlerfälle (Hinweis):** Wenn die SQLite-DB exklusiv gesperrt ist (Restore-Vorgang gemäß README), schlägt `recordApiFailure` fehl, aber die Response-Pipeline läuft weiter. Dieses Verhalten ist gewollt und im Plan dokumentiert.
- **Scope (Hinweis):** Rate-Limit, 5xx-Logging, Application-Admin-Sichtbarkeit und Trend-Aggregationen sind explizit out-of-scope. Die Abgrenzung bleibt im Plan stehen, damit spätere Workflows nicht versehentlich darauf zurückgreifen.

## Testergebnisse

- `pnpm agent:check` grün (Lint, Format, Typecheck, Tests).
- Backend: 70 Tests, davon 4 neue Tests in `regression-suite.test.mjs` für `recordApiFailure`, `listApiFailures` mit Filtern und Sortierung sowie `applyApiFailureRetention`.
- Frontend: 77 Tests, davon neue Tests in `api.failure-logging.test.ts` (Reason-Klassifikation für `requireApiAccess` und `withDomainErrorJson`, inklusive Marker-Mechanismus gegen Doppel-Logging) und `dashboard.api-failures.test.ts` (Admin-Schutz, Filter-Parsing aus Search-Params, leerer Zustand, ungültige Werte werden still verworfen).

## Review-Findings

**Datum:** 2026-06-04
**Reviewer:** feature-dev:code-reviewer (Fullstack)

### Zusammenfassung

| Status                  | Anzahl |
| ----------------------- | -----: |
| Behoben                 |      7 |
| Offen / Nicht umgesetzt |      2 |

Behoben in der Umsetzung: Doppel-Logging von Auth-Fehlern via Marker-Header `X-Api-Failure-Logged`, `migrateApiRequestFailuresSchema` setzt `user_version` auf 7, eigene Konstante `MAX_REQUEST_PATH_LENGTH` für Pfad-Trunkierung, neuer Test für den Marker-Mechanismus.

**Externer Review-Report:** `.sf-plugin/review/review-report-2026-06-04-plan-0028.md`
