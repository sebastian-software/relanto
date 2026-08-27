# 0029: Aussagekräftige Zod-Validation-Messages für Operator-Diagnose

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-build (kein dedizierter Plan vorab, abgestimmt in der Konversation zu Plan 0028)
**Empfohlener Workflow:** Feature (`/sf-build`)

## Anforderung

Im Anschluss an Plan 0028 hatte das neue Admin-Panel „API-Fehler" gezeigt, dass die `reasonMessage` für Zod-Validation-Fehler regelmäßig nur „Invalid input" lautet, weil die Schemas in `packages/backend/src/types.ts` ausschließlich Default-Constraints (`.min(1)`, `.int()`, …) ohne erläuternde Message verwenden. Der Bezug zum konkret fehlerhaften Feld steht zwar in `details.issuePaths`, doch die Spalte „Meldung" im Panel und die `reasonMessage`-Zeile im stdout-Log bleiben nichtssagend.

Beispiel aus dem realen Log: `POST /api/v1/send` mit fehlendem `messageId`:

```
[api-failure] {"method":"POST","path":"/api/v1/send","reason":"validation","reasonMessage":"Invalid input","status":400,"details":{"issuePaths":["messageId"]}}
```

Ziel: Jede Zod-Constraint in den öffentlichen API-Schemas liefert eine selbsterklärende Message, die das Feld benennt. Damit zeigt das Panel sofort „messageId is required" statt „Invalid input".

## Architekturentscheidungen

- **Inline-Helpers im Schema-Modul** statt eigener Zod-Erweiterung. Drei kleine, datei-lokale Funktionen (`requiredString`, `optionalString`, `retentionDaysField`, `timeoutMsField`) kapseln das wiederholte Pattern und nehmen den Feldnamen als Argument. Vorteil: Konsistente Messages ohne globale Zod-Konfiguration und ohne Auswirkungen auf Drittpakete.
- **Englische Messages**, konsistent mit dem restlichen Code-/Identifier-Stil im Repo. Die Übersetzung ins Deutsche übernimmt die UI über bestehende i18n-Strings für die Reason-Kategorien; die rohe `reasonMessage` bleibt sprachunabhängig stabil und ist primär für Betreiber/Logs gedacht.
- **Feldname als Wortlaut**, nicht ein menschlich übersetzter Label-Text. Begründung: Die JSON-Feldnamen sind die stabile Vertragsschnittstelle; Operatoren und Integratoren sehen exakt das Feld, das ihre Payload betrifft. Lokalisierung passiert separat im Panel.
- **Keine Änderung der Validierungs-Regeln**, nur der Texte. Die Schemas akzeptieren/lehnen exakt dieselben Payloads ab wie vorher.
- **Modul-lokale Konstanten für wiederholte Texte** (`SCOPES_ARRAY_MESSAGE`, `SCOPES_MIN_MESSAGE`) erfüllen die `sonarjs/no-duplicate-string`-Regel ohne erzwungene Helper-Funktion.

## Betroffene Dateien

