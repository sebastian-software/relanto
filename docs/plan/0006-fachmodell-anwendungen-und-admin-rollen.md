# 0006: Fachmodell — Anwendungen und Admin-Rollen

**Planungsstatus:** Umgesetzt

## Anforderung

Umbau des bisherigen Principal-/Token-Modells auf ein fachlich präziseres Modell mit:

- `Application Admin` als technischer Verwaltungsrolle
- `Application` als fachlicher Einheit mit genau einer SMTP-Konfiguration
- getrennten Token-Arten für Admin-Rollen und Anwendungen
- `systemAdmin` ausschließlich über OIDC-Session, außerhalb des Fachmodells

## Architekturentscheidungen

- `systemAdmin` bleibt komplett außerhalb der Fachdaten und wird nicht mehr in Mailer-Tabellen geführt.
- Eine `Application` gehört genau einem `Application Admin`.
- Eine `Application` besitzt höchstens eine SMTP-Konfiguration.
- `Application Admin Tokens` und `Application Tokens` werden getrennt persistiert und authentifiziert.
- Bestehende API-Routen bleiben weitgehend erhalten, werden aber intern auf das neue Ownership-Modell gemappt.

## Betroffene Dateien

| Datei                                                                                                                              | Beschreibung                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [packages/backend/src/types.ts](../../packages/backend/src/types.ts)                                                               | Neues Typmodell für Applications, Application Admins und getrennte Tokenarten   |
| [packages/backend/src/db.ts](../../packages/backend/src/db.ts)                                                                     | Neues SQLite-Schema und Migration vom alten Principal-/Access-Token-Modell      |
| [packages/backend/src/service.ts](../../packages/backend/src/service.ts)                                                           | Neue Service- und Ownership-Logik, Token-Auth, Job-Verarbeitung                 |
| [packages/backend/src/index.ts](../../packages/backend/src/index.ts)                                                               | Export-Surface auf das neue Modell umgestellt                                   |
| [packages/frontend/app/lib/server/auth.server.ts](../../packages/frontend/app/lib/server/auth.server.ts)                           | `systemAdmin` nicht mehr über Backend-Principal, sondern rein über OIDC-Session |
| [packages/frontend/app/routes/dashboard.tsx](../../packages/frontend/app/routes/dashboard.tsx)                                     | Dashboard fachlich neu auf Application Admins und Applications aufgebaut        |
| [packages/frontend/app/routes/api.\_shared.ts](../../packages/frontend/app/routes/api._shared.ts)                                  | API-Helfer auf neue Ownership-Checks erweitert                                  |
| [packages/frontend/app/routes/api.configs.ts](../../packages/frontend/app/routes/api.configs.ts)                                   | Config-API auf Admin-Token-/Application-Ownership angepasst                     |
| [packages/frontend/app/routes/api.configs.$configId.ts](../../packages/frontend/app/routes/api.configs.$configId.ts)               | Einzel-Config-API auf Ownership-Regeln angepasst                                |
| [packages/frontend/app/routes/api.configs.$configId.tokens.ts](../../packages/frontend/app/routes/api.configs.$configId.tokens.ts) | Token-Ausstellung pro Config an neue Semantik angepasst                         |
| [packages/frontend/app/routes/api.jobs.ts](../../packages/frontend/app/routes/api.jobs.ts)                                         | Job-Liste auf Token-Ownership gefiltert                                         |
| [packages/frontend/app/routes/api.jobs.$jobId.ts](../../packages/frontend/app/routes/api.jobs.$jobId.ts)                           | Job-Zugriff per Ownership abgesichert                                           |
| [packages/frontend/app/routes/api.jobs.$jobId.pause.ts](../../packages/frontend/app/routes/api.jobs.$jobId.pause.ts)               | Job-Steuerung für Admin-Token geöffnet                                          |
| [packages/frontend/app/routes/api.jobs.$jobId.resume.ts](../../packages/frontend/app/routes/api.jobs.$jobId.resume.ts)             | Job-Steuerung für Admin-Token geöffnet                                          |
| [packages/frontend/app/routes/api.jobs.$jobId.retry.ts](../../packages/frontend/app/routes/api.jobs.$jobId.retry.ts)               | Job-Steuerung für Admin-Token geöffnet                                          |
| [packages/frontend/app/routes/api.tokens.$tokenId.ts](../../packages/frontend/app/routes/api.tokens.$tokenId.ts)                   | Token-Zugriff nach Ownership abgesichert                                        |
| [packages/frontend/app/routes/api.tokens.$tokenId.rotate.ts](../../packages/frontend/app/routes/api.tokens.$tokenId.rotate.ts)     | Token-Rotation nach Ownership abgesichert                                       |
| [packages/frontend/app/routes/api.tokens.$tokenId.revoke.ts](../../packages/frontend/app/routes/api.tokens.$tokenId.revoke.ts)     | Token-Widerruf nach Ownership abgesichert                                       |
| [packages/frontend/app/locales/de.ts](../../packages/frontend/app/locales/de.ts)                                                   | Neue deutsche UI-Texte für das Fachmodell                                       |
| [packages/frontend/app/locales/en.ts](../../packages/frontend/app/locales/en.ts)                                                   | Neue englische UI-Texte für das Fachmodell                                      |

## Implementierungsdetails

- Die Datenbank migriert von `principals`/`access_tokens` auf:
  - `application_admins`
  - `applications`
  - `application_admin_tokens`
  - `application_tokens`
- `smtp_configs` referenziert jetzt eindeutig eine `application`.
- `mail_jobs` referenziert jetzt zusätzlich `application_id` und kennt `token_kind`.
- Das Dashboard zeigt getrennt:
  - Application Admins mit Admin-Tokens und zugewiesenen Anwendungen
  - Applications mit SMTP-Konfiguration und Application-Tokens
- API-Token-Zugriffe prüfen nun Ownership explizit statt nur freie `configId`-Bindungen.

## Validierung

- `pnpm agent:check` erfolgreich
- Bekannter Vitest-Hinweis zum verzögerten Schließen bleibt unverändert, aber ohne Fehlerstatus
