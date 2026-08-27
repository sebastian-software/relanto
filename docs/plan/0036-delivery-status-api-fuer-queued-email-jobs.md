# 0036: Delivery-Status-API für queued E-Mail-Jobs

**Planungsstatus:** Umgesetzt
**Quelle:** /firmo plan https://github.com/sebastian-software/relanto/issues/179
**Empfohlener Workflow:** Feature (`/firmo build`)

## Anforderung

GitHub-Issue #179 fordert eine dokumentierte Polling-API für queued E-Mail-Jobs. Clients erhalten bei `POST /api/v1/send` bereits eine `jobId`, können heute aber nur die interne Job-Status-View über `GET /api/v1/jobs/:jobId` lesen. Diese View ist für Admin-/Queue-Kontext nützlich, liefert aber keinen stabilen, clientorientierten Delivery-Status-Vertrag mit terminaler Einordnung, Fehlerklassifikation, Unknown-/Expired-Verhalten und Batch-Polling.

Der Plan ist ein Feature-Plan, weil ein neuer öffentlicher API-Vertrag, neue Response-Schemas, Routen, Tests und Dokumentation entstehen. Verifizierter Code-Kontext: `readStatus` existiert bereits als Scope, `GET /api/v1/jobs/:jobId` nutzt ihn, Jobdaten enthalten Status, `updatedAt`, Retry-/Fehlerfelder, Provider-Response-Code und redaktierte Provider-Message-ID, und OpenAPI wird aus `packages/backend/src/openapi/registry.ts` sowie `responses.ts` generiert.

## Architekturentscheidungen

- **Dedizierte Delivery-Status-Ressource statt Bruch der bestehenden Job-View.** Die neue Polling-Oberfläche wird als neue Ressource unter dem Jobs-Kontext geplant, z. B. `GET /api/v1/jobs/:jobId/delivery-status` und `POST /api/v1/jobs/delivery-status`. `GET /api/v1/jobs/:jobId` bleibt kompatibel und kann später optional intern dieselbe Mapping-Funktion nutzen.
- **Application-facing DTO mit abgeleiteten Feldern.** Das neue DTO enthält `jobId`, `deliveryStatus`, `terminal`, `updatedAt`, `failureCategory`, `failureReason`, `providerResponseCode`, `providerMessageId`, `retryCount`, `nextRetryAt` und optional `sentAt`. Es gibt keine Rohdaten wie Body, Subject, Headers, vollständige Attachments oder SMTP-Transcript zurück.
- **Separates Delivery-Status-Modell über internem Jobstatus.** Interne Status bleiben unverändert. Für Clients werden sie auf `queued`, `processing`, `retrying`, `delivered`, `bounced`, `rejected`, `permanently_failed`, `cancelled`, `unknown` und `expired` gemappt. `sent` wird `delivered`; `failed` mit SMTP-5xx-Empfänger-/Envelope-Hinweis wird `bounced` oder `rejected`; `failed` ohne feinere Klassifikation wird `permanently_failed`; `delivery_uncertain` bleibt terminale Failure-Kategorie `permanently_failed` mit Unsicherheitsgrund.
- **Batch-Polling als bounded POST.** Batch-Polling wird mit Request-Body geplant, nicht als Query-String-Liste. Das vermeidet URL-Längenprobleme, erlaubt spätere Validierung über Zod und passt zum bestehenden `readJsonBody`-Pattern. Die Batch-Größe wird hart begrenzt, vorgeschlagen auf maximal 50 `jobIds`.
- **Unknown/Expired ohne Account-weite Auflistung.** Für die neue Delivery-Status-API werden unbekannte, gelöschte oder per Retention gepurgte IDs als per-job Ergebnis modelliert, nicht als Listenabfrage. Für einzelne GET-Requests kann HTTP `200` mit `deliveryStatus: "unknown"` oder `"expired"` zurückkommen; Ownership-Verletzungen bleiben `403`, soweit ein existierender Job eindeutig fremd ist.
- **Retention-Vertrag dokumentieren statt neue Persistenz erzwingen.** Der Vertrag nennt die vorhandenen tokenabhängigen Retention-Felder (`retainSentJobsDays`, `retainFailedJobsDays`, `retainErrorDetailsDays`, `retainAttachmentsDays`) als Queryability-Grenze. Ein gepurgter Job ist nicht mehr unterscheidbar von unbekannt, wenn keine Tombstone-Daten vorhanden sind; das wird als `unknown` oder `expired` dokumentiert und im Plan nicht durch neue Langzeitpersistenz erweitert.
- **OpenAPI bleibt Single Source.** Neue Request-/Response-Schemas werden in `packages/backend/src/openapi/responses.ts` bzw. `registry.ts` ergänzt und `packages/backend/openapi.json` deterministisch regeneriert. Der bestehende Freshness-/Coverage-Test muss die neue Route mitzählen.

