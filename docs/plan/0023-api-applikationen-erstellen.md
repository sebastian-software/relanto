# 0023: API-Endpunkt zum Erstellen und Listen von Applikationen

**Planungsstatus:** Umgesetzt

## Anforderung

Anwendungsverantwortliche (applicationAdmin-Tokens mit `manageApplications`-Scope) sollen über die API neue Applikationen erstellen und ihre eigenen Applikationen auflisten können. Bisher war dies nur über das Dashboard durch System-Admins möglich.

## Architekturentscheidungen

- Die Backend-Funktionen `createApplication()` und `listApplications()` existierten bereits — es wurde nur eine neue API-Route hinzugefügt.
- applicationAdmin-Tokens sehen nur Applikationen unter ihrer eigenen `applicationAdminId` (Tenant-Isolation).
- Application-Tokens werden mit 403 abgewiesen, da sie keine Management-Operationen ausführen dürfen.
- Bei applicationAdmin-Tokens wird die `applicationAdminId` immer aus dem Token extrahiert, nie aus dem Payload — das verhindert Scope-Bypass.
- System-Admins müssen die `applicationAdminId` im Payload angeben und können unter jeder Admin-ID erstellen.

## Betroffene Dateien

| Datei                                                   | Beschreibung                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/frontend/app/routes/api.applications.ts`      | Neue Route: GET (Liste) + POST (Erstellen)                     |
| `packages/frontend/app/routes/api._shared.ts`           | Imports von `createApplication` und `listApplications` ergänzt |
| `packages/frontend/app/routes/api.applications.test.ts` | Unit-Tests für beide Endpunkte                                 |

## Implementierungsdetails

### GET `/api/applications`

- Erfordert `manageApplications`-Scope
- System-Admins: alle Applikationen
- applicationAdmin-Tokens: nur eigene Applikationen
- Application-Tokens: 403

### POST `/api/applications`

- Erfordert `manageApplications`-Scope
- System-Admin-Payload: `{ applicationAdminId: string, label: string }`
- applicationAdmin-Token-Payload: `{ label: string }` (applicationAdminId aus Token)
- Application-Tokens: 403
- Ungültiges JSON: 400

## Testergebnisse

- 8 neue Unit-Tests für Loader und Action
- Alle 112 Tests bestanden (62 Frontend + 50 Backend)
- Lint, Format, TypeCheck: bestanden

## Review-Findings

| Schweregrad | Finding                                         | Status                           |
| ----------- | ----------------------------------------------- | -------------------------------- |
| Mittel      | Zod-Validierungsfehler zentral als 400 erkennen | Offen — betrifft alle API-Routen |
| Niedrig     | JSON-Parse-Fehler als 400 behandeln             | Behoben                          |
| Niedrig     | HTTP-Method-Check im Action-Handler             | Offen — bestehendes Pattern      |
