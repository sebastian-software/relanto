# 0027: SMTP-Konfiguration per Anwendungstoken lesen

**Planungsstatus:** Umgesetzt
**Quelle:** $sf-plan
**Empfohlener Workflow:** Feature (`$sf-build`)

## Anforderung

Ein Anwendungstoken soll per API die aktuelle SMTP-Konfiguration seiner Anwendung lesen können, ohne Secrets zurückzugeben. Dafür wird das Token-Scope-Modell um einen dedizierten Lesescope erweitert.

Die Umsetzung ist ein Feature, weil ein neuer API-Endpunkt, ein neues Scope-Recht und sichtbares Token-Verhalten hinzukommen.

Verifizierter Code-Kontext:

- API-Routen liegen unter `packages/frontend/app/routes/` und müssen zusätzlich in `packages/frontend/app/routes.ts` registriert werden.
- `packages/backend/src/types.ts` definiert `tokenScopeSchema`; Anwendungstokens dürfen aktuell keine Management-Scopes enthalten.
- `packages/backend/src/service.ts` authentifiziert Anwendungstokens mit aktueller `configId` und bietet `getSmtpConfig(configId)` als `SmtpConfigView` ohne Passwortfeld an.
- `SmtpConfigView` enthält `username` und `hasPassword`, aber kein `password` oder `passwordEncrypted`.
- Bestehende Config-Leseendpunkte verwenden derzeit `manageApplications` und sind dadurch für reine Anwendungstokens fachlich zu breit.

## Architekturentscheidungen

- Neuer Scope `readConfig` für das Lesen der eigenen SMTP-Konfiguration. `manageApplications` bleibt für administrative Config-Verwaltung reserviert.
- Neuer Endpunkt `GET /api/v1/config`, weil der Endpunkt die aus dem Anwendungstoken abgeleitete aktuelle Konfiguration liefert und keinen frei wählbaren `configId`-Parameter akzeptiert.
- Der Endpunkt akzeptiert ausschließlich Anwendungstokens mit `readConfig`; Application-Admin-Tokens und System-Admin-Sessions werden abgewiesen, weil sie keine „aktuelle Anwendung“ besitzen.
- Die Response verwendet eine aus `SmtpConfigView` abgeleitete Public-Form: `username` sowie alle Passwort-/Secret-Felder werden entfernt, alle übrigen Konfigurationsfelder bleiben erhalten. `hasPassword` darf bleiben, da es nur den Konfigurationsstatus signalisiert.
- Die Route wird dünn gehalten: Authentifizierung, Token-Kind-Prüfung und Delegation an `mailerApi.getSmtpConfig(auth.token.configId)`.

## Betroffene Dateien

