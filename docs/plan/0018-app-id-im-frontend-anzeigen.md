# 0018 App-ID im Frontend anzeigen

**Planungsstatus:** Umgesetzt

## Anforderung

Im Admin-Frontend soll die technische App-ID im Format `app_<zufallswert>` sichtbar sein, damit
Anwendungen im Dashboard eindeutig identifiziert werden koennen.

## Architekturentscheidungen

- Die App-ID wird direkt in der bestehenden Applications-Karte im Dashboard gerendert, damit sie
  bereits im zugeklappten Zustand sichtbar ist.
- Es wird keine neue API oder Loader-Erweiterung eingefuehrt, weil `application.id` in
  `packages/frontend/app/routes/dashboard.tsx` bereits vorliegt.
- Die Darstellung erfolgt als kompaktes technisches Badge mit Monospace-Charakter, damit sich die
  ID visuell vom restlichen Beschreibungstext absetzt.
- Ein bestehender Root-Test wurde auf die aktuelle Paketversion umgestellt, damit die
  Gesamtvalidierung am echten Build-Label statt an einem veralteten Erwartungswert prueft.

## Betroffene Dateien

| Datei                                             | Beschreibung                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/frontend/app/routes/dashboard.tsx`      | Rendert die App-ID im Kartenkopf jeder Anwendung                         |
| `packages/frontend/app/routes/dashboard.css.ts`   | Definiert das Badge-Styling fuer die sichtbare App-ID                    |
| `packages/frontend/app/routes/dashboard.test.tsx` | Regressionstest fuer die Anzeige der App-ID                              |
| `packages/frontend/app/root.test.tsx`             | Stabilisiert die Build-Label-Erwartung anhand der aktuellen Paketversion |

## Implementierungsdetails

- Das Badge wird unmittelbar unter dem Application-Namen angezeigt und verwendet den Text
  `App ID <id>`.
- Die Position im Kartenkopf stellt sicher, dass die App-ID sichtbar bleibt, ohne erst die
  Detailansicht oeffnen zu muessen.
- Das Styling nutzt eine kompakte Pill-Form mit technischer, leicht hervorgehobener Darstellung.
- Der Root-Test liest die Version nun direkt aus `packages/frontend/package.json`.

## Testergebnisse

- `pnpm --filter @relanto/frontend exec vitest run app/routes/dashboard.test.tsx`
- `pnpm --filter @relanto/frontend exec vitest run app/root.test.tsx app/routes/dashboard.test.tsx`
- `pnpm agent:check`

## Review-Findings und Behebung

- Keine offenen Findings.
