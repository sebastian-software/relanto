# 0030: LLMs.txt zur vollständigen Endpoint-Referenz ausbauen

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-docs (kein dedizierter Plan vorab, abgestimmt in der Konversation zu Plan 0029)
**Empfohlener Workflow:** Dokumentation (`/sf-docs`)

## Anforderung

Im Anschluss an Plan 0029 fiel auf, dass `LLMs.txt` zwar die `/api/v1/*`-Endpunkte auflistet, aber für die meisten Endpunkte weder Request-Body-Felder, Query-Parameter, Response-Shapes noch Pflicht-/Optional-Regeln dokumentiert. Konkretes Beispiel: `messageId` ist im Send-Schema Pflicht, taucht aber in `LLMs.txt` nirgends auf. Ein LLM, das die Datei als Vertragsbeschreibung liest, hat keine zuverlässige Grundlage, um eine korrekte Send-Anfrage zu bauen.

Ziel: `LLMs.txt` deckt jeden `/api/v1/*`-Endpoint kanonisch ab. Pro Endpoint stehen Methode, Scope, Pfad-/Query-Parameter, Request-Body-Felder (Pflicht/Optional/Defaults/Limits/Bedeutung), Response-Shape, Verhaltenshinweise und gängige Fehlercodes. Beispiele in JSON sind für die schwergewichtigen Endpunkte vollständig.

## Architekturentscheidungen

- **Eine Datei für die LLM-Referenz**: `LLMs.txt` bleibt die einzige LLM-spezifische Referenz. Kein zusätzliches `docs/api/*.md`-Schema. Vorteil: ein einzelner stabiler Pfad für LLM-Crawler, kein Mehrfach-Pflegeaufwand.
- **Bullet-Liste mit Inline-Bedeutung statt Tabellen**: Pro Feld eine Zeile mit Name, Pflichtigkeit, Typ, Defaults/Limits, Bedeutung. Markdown-Tabellen wären für LLMs zwar parsbar, aber im Wartungsfall fehleranfälliger und schwerer zu lesen.
- **Englische Doku, konsistent mit dem bestehenden `LLMs.txt`-Stil und mit den Schema-Messages aus Plan 0029.** Eine deutsche LLMs-Variante ist out-of-scope.
- **Quelle der Wahrheit ist `packages/backend/src/types.ts`** für Pflicht/Optional/Defaults und das jeweilige Route-Modul (`packages/frontend/app/routes/api.*.ts`) für Scope-Erwartung, 403-Sonderfälle und Response-Wrapping. Jeder dokumentierte Feldwert wurde gegen den Code querverifiziert.
- **Schreibweise „secrets only returned once"** als wiederkehrender Hinweis pro Token-Endpoint, plus globaler Konventionsabschnitt am Datei-Anfang.
- **Field-Reference inline pro Endpoint**, nicht in einem getrennten Glossar. Begründung: LLMs lesen die Datei oft in Chunks; lokale Vollständigkeit pro Endpoint hilft mehr als ein zentrales Glossar.

## Betroffene Dateien