## Betroffene Dateien

| Datei                                                             | Beschreibung                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/types.ts`                                   | Neue Zod-Schemas und Typen für Delivery-Status, Batch-Request und Batch-Response; interne Jobstatus-Enums bleiben unverändert.                                                                 |
| `packages/backend/src/service.ts`                                 | Mapping-Funktionen aus `MailJobStatusView`/Job-Record in das Delivery-Status-DTO; ownership-sichere Lookup-Funktionen für Single und Batch, ohne N+1-Fehlerpfade für fremde oder fehlende IDs. |
| `packages/backend/src/openapi/responses.ts`                       | Zod-Response-Schemas für Single- und Batch-Delivery-Status inklusive Compile-Time-Drift-Guard.                                                                                                 |
| `packages/backend/src/openapi/registry.ts`                        | Neue Operationen für Single- und Batch-Polling mit `readStatus`-Scope, Parametern, Request-Body und Fehlerantworten.                                                                           |
| `packages/backend/openapi.json`                                   | Generierte OpenAPI-Spec nach Aktualisierung der Registry.                                                                                                                                      |
| `packages/frontend/app/routes.ts`                                 | Registrierung der neuen React-Router-7-Routen.                                                                                                                                                 |
| `packages/frontend/app/routes/api.jobs.$jobId.delivery-status.ts` | Neue GET-Route für den Status eines bekannten `jobId`.                                                                                                                                         |
| `packages/frontend/app/routes/api.jobs.delivery-status.ts`        | Neue POST-Route für bounded Batch-Polling bekannter `jobIds`.                                                                                                                                  |
| `packages/frontend/app/routes/api.jobs.test.ts`                   | Route-Tests für Single- und Batch-Polling, Auth, Ownership, Unknown/Expired und redaktierte Fehlerdetails.                                                                                     |
| `packages/backend/src/service.test.mjs`                           | Service-/Mapping-Tests für Statusableitung, SMTP-Response-Code-Klassifikation, Retention-/Purge-Verhalten und Batch-Reihenfolge.                                                               |
| `packages/backend/src/openapi/openapi.test.ts`                    | Erwartete Operationenzahl und Coverage bleiben automatisch bzw. explizit an die neuen Routen angepasst.                                                                                        |
| `LLMs.txt`                                                        | Öffentliche API-Referenz mit Statusmodell, Retention-Vertrag, Single-/Batch-Beispielen und Unknown-/Expired-Verhalten.                                                                         |
| `README.md`                                                       | Kurzer Hinweis bei Scopes/Endpunkten, dass `readStatus` auch Delivery-Status-Polling abdeckt.                                                                                                  |

## Implementierungsdetails

### Vorgehen

1. In `packages/backend/src/types.ts` ein Delivery-Status-Schema ergänzen:
   - `deliveryStatus`: `queued`, `processing`, `retrying`, `delivered`, `bounced`, `rejected`, `permanently_failed`, `cancelled`, `unknown`, `expired`
   - `terminal`: boolean
   - `failureCategory`: optional, z. B. `unknown_recipient`, `mailbox_unavailable`, `relay_rejection`, `provider_rejection`, `delivery_uncertain`, `expired_or_unknown`
   - redaktierte Diagnosefelder: `failureReason`, `errorCode`, `providerResponseCode`, `providerMessageId`
2. In `service.ts` eine reine Mapping-Funktion ergänzen, die vorhandene Jobdaten ohne neue Seiteneffekte in das DTO übersetzt.
3. Für Single-Lookup eine ownership-sichere Service-Funktion planen, die fremde Jobs als `403` behandelt, vorhandene eigene Jobs als DTO zurückgibt und fehlende/gepurgte Jobs als `unknown` oder `expired` modelliert, ohne sensible Existenzinformationen über fremde Jobs preiszugeben.
4. Für Batch-Lookup eine bounded Funktion planen, die die Eingabe-Reihenfolge beibehält und pro `jobId` ein Ergebnis zurückgibt. Doppelte IDs sollen entweder dedupliziert und in Reihenfolge gespiegelt oder direkt mehrfach beantwortet werden; bevorzugt wird „Antwort pro Eingabe-ID“, weil das Client-Mapping einfacher bleibt.
5. Neue Routen unter `packages/frontend/app/routes/` anlegen und in `routes.ts` registrieren:
   - `GET /api/v1/jobs/:jobId/delivery-status`
   - `POST /api/v1/jobs/delivery-status`
6. In beiden Routen `requireAdminOrScope(request, "readStatus")` verwenden. Batch nutzt `readJsonBody` und ein Zod-Schema mit maximal 50 `jobIds`.
7. OpenAPI-Komponenten und Operations ergänzen, `packages/backend/openapi.json` regenerieren und die Operationenzahl im OpenAPI-Test anpassen.
8. `LLMs.txt` um eine Delivery-Status-Sektion ergänzen: Statusmodell, Terminal-Definition, Retention/Queryability, Unknown/Expired, Redaktionsregeln und Beispiele für pending, delivered, bounced/rejected, permanently failed sowie unknown/expired.
9. `README.md` nur knapp aktualisieren, damit der Scope-Hinweis auf `readStatus` die neue Polling-API nennt.

### API-Anbindung

Single-Request:

- Methode: `GET`
- Pfad: `GET /api/v1/jobs/:jobId/delivery-status`
- Auth: Bearer-Token oder System-Admin-Session wie bestehende `readStatus`-Endpunkte
- Scope: `readStatus`
- Erfolg: `200 { ok: true, status: DeliveryStatusResult }`

Batch-Request:

- Methode: `POST`
- Pfad: `POST /api/v1/jobs/delivery-status`
- Body: Objekt mit `jobIds`, maximal 50 Einträge, nicht leer
- Erfolg: `200 { ok: true, statuses: DeliveryStatusResult[] }`
- Fehler: `400` für ungültige Batch-Requests, `401`/`403` für Auth-/Scope-Verletzungen, `413` falls Body-Limit überschritten wird

### Status-Mapping

- `queued` und `paused` werden nicht-terminal und clientseitig als `queued` gemeldet; `paused` kann zusätzlich als interner `jobStatus` sichtbar bleiben.
- `processing` wird nicht-terminal als `processing` gemeldet.
- `retry_scheduled` wird nicht-terminal als `retrying` gemeldet und enthält `nextRetryAt`, falls vorhanden.
- `sent` wird terminal als `delivered` gemeldet.
- `failed` wird terminal als `bounced`, `rejected` oder `permanently_failed` gemeldet. SMTP-5xx-Antworten wie 550/553/501 sollen über `providerResponseCode`, `errorCode` und `errorCategory` in eine stabile Failure-Kategorie übersetzt werden.
- `delivery_uncertain` wird terminal als `permanently_failed` gemeldet, aber mit Failure-Kategorie `delivery_uncertain`, weil keine verlässliche Zustellbestätigung vorliegt.
- `cancelled` wird terminal als `cancelled` gemeldet.
- Fehlende oder gepurgte Jobs werden als `unknown` oder `expired` gemeldet. Wenn technisch nicht sicher zwischen nie existiert und per Retention gelöscht unterschieden werden kann, muss die Dokumentation diese Zusammenlegung ausdrücklich benennen.

### Datenschutz

Die Delivery-Status-Antwort gibt keine E-Mail-Inhalte zurück: kein `html`, kein `text`, keine `headers`, keine vollständigen Attachments und kein SMTP-Transcript. Empfängeradresse, Betreff und Sender werden für diese neue DTO nicht benötigt und bleiben deshalb draußen. Diagnoseinformationen werden auf Kategorien, Codes und kurze redaktierte Provider-Metadaten begrenzt.

### Edge Cases

- Ein Job wechselt während des Pollings von `retry_scheduled` zu `processing` oder `sent`; die API gibt den zum Query-Zeitpunkt konsistent gelesenen Stand zurück.
- Batch enthält doppelte `jobIds`; die Antwort bleibt pro Eingabe-ID deterministisch.
- Batch enthält mehr als 50 IDs; die Route antwortet mit `400` und legt keinen serverseitigen Suchlauf an.
- `jobId` gehört einer anderen Anwendung; Anwendungstoken erhalten `403` für eindeutig fremde existierende Jobs oder ein nicht preisgebendes Unknown-Ergebnis, falls die Lookup-Strategie Existenz nicht offenlegen darf. Die endgültige Umsetzung muss diese Entscheidung konsistent dokumentieren.
- Fehlerdetails wurden per `retainErrorDetailsDays` redaktiert; terminale Failure bleibt erkennbar, aber `failureReason`/Codes können fehlen.
- Job wurde per `retainSentJobsDays` oder `retainFailedJobsDays` gepurgt; die API kann nur noch `expired`/`unknown` melden.

## Akzeptanzkriterien

- [x] `GET /api/v1/jobs/:jobId/delivery-status` liefert für einen eigenen queued Job mit `readStatus`-Scope ein `200`-Response mit `jobId`, `deliveryStatus`, `terminal: false` und `updatedAt`.
- [x] Terminale Erfolgszustellung wird als `deliveryStatus: "delivered"` mit `terminal: true` gemeldet.
- [x] Terminale Fehlerzustände werden von Erfolg unterschieden und enthalten, soweit vorhanden, redaktierte Diagnosefelder für Kategorien wie unbekannter Empfänger, Mailbox nicht verfügbar, Relay-/Provider-Rejection oder Delivery-Uncertainty.
- [x] Unbekannte, gelöschte oder per Retention gepurgte `jobIds` haben ein dokumentiertes und getestetes Verhalten (`unknown`/`expired` oder klar begründeter HTTP-Fehler), ohne fremde Job-Existenz unnötig preiszugeben.
- [x] `POST /api/v1/jobs/delivery-status` akzeptiert eine begrenzte Liste bekannter `jobIds`, gibt pro Eingabe-ID ein Ergebnis zurück und führt keine account-, customer- oder application-weite Auflistung aus.
- [x] Beide neuen Endpunkte verwenden `readStatus` und halten die bestehenden Ownership-Grenzen für Anwendungstoken, Application-Admin-Tokens und System-Admins ein.
- [x] `LLMs.txt` dokumentiert Retention/Queryability, Unknown-/Expired-Verhalten, Idempotenz von Polling sowie Beispielantworten für pending, delivered, bounced/rejected, permanently failed und unknown/expired.
- [x] OpenAPI-Schemas, Registry und `packages/backend/openapi.json` enthalten die neuen Operationen; der OpenAPI-Freshness- und Routes-Coverage-Test ist grün.
- [x] `pnpm agent:check` läuft nach der Umsetzung vollständig grün.

## Validierungsplan

- Unit-Tests in `packages/backend/src/service.test.mjs` für Mapping von internen Jobstatus zu Delivery-Status inklusive SMTP-Response-Code-Kategorien.
- Route-Tests in `packages/frontend/app/routes/api.jobs.test.ts` für Single- und Batch-Polling, Auth-/Scope-Fehler, Ownership, Batch-Limit, Unknown/Expired und Redaktionsgrenzen.
- OpenAPI-Test prüfen und `packages/backend/openapi.json` nach Registry-Änderung regenerieren.
- Dokumentationsabgleich in `LLMs.txt`: Beispiele müssen mit den Response-Schemas übereinstimmen.
- Abschließend `pnpm agent:check`.

## Annahmen und offene Punkte

- Annahme: Batch-Polling soll umgesetzt werden, weil der Issue es ausdrücklich als sinnvolle optionale Ergänzung beschreibt und die spätere Client-Komplexität dadurch sinkt.
- Annahme: Die vorhandenen Retention-Felder reichen als Queryability-Vertrag; es wird kein neues Tombstone- oder Delivery-Archive eingeführt.
- Annahme: Neue Endpunkte sind besser als ein Breaking Change an `GET /api/v1/jobs/:jobId`.
- Annahme: Wenn die Umsetzung ohne neue Persistenz nicht belastbar zwischen „nie existiert“ und „per Retention gelöscht“ unterscheiden kann, dokumentiert die API diese Grenze und nutzt eine zusammengeführte Kategorie wie `expired_or_unknown`.

## Plan-Review

**Ergebnis:** Freigegeben

### Zusammenfassung

| Bereich     | Kritisch | Wichtig | Hinweis |
| ----------- | -------: | ------: | ------: |
| Architektur |        0 |       0 |       0 |
| Security    |        0 |       0 |       1 |
| Datenschutz |        0 |       0 |       0 |
| Fehlerfälle |        0 |       0 |       1 |
| Testbarkeit |        0 |       0 |       0 |
| Scope       |        0 |       0 |       0 |
| Wartbarkeit |        0 |       0 |       0 |

### Befunde

- Hinweis, Security: Die Umsetzung muss bewusst entscheiden, ob Single-Lookups für fremde, aber existierende Jobs `403` liefern oder zur Vermeidung von Enumeration ebenfalls als `unknown` erscheinen. Der Plan dokumentiert diese Entscheidung als Edge Case und Akzeptanzkriterium.
- Hinweis, Fehlerfälle: `expired` ist ohne Tombstone eventuell nicht sicher von „nie existiert“ unterscheidbar. Der Plan begrenzt den Scope bewusst auf Dokumentation dieser Grenze statt neuer Langzeitpersistenz.

## Offene Punkte

- Keine offenen Punkte.

## Implementierungsdetails (umgesetzt)

- Neue Delivery-Status-Schemas und Typen in `packages/backend/src/types.ts`: clientseitiges Statusmodell, Failure-Kategorien und bounded Batch-Input mit maximal 50 `jobIds`.
- Neue Service-Funktionen in `packages/backend/src/service.ts`: `getJobDeliveryStatus`, `getJobDeliveryStatusForToken`, `listJobDeliveryStatuses` und `listJobDeliveryStatusesForToken`. Das Mapping leitet `queued`, `processing`, `retrying`, `delivered`, `bounced`, `rejected`, `permanently_failed`, `cancelled` und `unknown` aus vorhandenen Jobdaten ab.
- Fremde existierende Jobs bleiben für Token-Caller ein `403`-Ownership-Fehler. Fehlende, gelöschte oder per Retention gepurgte IDs werden als `deliveryStatus: "unknown"` mit `failureCategory: "expired_or_unknown"` gemeldet.
- Neue React-Router-7-Resource-Routes: `GET /api/v1/jobs/:jobId/delivery-status` und `POST /api/v1/jobs/delivery-status`, beide explizit in `packages/frontend/app/routes.ts` registriert.
- OpenAPI-Komponenten und Operationen wurden ergänzt und `packages/backend/openapi.json` regeneriert; die Operationenzahl steigt von 25 auf 27.
- `LLMs.txt` dokumentiert Statusmodell, Terminal-Definition, Retention-Grenzen, Unknown-/Expired-Verhalten, Single-/Batch-Polling, Idempotenz und Beispielantworten. `README.md` nennt die neuen `readStatus`-Polling-Endpunkte.

## Testergebnisse

- `pnpm --filter @relanto/backend exec vitest run src/service.test.mjs src/openapi/openapi.test.ts`: grün, 51 Tests.
- `pnpm --filter @relanto/frontend exec vitest run app/routes/api.jobs.test.ts`: grün, 5 Tests.
- `pnpm agent:check`: grün. Enthalten: Lint und Format-Check, Typecheck, React-Router-Build, Backend 155 Tests und Frontend 204 Tests. Bestehende Lint-/Build-Warnungen bleiben ohne Fehlerstatus.

## Review-Findings

**Datum:** 2026-07-08
**Reviewer:** nodejs-reviewer

Keine Findings gefunden.
