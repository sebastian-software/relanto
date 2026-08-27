# 0025: Fehlerdetails fuer fehlgeschlagene Jobs im Dashboard

**Planungsstatus:** Umgesetzt

## Anforderung

Bei fehlgeschlagenen oder unsicheren Mail-Jobs in der "Letzte Jobs"-Tabelle wird ein "Show error"-Button angezeigt, der per Klick die Fehlerdetails (Fehlermeldung, Kategorie, Code) einblendet.

## Architekturentscheidungen

- Rein client-seitiger Toggle via `useState` mit einem `Set<string>` fuer expandierte Job-IDs
- Bestehende `formNoticeDiagnostics`-Styles wiederverwendet fuer konsistentes Layout
- Keine Backend-Aenderung — `lastError`, `errorCategory`, `errorCode` sind bereits im `MailJob`-Typ enthalten und werden vom Loader geladen
- Button nur sichtbar wenn `lastError` vorhanden ist
- Expandierte Zeile als zusaetzliche `<tr>` mit `colSpan={5}` unterhalb der Job-Zeile

## Betroffene Dateien

| Datei                                        | Beschreibung                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| `packages/frontend/app/routes/dashboard.tsx` | `expandedErrorJobIds` State, Toggle-Button, Fehlerdetail-Zeile |

## Implementierungsdetails

- `expandedErrorJobIds: Set<string>` State trackt welche Jobs expandiert sind
- Button erscheint bei `status === "failed"` oder `status === "delivery_uncertain"` und vorhandenem `lastError`
- Fehlerdetails zeigen: Error (lastError), Category (errorCategory), Code (errorCode)
- `Fragment` importiert fuer die zwei zusammengehoerenden `<tr>` Elemente pro Job

## Testergebnisse

- 112 Tests bestanden (50 Backend, 62 Frontend)
- Lint, Format, TypeCheck: alle bestanden
