# 0022: SMTP-Konfiguration sperren und entsperren

**Planungsstatus:** Umgesetzt

## Anforderung

SMTP-Konfigurationen koennen ueber die Dashboard-UI gesperrt und entsperrt werden. Eine gesperrte SMTP-Konfiguration blockiert:

- Aenderungen an den Config-Feldern (Update)
- Erstellung neuer Application-Tokens fuer die betroffene Anwendung

Die API gibt bei gesperrten Configs eine klare JSON-Fehlermeldung mit HTTP 423 zurueck.

## Architekturentscheidungen

- Neues `locked_at` Feld auf `smtp_configs` (getrennt von `disabled_at`, das den Mail-Versand steuert)
- Lock/Unlock nur durch System-Admins im Dashboard (keine API-Endpunkte fuer Token-basierte Clients)
- Bestehende Tokens und deren Operationen (Scope-Update, Rotate, Revoke, Delete) sind nicht betroffen
- Bereits ausgegebene JWTs funktionieren weiter
- Idempotente Migration via `hasColumn`-Pattern

## Betroffene Dateien

| Datei                                         | Beschreibung                                                          |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `packages/backend/src/db.ts`                  | Migration: `locked_at` Spalte auf `smtp_configs`                      |
| `packages/backend/src/types.ts`               | `SmtpConfig` Typ um `lockedAt?: string` erweitert                     |
| `packages/backend/src/service.ts`             | `lockSmtpConfig()`, `unlockSmtpConfig()`, Guards, Mapping             |
| `packages/backend/src/index.ts`               | Exports                                                               |
| `packages/frontend/app/routes/api._shared.ts` | Fehlermeldung `"SMTP config is locked"` → 423, `mailerApi` Eintraege  |
| `packages/frontend/app/routes/dashboard.tsx`  | Lock/Unlock Intents, Button, gesperrte Config-Anzeige, disabled Forms |

## Implementierungsdetails

### Backend

- `lockSmtpConfig(actorId, actorType, configId)`: Setzt `locked_at` und `updated_at`, Audit-Log `smtp_config.locked`
- `unlockSmtpConfig(actorId, actorType, configId)`: Loescht `locked_at`, setzt `updated_at`, Audit-Log `smtp_config.unlocked`
- Guard in `upsertSmtpConfig` (Update-Pfad): Prueft `existing.locked_at`, wirft `"SMTP config is locked"`
- Guard in `createApplicationToken`: Laedt Config via `getApplicationConfigByApplicationId`, prueft `locked_at`
- `mapSmtpConfigView`: Mappt `locked_at` auf `lockedAt`
- Alle SELECT-Queries fuer `smtp_configs` selektieren `locked_at`

### Dashboard

- Lock/Unlock-Button auf der Config-Card (nur sichtbar wenn Config existiert)
- Gesperrte Config: ConfigForm wird ausgeblendet, TokenForm wird disabled
- Status-Anzeige: "SMTP configuration (locked)" in der Zusammenfassung
- Lock-Zeitpunkt wird angezeigt

## Testergebnisse

- 104 Tests bestanden (50 Backend, 54 Frontend)
- Lint, Format, TypeCheck: alle bestanden