| Datei                                                        | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLMs.txt`                                                   | Komplett überarbeitet. Neuer Konventionsabschnitt am Anfang. Pro `/api/v1/*`-Endpoint eigene Sektion mit Methode, Scope, Pfad-/Query-Parametern, Request-Body-Feldern, JSON-Beispielen, Response-Shape, Verhaltenshinweisen und Fehlercodes. Globale Abschnitte für Job-Status-Werte, Idempotency, Payload-Limits und Error-Handling ausgebaut. Korrektur: Admin-seitige Config-Reads zeigen `username`, nur `GET /api/v1/config` filtert ihn. |
| `docs/plan/0030-llms-txt-vollstaendige-endpoint-referenz.md` | Diese Plan-Datei.                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Implementierungsdetails

### Strukturschema pro Endpoint

Jeder Endpoint-Abschnitt folgt dem gleichen Aufbau:

1. Heading `## Endpoint: <Titel>`
2. HTTP-Methode und Pfad als Liste
3. „Expected token scope" inklusive Restriktionen für Admin- vs Application-Tokens
4. „Path parameter(s)" mit Name, Typ und Bedeutung
5. „Query parameters" (sofern relevant)
6. „Request body fields" mit Pflichtigkeit, Typ, Defaults, Limits und Bedeutung pro Feld
7. „Request example" als JSON-Codeblock
8. „Response on success (HTTP `<code>`)" als JSON-Codeblock
9. „Important behavior" mit relevanten Verhaltenshinweisen
10. „Errors" mit konkreten Statuscodes und Fehlermeldungen

### Dokumentierte Endpunkte

22 Endpunkte unter `/api/v1/*`:

- `POST /api/v1/token`
- `POST /api/v1/send`
- `GET /api/v1/config`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`
- `DELETE /api/v1/jobs/:jobId`
- `POST /api/v1/jobs/:jobId/pause`
- `POST /api/v1/jobs/:jobId/resume`
- `POST /api/v1/jobs/:jobId/retry`
- `GET /api/v1/applications`
- `POST /api/v1/applications`
- `GET /api/v1/configs`
- `POST /api/v1/configs`
- `GET /api/v1/configs/:configId`
- `PUT /api/v1/configs/:configId`
- `POST /api/v1/configs/:configId/validate`
- `GET /api/v1/configs/:configId/tokens`
- `POST /api/v1/configs/:configId/tokens`
- `GET /api/v1/tokens/:tokenId`
- `DELETE /api/v1/tokens/:tokenId`
- `POST /api/v1/tokens/:tokenId/rotate`
- `POST /api/v1/tokens/:tokenId/revoke`
- `PUT /api/v1/tokens/:tokenId/scopes`

Bewusst out-of-scope: `GET /health` und `GET /metrics` sind Monitoring-Endpunkte ohne API-Integrations-Bezug; die Admin-Subroute `/api-failures` ist eine HTML-Route der Adminkonsole.

### Geprüfte Quellen

- `packages/backend/src/types.ts` (Zod-Schemas `sendMailInputSchema`, `issueClientAccessTokenInputSchema`, `upsertSmtpConfigInputSchema`, `createApplicationInputSchema`, `createApplicationAdminInputSchema`, `createApplicationTokenInputSchema`, `createApplicationAdminTokenInputSchema`, `updateTokenScopesInputSchema`, `attachmentSchema`).
- `packages/backend/src/service.ts` (Domain-Fehler `Application admin tokens cannot send mail directly`, `Application admin tokens cannot read application SMTP configs directly`, `Application tokens cannot include management scopes`, `Application requires an SMTP config before tokens can be issued`, Retention-Defaults, `LegacyCreateTokenInput.principalId`).
- `packages/frontend/app/routes/api.*.ts` für Scope-Erwartung, 403-Sonderfälle und Response-Wrapper.
- `packages/frontend/app/routes/api._shared.ts` für `DOMAIN_ERROR_STATUS_BY_MESSAGE` (HTTP-Status pro Domain-Fehler).

### Fundstellen-Korrekturen

- `POST /api/v1/configs/:configId/tokens` braucht `principalId` im Request-Body (nicht nur `label`, `scopes`, Retentions). Das geht aus `LegacyCreateTokenInput.principalId` in `service.ts:79` hervor und wurde dokumentiert (Application-ID für Application-Tokens, Application-Admin-ID für Admin-Tokens).
- Admin-seitige Config-Reads (`GET /api/v1/configs`, `GET /api/v1/configs/:configId`) liefern `username`. Nur `GET /api/v1/config` (Application-Token) wendet den Filter `toPublicSmtpConfig` an. Initial fälschlich „kein username" geschrieben, dann korrigiert.

## Akzeptanzkriterien

- [x] Jeder `/api/v1/*`-Endpoint hat in `LLMs.txt` Methode, Scope, Pfad-/Query-Parameter, Request-Body, Response-Shape, Verhaltenshinweise und Fehlercodes.
- [x] Pflichtfelder wie `messageId`, `to`, `subject`, `html`, `text`, `clientId`, `clientSecret`, `principalId` sind explizit benannt.
- [x] Optionale Felder zeigen ihren Default (`deliveryMode: "queued"`, Retention `30`, Timeouts `10000`/`20000`, `requireTls: true`, …).
- [x] Limits aus dem Send-Schema bleiben dokumentiert (`200000` HTML, `100000` Text, `10` Attachments, `5 MiB` einzeln, `20 MiB` gesamt).
- [x] „Secret only returned once"-Regel ist sowohl im Konventionsabschnitt als auch pro Token-Endpoint sichtbar.
- [x] `pnpm agent:check` ist grün.

## Validierungsplan

- Manuelle Querprüfung pro Feld gegen `packages/backend/src/types.ts` und das jeweilige Route-Modul.
- `pnpm agent:check` als Smoketest gegen Lint/Format/Typecheck/Tests, weil die Dokumentation parallel zu noch unveränderten Code-Pfaden gepflegt wird.

## Annahmen und offene Punkte

- Annahme: `to` darf weiterhin nicht-validiert als beliebige nichtleere Zeichenkette akzeptiert werden (nodemailer toleriert sowohl Einzeladressen als auch Komma-Listen). Diese Konvention bleibt erhalten; eine strikte Validierung wäre eigene Plan-Stufe.
- Annahme: `headers` werden ohne Filter durchgereicht; spätere harte Sicherheitsbeschränkungen (z. B. unzulässige Headernamen) sind out-of-scope und nicht versprochen.
- Offen: Eine deutsche Version der API-Referenz wäre denkbar (Admin-UI lokalisiert Reason-Kategorien bereits), ist hier aber nicht enthalten.

## Testergebnisse

- `pnpm agent:check` grün (Lint, Format, Typecheck, Tests).
- Backend: 70 Tests bestanden.
- Frontend: 77 Tests bestanden.

## Review-Findings

**Datum:** 2026-06-05
**Reviewer:** keiner

Kein externer Review-Lauf durchgeführt. Begründung: Doku-Lauf ohne Code-Verhaltensänderung; Quellen wurden während der Umsetzung querverifiziert.

```

```
