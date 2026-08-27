# 0003: Mailer-API und Systemadmin-UI

**Planungsstatus:** Umgesetzt

## Anforderung

Implementierung des in `tmp/initialplan.md` beschriebenen externen Mailer-Services als erster produktiver Schnitt mit SQLite, tokenbasierter API, SMTP-Queueing und einer ausschließlich für `systemAdmin` zugänglichen Admin-Oberfläche.

## Architekturentscheidungen

- Das Repository wird als Fullstack-Mailer umgesetzt: gemeinsame Mailer-Domäne im Workspace-Package `@relanto/backend`, HTTP-API und Admin-UI im React-Router-Frontend.
- Persistenz erfolgt lokal über SQLite; Queue, Jobs, Audit-Log und Token-Metadaten liegen in derselben Datenbank.
- `systemAdmin` authentifiziert sich ausschließlich per Pocket-ID-OIDC und erhält Zugriff nur über die Gruppe `superadmin`.
- `applicationAdmin` und Applikationen authentifizieren sich ausschließlich per Bearer-Token gegen die API.
- Tokens werden nur gehasht gespeichert, SMTP-Passwörter nur verschlüsselt.
- Der erste Schnitt nutzt einen internen Worker-Loop im Node-Prozess statt externer Queue-Infrastruktur.
- Die Admin-UI verwendet Sebastian-Software-Assets aus `@redacted/assets` und bleibt technisch bei React Router plus vanilla-extract-Basis.
- Für die neue Server-/API-Schicht wurden gezielte Lint-Ausnahmen ergänzt, damit die Projektregeln den Fullstack-Schnitt sinnvoll abbilden.

## Betroffene Dateien

| Datei                                                  | Beschreibung                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `packages/backend/package.json`                        | Backend-Package als `@relanto/backend` mit Mailer-Abhängigkeiten und Typecheck-Setup |
| `packages/backend/tsconfig.json`                       | Separater TypeScript-Compile-Pfad für das Backend                                    |
| `packages/backend/src/db.ts`                           | SQLite-Verbindung und Schema-Erzeugung                                               |
| `packages/backend/src/env.ts`                          | Laufzeitkonfiguration für Datenbank, OIDC und Worker                                 |
| `packages/backend/src/index.ts`                        | Öffentliche Backend-Exports                                                          |
| `packages/backend/src/security.ts`                     | Secret-Verschlüsselung, Token-Hashing und Sanitizing                                 |
| `packages/backend/src/service.ts`                      | Fachlogik für Principals, SMTP-Konfigurationen, Tokens, Jobs und Versand             |
| `packages/backend/src/types.ts`                        | Zod-Schemas und Domänentypen                                                         |
| `packages/backend/src/worker.ts`                       | Persistenter Job-Worker mit Polling-Loop                                             |
| `packages/frontend/package.json`                       | Frontend an Backend-Workspace und OIDC-Client angebunden                             |
| `packages/frontend/app/lib/server/bootstrap.server.ts` | Startet den Mailer-Worker genau einmal im Frontend-Serverprozess                     |
| `packages/frontend/app/lib/server/session.server.ts`   | Cookie-Session für `systemAdmin`                                                     |
| `packages/frontend/app/lib/server/oidc.server.ts`      | Pocket-ID-OIDC-Login und Callback-Verarbeitung                                       |
| `packages/frontend/app/lib/server/auth.server.ts`      | Session- und Token-Authentifizierung für UI und API                                  |
| `packages/frontend/app/routes.ts`                      | Neue Admin- und API-Routen registriert                                               |
| `packages/frontend/app/root.tsx`                       | Globaler Einstieg mit Runtime-Bootstrap und Systemadmin-Header                       |
| `packages/frontend/app/routes/login.tsx`               | Pocket-ID-Loginseite                                                                 |
| `packages/frontend/app/routes/auth.callback.tsx`       | OIDC-Callback und Session-Aufbau                                                     |
| `packages/frontend/app/routes/logout.tsx`              | Session-Logout                                                                       |
| `packages/frontend/app/routes/dashboard.tsx`           | Systemadmin-Oberfläche für Principals, SMTP-Konfigurationen, Tokens und Jobs         |
| `packages/frontend/app/routes/api._shared.ts`          | Gemeinsame API-Helfer                                                                |
| `packages/frontend/app/routes/api.*`                   | HTTP-API für Konfigurationen, Tokens, Jobs und Versand                               |
| `packages/frontend/app/styles/theme.css.ts`            | Sebastian-Software-Tokens im Frontend-Theme                                          |
| `packages/frontend/app/root.css.ts`                    | Globale UI-Basis für die neue Admin-Oberfläche                                       |
| `packages/frontend/eslint.config.ts`                   | Zielgerichtete Regelanpassungen für Route-/Server-Code                               |
| `packages/frontend/oxlint.config.ts`                   | Oxlint-Ignore für neue Server- und Route-Dateien                                     |
| `cspell.json`                                          | Fachbegriffe wie `oidc`, `pkce` und `superadmin` ergänzt                             |
| `pnpm-lock.yaml`                                       | Lockfile nach neuen Abhängigkeiten aktualisiert                                      |

## Implementierungsdetails

- Datenmodell:
  - `principals` für `systemAdmin`, `applicationAdmin` und Applikationen
  - `smtp_configs` für SMTP-Zugangsdaten und technische Parameter
  - `access_tokens` für API-Tokens inklusive Scopes, Retention und Zuordnung
  - `mail_jobs`, `job_events` und `audit_logs` für Versand- und Betriebssicht
- API-Funktionalität:
  - SMTP-Konfigurationen anlegen, ändern, lesen und validieren
  - Tokens anlegen, rotieren, widerrufen und löschen
  - Versandaufträge annehmen und Jobs lesen, pausieren, fortsetzen, erneut anstoßen oder löschen
- Worker-Verhalten:
  - Persistente Jobs in SQLite
  - Retry-Entscheidungen und Statuswechsel im Backend-Service
  - Versand über Nodemailer
- UI-Funktionalität:
  - Sign-in über Pocket ID
  - Verwaltung von Principals, SMTP-Konfigurationen, Tokens und Mail-Jobs im Dashboard
  - Branding über Sebastian-Software-Fonts, Tokens und Logo
- Gegenüber dem ursprünglichen Zielbild bewusst noch nicht umgesetzt:
  - Webhooks
  - externer Queue-Broker
  - separate Multi-Service-Aufteilung

## Testergebnisse

- `pnpm install` erfolgreich
- `pnpm agent:check` erfolgreich
- Backend-Lint, Frontend-Lint, Format-Check, Typecheck und Tests laufen durch
- Bekannter Hinweis bleibt bestehen:
  - `vitest` meldet im Frontend `close timed out after 10000ms`, beendet aber mit Exit-Code `0`

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 2 | 2 | 0 |

- Hinweis: Die Frontend-Lint-Konfiguration war für die neue Server-/API-Schicht zu restriktiv.
  - Behebung: Regeln gezielt für `app/lib/server`, `app/routes` und `app/root.tsx` angepasst.
  - Status: behoben
- Hinweis: Das neue Backend-Package hatte zunächst fehlende Typ-Abhängigkeiten für den isolierten `tsc`-Lauf.
  - Behebung: `@types/node` und `@types/nodemailer` ergänzt.
  - Status: behoben