| Datei                           | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/types.ts` | Vier Helper (`requiredString`, `optionalString`, `retentionDaysField`, `timeoutMsField`) ergänzt. Sämtliche Pflichtfelder in `attachmentSchema`, `createApplicationAdminInputSchema`, `createApplicationInputSchema`, `upsertSmtpConfigInputSchema`, `createApplicationAdminTokenInputSchema`, `createApplicationTokenInputSchema`, `updateTokenScopesInputSchema`, `issueClientAccessTokenInputSchema`, `listApiFailuresFilterSchema`, `sendMailInputSchema` auf die Helper umgestellt. Ein modul-lokales `scopesField` und zwei String-Konstanten für die Scopes-Validierungen vermeiden Duplikate. |

## Implementierungsdetails

Helper-Signaturen (gekürzt):

```ts
function requiredString(field: string) {
  return z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`);
}

function retentionDaysField(field: string) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(1, `${field} must be at least 1`)
    .max(365, `${field} must be at most 365`)
    .default(30);
}
```

`requiredString` setzt die Message sowohl auf den Type-Fehler (`{ error: ... }`) als auch auf `.min(1)`, weil Zod 4 je nach Constraint einen anderen Pfad nimmt:

- fehlendes Feld → Type-Fehler („expected string, received undefined")
- leerer String nach `trim()` → `.min(1)`-Fehler

Beide Pfade liefern jetzt `"<field> is required"`.

Für die SMTP-Konfiguration sind die numerischen Constraints (Timeouts, Port, Retention) ebenfalls mit Feldname versehen, sodass im Formular-Backend-Fluss bekannte Fehler wie „connectionTimeoutMs must be at least 100 ms" sichtbar werden.

### Auswirkung auf das Server-Log und das Admin-Panel

Reale Log-Zeile vor der Änderung:

```
[api-failure] {... "reasonMessage":"Invalid input", "details":{"issuePaths":["messageId"]}}
```

nach der Änderung:

```
[api-failure] {... "reasonMessage":"messageId is required", "details":{"issuePaths":["messageId"]}}
```

Das Admin-Panel zeigt damit ohne Aufklappen der `details`-Spalte sofort den Fehlergrund.

## Akzeptanzkriterien

- [x] Sämtliche `.min(1)`-Constraints in den öffentlichen API-Schemas tragen eine feldnamen-spezifische Message.
- [x] Numerische Constraints (`int`, `min`, `max`) tragen ebenfalls feldnamen-spezifische Messages, mindestens für SMTP-Timeouts, Port und Retention.
- [x] `[api-failure].reasonMessage` für eine fehlende `messageId` lautet `"messageId is required"` statt `"Invalid input"`.
- [x] Validierungs-Verhalten unverändert: keine zusätzlichen abgelehnten Payloads, keine neuen Erfolgsfälle.
- [x] `pnpm agent:check` ist grün.

## Validierungsplan

- `pnpm agent:check` durchläuft alle vier Phasen (Lint, Format, Typecheck, Tests) ohne Fehler.
- Backend-Regression: 70 Tests bleiben grün; die bestehenden Domain-Error-Texte werden nicht von Zod-Messages überlagert.
- Frontend-Regression: 77 Tests bleiben grün. Tests zu `api.send.ts`, `api.token.ts` und `dashboard.api-failures.tsx` prüfen `issuePaths`, nicht den exakten Messagetext, und sind dadurch unverändert tragfähig.
- Manueller Verifikationspfad: dieselben drei Beispiele aus Plan 0028 (`POST /api/v1/token` mit falschem Secret, `GET /api/v1/config` ohne Scope, `POST /api/v1/send` ohne `text`) — die `[api-failure]`-Zeilen sollen jetzt sprechende `reasonMessage`-Texte enthalten.

## Annahmen und offene Punkte

- Annahme: API-Clients verlassen sich nicht auf den exakten Wortlaut „Invalid input". Wer die HTTP-Antwort parsen will, sollte ohnehin `issues[].path` und `issues[].message` einzeln auswerten; der erste `issues[0].message` ist jetzt aussagekräftiger.
- Annahme: Eine Lokalisierung der Validation-Messages erfolgt im Frontend (Admin-Panel) über bekannte Reason-Kategorien und Feldnamen. Eine vollständige i18n der Roh-Messages ist out-of-scope.
- Offen: Felder im Adminformular der Dashboard-Route (`packages/frontend/app/routes/dashboard.tsx`) haben eigene Client-Validierungen mit eigenen Übersetzungen; diese sind nicht betroffen.

## Testergebnisse

- `pnpm agent:check` grün (Lint, Format, Typecheck, Tests).
- Backend: 70 Tests bestanden.
- Frontend: 77 Tests bestanden.

## Review-Findings

**Datum:** 2026-06-05
**Reviewer:** keiner

Kein externer Review-Lauf durchgeführt. Begründung: rein lokal begrenzte Schema-Erweiterung in einer Datei ohne Verhaltensänderung; `pnpm agent:check` ist der maßgebliche Qualitäts-Check für diesen Scope.
