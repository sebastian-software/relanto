# 0021: Token-Scopes nachtraeglich aendern

**Planungsstatus:** Umgesetzt

## Anforderung

Erlaube das nachtraegliche Aendern der Scopes von bestehenden Tokens — sowohl fuer ApplicationAdmin-Tokens als auch fuer Application-Tokens.

## Architekturentscheidungen

- Backend-Funktion `updateTokenScopes` mit Zod-Validierung und kind-spezifischer Scope-Pruefung (gleiche Validierung wie bei Token-Erstellung)
- API-Route als action-only Route (Pattern analog zu revoke/rotate)
- Dashboard-UI mit inline EditScopesForm in TokenList, `allowedScopes` prop fuer kind-spezifische Filterung
- Bereits ausgegebene JWTs behalten alte Scopes bis zum Ablauf (max 15 Min) — kein Handlungsbedarf

## Betroffene Dateien

| Datei                                                        | Beschreibung                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/types.ts`                              | Neues `updateTokenScopesInputSchema` und `UpdateTokenScopesInput` Typ                                                        |
| `packages/backend/src/service.ts`                            | Neue `updateTokenScopes()` Funktion mit Validierung und Audit-Log                                                            |
| `packages/backend/src/index.ts`                              | Export von `updateTokenScopes`                                                                                               |
| `packages/frontend/app/routes/api._shared.ts`                | Import und `mailerApi`-Eintrag fuer `updateTokenScopes`                                                                      |
| `packages/frontend/app/routes/api.tokens.$tokenId.scopes.ts` | Neue API-Route (action) mit Auth und Ownership-Check                                                                         |
| `packages/frontend/app/routes/dashboard.tsx`                 | Neuer Intent `updateTokenScopes`, neue `EditScopesForm`-Komponente, `TokenList` erweitert um `allowedScopes` und Edit-Toggle |

## Implementierungsdetails

### Backend

- `updateTokenScopesInputSchema`: `z.object({ scopes: z.array(tokenScopeSchema).min(1) })`
- `updateTokenScopes(actorId, actorType, tokenId, input)`:
  - Laedt Token via `getTokenById`
  - Validiert Scopes je nach Kind (`validateApplicationScopes` / `validateApplicationAdminScopes`)
  - UPDATE `scopes_json` und `updated_at` in der passenden Tabelle
  - Schreibt Audit-Log-Eintrag (`*_token.scopes_updated`)
  - Gibt aktualisiertes Token zurueck

### API

- Route `api.tokens.$tokenId.scopes.ts`:
  - Auth via `requireAdminOrScope(request, "manageTokens")`
  - Ownership-Check via `canTokenAccessToken`
  - Delegiert an `mailerApi.updateTokenScopes`

### Dashboard

- `EditScopesForm`: Inline-Formular mit Scope-Checkboxen (gefiltert nach erlaubten Scopes je Token-Kind)
- `TokenList` erhaelt neues `allowedScopes` Prop
- Neuer "Edit scopes" / "Cancel edit" Toggle-Button pro Token
- Action-Handler validiert mindestens 1 Scope, ruft `updateTokenScopes` auf

## Testergebnisse

- 104 Tests bestanden (50 Backend, 54 Frontend)
- Lint, Format, TypeCheck: alle bestanden
