# 0024: Anwendungsverantwortlichen-Filter im Applications-Panel

**Planungsstatus:** Umgesetzt

## Anforderung

Im Dashboard-Bereich "Applications" kann ueber ein Select-Dropdown nach Anwendungsverantwortlichem (Application Admin) gefiltert werden. Nur Anwendungen des selektierten Admins werden angezeigt. Default: alle Anwendungen.

## Architekturentscheidungen

- Rein client-seitiger Filter via `useState` — kein Backend-Roundtrip noetig
- Bestehende `selectControl` CSS-Klasse wiederverwendet
- Select wird nur gerendert wenn mindestens ein Admin existiert
- Gefilterter Empty-State zeigt kontextabhaengige Meldung

## Betroffene Dateien

| Datei                                        | Beschreibung                                                      |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `packages/frontend/app/routes/dashboard.tsx` | `selectedAdminId` State, Select-Dropdown, gefilterte Applications |

## Implementierungsdetails

- `selectedAdminId: string | null` State (null = alle)
- `filteredApplications` abgeleitet aus `applications.filter(...)` oder `applications`
- `<select>` im Panel-Header neben dem Titel mit Option "All admins" + jeder Admin
- Empty-State unterscheidet zwischen "keine Anwendungen" und "keine Anwendungen fuer diesen Admin"

## Testergebnisse

- 112 Tests bestanden (50 Backend, 62 Frontend)
- Lint, Format, TypeCheck: alle bestanden