| Datei                                                       | Beschreibung                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/backend/src/types.ts`                             | `tokenScopeSchema` um `readConfig` erweitern; optionalen Public-Response-Typ ohne `username` und ohne Passwort-/Secret-Felder ergänzen, falls die Umsetzung die Form zentral typisieren soll.                                              |
| `packages/backend/src/service.ts`                           | Scope-Validierung erweitern: `readConfig` muss für Anwendungstokens erlaubt und für Application-Admin-Tokens abgewiesen werden. Optional Helper für die Public-Config-View ergänzen, falls die Redaction nicht in der Route erfolgen soll. |
| `packages/frontend/app/lib/server/auth.server.ts`           | Keine fachliche Änderung erwartet; der neue Scope fließt über `TokenScope` in `requireApiAccess`.                                                                                                                                          |
| `packages/frontend/app/routes/api._shared.ts`               | Scope-Union von `requireAdminOrScope` um `readConfig` erweitern, falls die lokale Signatur nicht automatisch aus `TokenScope` abgeleitet wird.                                                                                             |
| `packages/frontend/app/routes/api.config.ts`                | Neue Loader-Route für `GET /api/v1/config`.                                                                                                                                                                                                |
| `packages/frontend/app/routes.ts`                           | Route `api/v1/config` registrieren.                                                                                                                                                                                                        |
| `packages/frontend/app/routes/api.scope-matrix.test.ts`     | Scope- und Ownership-Verhalten des neuen Endpunkts abdecken.                                                                                                                                                                               |
| `packages/frontend/app/routes/dashboard.tsx`                | Anwendungstoken-Formular und Token-Scope-Editor um `readConfig` erweitern.                                                                                                                                                                 |
| `packages/frontend/app/routes/dashboard-form-state.test.ts` | Falls Scope-Auswahl oder Default-Scopes betroffen sind, Formularzustände aktualisieren.                                                                                                                                                    |
| `packages/frontend/app/routes/dashboard.test.tsx`           | Sichtbarkeit bzw. Auswahl des neuen Anwendungstoken-Scopes prüfen, falls bestehende Tests konkrete Scope-Listen erwarten.                                                                                                                  |
| `packages/frontend/app/locales/en.ts`                       | Englische Übersetzung für das neue Scope-Label ergänzen, falls der String extrahiert oder manuell gepflegt wird.                                                                                                                           |

## Implementierungsdetails

### Vorgehen

1. In `packages/backend/src/types.ts` den Scope `readConfig` ergänzen.
2. Die Scope-Validierungen in `packages/backend/src/service.ts` so erweitern, dass Anwendungstokens `readConfig` erhalten dürfen, Management-Scopes weiterhin verboten bleiben und Application-Admin-Tokens kein `readConfig` erhalten.
3. In `packages/frontend/app/routes/api._shared.ts` den erlaubten Scope-Parameter für `requireAdminOrScope` um `readConfig` erweitern oder auf den importierten `TokenScope` vereinheitlichen.
4. Neue Route `packages/frontend/app/routes/api.config.ts` mit Loader anlegen:
   - Methode faktisch nur `GET` über den Loader.
   - Auth über `requireAdminOrScope(request, "readConfig")`.
   - Wenn `auth.kind !== "token"` oder `auth.token.kind !== "application"`, 403 zurückgeben.
   - Config über `auth.token.configId` lesen.
   - `username` sowie alle Passwort-/Secret-Felder vor der Response entfernen und als `{ ok: true, config }` zurückgeben.
5. `packages/frontend/app/routes.ts` um `route("api/v1/config", "routes/api.config.ts")` erweitern.
6. Dashboard-Scope-Listen für Anwendungstokens um `readConfig` erweitern. Der Default kann konservativ bleiben, wenn bestehende Token nicht automatisch mehr Rechte erhalten sollen; alternativ kann `readConfig` bei neuen Anwendungstokens standardmäßig aktiviert werden, wenn das Produkt API-Selbstdiagnose als Basisfähigkeit betrachtet.
7. Tests für die neue Route, die Scope-Matrix und betroffene Dashboard-Listen ergänzen.

### API-Anbindung

Geplante Response-Form:

- `ok: true`
- `config`: Public-SMTP-Config-View mit allen bestehenden Feldern aus `SmtpConfigView` außer `username` und Passwort-/Secret-Feldern. Enthalten sind insbesondere `id`, `applicationId`, `applicationAdminId`, `applicationLabel`, `name`, `host`, `port`, TLS-/Timeout-Felder, `defaultFromAddress`, `disabledAt`, `lockedAt`, `hasPassword`, `createdAt` und `updatedAt`.

Nicht enthalten:

- `password`
- `passwordEncrypted`
- `username`
- Client-Secret oder Token-Secret
- SMTP-Passwort-Hash oder verschlüsselter Secret-Wert

### Edge Cases

- Token ohne `readConfig` erhält 401 über die bestehende Scope-Prüfung.
- Application-Admin-Token erhält 403, weil es keine aktuelle Anwendungskonfiguration gibt; `readConfig` soll für Application-Admin-Tokens gar nicht ausgestellt werden.
- System-Admin-Session erhält 403, weil der Endpunkt tokenzentriert ist und kein Config-Parameter akzeptiert.
- Entfernte oder fehlende SMTP-Konfiguration führt über bestehende Domain-Fehler auf eine JSON-Fehlerantwort, voraussichtlich 404.
- Bereits ausgestellte Access-Tokens erhalten den neuen Scope nicht rückwirkend; Client-Credentials müssen nach Scope-Erweiterung erneut ein Access-Token holen.

## Akzeptanzkriterien

- [x] `readConfig` ist ein gültiger Token-Scope und kann Anwendungstokens zugewiesen werden.
- [x] `GET /api/v1/config` ist in `routes.ts` registriert und liefert für ein Anwendungstoken mit `readConfig` die eigene aktuelle SMTP-Konfiguration.
- [x] Die Response enthält kein Passwort, kein verschlüsseltes Passwort, keinen Benutzernamen und keine Token-Secrets.
- [x] Die Response enthält alle übrigen SMTP-Konfigurationsfelder der bestehenden `SmtpConfigView`.
- [x] Ein Anwendungstoken ohne `readConfig` kann den Endpunkt nicht erfolgreich aufrufen.
- [x] Ein Anwendungstoken kann keine fremde SMTP-Konfiguration über diesen Endpunkt lesen.
- [x] Application-Admin-Tokens und System-Admin-Sessions erhalten für diesen tokenzentrierten Endpunkt 403.
- [x] Bestehende Endpunkte für administrative SMTP-Konfigurationen behalten ihre bisherigen Scope-Anforderungen.
- [x] Die Dashboard-UI kann `readConfig` für Anwendungstokens vergeben und nachträglich bearbeiten.

## Validierungsplan

- Unit-Test für die neue Route: erfolgreicher Anwendungstoken-Zugriff mit `readConfig`, Response ohne `username` und ohne Secret-Felder, aber mit allen übrigen Konfigurationsfeldern.
- Unit-Test für die neue Route: fehlender Scope, Application-Admin-Token und System-Admin-Session werden abgewiesen.
- Scope-Matrix-Test für `GET /api/v1/config` ergänzen.
- Backend-Service-Tests oder bestehende Token-Scope-Tests erweitern, damit `readConfig` bei Anwendungstokens erlaubt ist, für Application-Admin-Tokens abgewiesen wird und Management-Scope-Verbote unverändert greifen.
- Dashboard-Tests aktualisieren, falls die erlaubten Anwendungstoken-Scopes oder Default-Auswahl geprüft werden.
- Abschlussprüfung mit `pnpm agent:check`.

## Testergebnisse

- `pnpm --filter @relanto/frontend test -- api.config.test.ts api.scope-matrix.test.ts`: 14 Testdateien, 66 Tests bestanden.
- `pnpm --filter @relanto/backend test -- regression-suite.test.mjs`: 6 Testdateien, 65 Tests bestanden.
- `pnpm agent:check`: Lint, Formatcheck, Typecheck und alle Tests bestanden.

## Review-Findings

**Datum:** 2026-06-01
**Reviewer:** keiner (manuelle Abschlussprüfung im `$sf-build`-Workflow)

Keine Findings gefunden.

## Annahmen und offene Punkte

- Annahme: Der neue Scope heißt `readConfig`, weil bestehende Scopes handlungsbezogen benannt sind und `readStatus` bereits für Job-Status reserviert ist.
- Festlegung: `username` wird für diesen Endpunkt nicht zurückgegeben. `host`, Port, TLS-Einstellungen, `defaultFromAddress`, `hasPassword` und die übrigen Metadaten werden zurückgegeben.
- Annahme: Der Endpunkt soll keine Config-ID akzeptieren, damit Anwendungstokens keine fremde Config adressieren können.
- Offener Produktpunkt: Ob `readConfig` bei neu erstellten Anwendungstokens standardmäßig vorselektiert werden soll. Der sicherere Default ist keine automatische Rechteausweitung.

## Plan-Review

**Ergebnis:** Freigegeben

### Zusammenfassung

| Bereich     | Kritisch | Wichtig | Hinweis |
| ----------- | -------: | ------: | ------: |
| Architektur |        0 |       0 |       0 |
| Security    |        0 |       0 |       0 |
| Datenschutz |        0 |       0 |       0 |
| Fehlerfälle |        0 |       0 |       0 |
| Testbarkeit |        0 |       0 |       0 |
| Scope       |        0 |       0 |       0 |
| Wartbarkeit |        0 |       0 |       0 |

### Befunde

- Keine Befunde.
