# 0019 Default-Absenderadresse pro SMTP-Konfiguration

**Planungsstatus:** Umgesetzt

## Anforderung

Im Admin-Dashboard soll pro SMTP-Konfiguration eine verpflichtende Default-Absenderadresse gepflegt werden.
Die Send-API soll `from` optional akzeptieren und bei fehlendem Wert auf diese konfigurierte Default-Absenderadresse
zurückfallen. Validiert werden nur allgemeine syntaktische Regeln für E-Mail-Adressen; ob eine konkrete
Absenderadresse auf dem SMTP-Server erlaubt ist, bleibt Aufgabe des SMTP-Servers.

## Architekturentscheidungen

- SMTP-Konfigurationen erhalten ein neues Pflichtfeld `defaultFromAddress` im Backend-Fachmodell.
- Bestehende Datenbanken migrieren das neue Feld über `username`, damit vorhandene Setups ohne manuelle Sofortnacharbeit weiter funktionieren.
- Mail-Jobs speichern weiterhin den effektiven `from`-Wert pro Job in `mail_jobs.from_address`; der Fallback wird vor dem Persistieren aufgelöst.
- Die Testmail aus dem Dashboard verwendet ebenfalls die konfigurierte Default-Absenderadresse.
- Die Dashboard-UI validiert das neue Feld bereits vor dem Persistieren auf allgemeine E-Mail-Syntax.
- Die Integrationsdoku beschreibt `from` jetzt als optional mit Fallback auf die SMTP-Konfiguration.

## Betroffene Dateien

| Datei                                                                                                    | Beschreibung                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [packages/backend/src/types.ts](../../packages/backend/src/types.ts)                                     | SMTP-Config-Modell erweitert, `from` im Send-Payload optional gemacht, E-Mail-Validierung zentralisiert     |
| [packages/backend/src/db.ts](../../packages/backend/src/db.ts)                                           | Schema um `default_from_address` erweitert und Migration für Bestandsdaten ergänzt                          |
| [packages/backend/src/service.ts](../../packages/backend/src/service.ts)                                 | Config-Mapping erweitert, Upsert angepasst, `from`-Fallback im Send-Pfad implementiert, Testmail umgestellt |
| [packages/backend/src/service.test.mjs](../../packages/backend/src/service.test.mjs)                     | Backend-Tests für Default-Absender, Fallback und Validierung ergänzt                                        |
| [packages/backend/src/send-mail-limits.test.mjs](../../packages/backend/src/send-mail-limits.test.mjs)   | Payload-Tests um optionales `from` und invalides `from` ergänzt                                             |
| [packages/backend/src/regression-suite.test.mjs](../../packages/backend/src/regression-suite.test.mjs)   | Fixture-Konfigurationen auf neues Pflichtfeld aktualisiert                                                  |
| [packages/backend/src/worker.test.mjs](../../packages/backend/src/worker.test.mjs)                       | Worker-Fixtures auf neues Pflichtfeld aktualisiert                                                          |
| [packages/frontend/app/routes/dashboard.tsx](../../packages/frontend/app/routes/dashboard.tsx)           | Dashboard-Form um `Default from address` erweitert und feldgenaue Validierung ergänzt                       |
| [packages/frontend/app/routes/dashboard.test.tsx](../../packages/frontend/app/routes/dashboard.test.tsx) | Dashboard-Test für neues Formularfeld ergänzt                                                               |
| [packages/frontend/app/locales/de.ts](../../packages/frontend/app/locales/de.ts)                         | Neue UI-Texte auf Deutsch ergänzt                                                                           |
| [packages/frontend/app/locales/en.ts](../../packages/frontend/app/locales/en.ts)                         | Neue UI-Texte auf Englisch ergänzt                                                                          |
| [LLMs.txt](../../LLMs.txt)                                                                               | API-Integrationsdoku für optionales `from` und Fallback aktualisiert                                        |

## Implementierungsdetails

- `upsertSmtpConfigInputSchema` verlangt jetzt `defaultFromAddress` und validiert E-Mail-Adressen zentral über Zod.
- `sendMailInputSchema` akzeptiert `from` optional; der Enqueue-Pfad liest die SMTP-Konfiguration, löst `from` mit `defaultFromAddress` auf und persistiert weiterhin den konkreten Wert im Job.
- Die Datenbankmigration fügt `default_from_address` hinzu und setzt für bestehende Datensätze `username`, falls noch kein Wert vorhanden ist.
- Das Dashboard rendert das neue Feld direkt im SMTP-Formular mit einer kurzen Kontext-Hilfe für den API-Fallback.
- Die Frontend-Validierung verwendet bewusst nur allgemeine syntaktische Regeln und keine Absender-Policy gegen Username, Domain oder Provider.

## Testergebnisse

- `pnpm agent:check`
- Ergebnis: erfolgreich
- Enthalten: Lint, Format-Check, Typecheck, Backend-Tests, Frontend-Tests

## Review-Findings und deren Behebung

| Schweregrad | Bereich       | Datei                                                                                          | Problem                                                                                                        | Behebung                                                          | Status  |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------- |
| Hinweis     | Frontend      | [packages/frontend/app/routes/dashboard.tsx](../../packages/frontend/app/routes/dashboard.tsx) | Beim manuellen Diff-Review blieb kurz eine doppelte `return`-Sektion in der neuen E-Mail-Hilfsfunktion stehen. | Vor Abschluss entfernt und erneut validiert.                      | Behoben |
| Hinweis     | Backend/Typen | [packages/backend/src/service.ts](../../packages/backend/src/service.ts)                       | Der optionale Zod-Typ von `from` führte trotz Fallback zu Typkonflikten in Persistenzpfaden.                   | Effektiven Input-Typ mit garantiertem `from` explizit modelliert. | Behoben |
