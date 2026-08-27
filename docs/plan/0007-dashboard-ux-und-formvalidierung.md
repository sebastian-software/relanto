# 0007: Dashboard-UX und Formvalidierung

**Planungsstatus:** Umgesetzt

## Anforderung

Überarbeitung der Admin-Oberfläche mit Fokus auf konsistente UX:

- alle sichtbaren Eingabefelder und Buttons müssen einen klaren Zweck haben
- Formularfehler sollen direkt am betroffenen Feld erscheinen
- Erfolgsmeldungen sollen lokal beim jeweiligen Formular oder Listenbereich erscheinen
- technische Fehlermeldungen, Stacktraces und rohe Debug-Ausgaben dürfen nicht in der UI auftauchen

## Architekturentscheidungen

- Formularzustand bleibt servergetrieben über `loader` und `action`; es wird kein globales Frontend-State-System eingeführt.
- Jede Aktion liefert jetzt einen `formKey`, optionale `fieldErrors`, `formError`, `notice` und bei Bedarf `values` zur Wiederbefüllung des Formulars.
- Business-Logik bleibt im Backend-Service; technische Service-Fehler werden in der Route in fachliche UI-Meldungen übersetzt.
- Token-Klartexte werden nur direkt nach Erstellung oder Rotation in einem lokalen Notice-Block angezeigt.
- Die globale `ErrorBoundary` zeigt nur noch nutzbare Fehltexte und keine technischen Details mehr.

## Betroffene Dateien

| Datei                                                                                                | Beschreibung                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [packages/frontend/app/routes/dashboard.tsx](../../packages/frontend/app/routes/dashboard.tsx)       | Dashboard-Struktur, Formularvalidierung, fachliche Fehlerabbildung, lokale Erfolgsmeldungen |
| [packages/frontend/app/routes/dashboard.css.ts](../../packages/frontend/app/routes/dashboard.css.ts) | neue Formular-, Notice-, Checkbox- und Token-Styles sowie disabled/error states             |
| [packages/frontend/app/root.tsx](../../packages/frontend/app/root.tsx)                               | technische Fehlerdarstellung in der ErrorBoundary entfernt                                  |
| [packages/frontend/app/locales/de.ts](../../packages/frontend/app/locales/de.ts)                     | vereinfachte und neue deutsche UX-/Fehlertexte                                              |
| [packages/frontend/app/locales/en.ts](../../packages/frontend/app/locales/en.ts)                     | ergänzte englische UX-/Fehlertexte                                                          |

## Implementierungsdetails

- Das Dashboard ist jetzt stärker entlang des tatsächlichen Arbeitsflusses organisiert:
  - `Application Admin` anlegen
  - `Application` anlegen
  - SMTP-Konfiguration pflegen und validieren
  - Admin- und Application-Tokens ausstellen und verwalten
  - Versandjobs abhängig vom Status steuern
- Formulare behalten bei Fehlern ihre Eingaben, einschließlich Mehrfachauswahl bei Scopes.
- Leere und gesperrte Zustände sind explizit:
  - keine Applications ohne vorhandenen Application Admin
  - keine Application-Tokens ohne gespeicherte SMTP-Konfiguration
- Die Job-Tabelle zeigt nur noch Aktionen, die im jeweiligen Status sinnvoll sind.
- Die alte globale JSON-Action-Ausgabe wurde vollständig entfernt.

## Validierung

- `pnpm agent:check` erfolgreich
- Bekannter Vitest-Hinweis zum verzögerten Schließen bleibt unverändert, aber ohne Fehlerstatus
