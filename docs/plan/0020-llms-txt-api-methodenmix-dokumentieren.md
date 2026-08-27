# 0020 LLMs.txt API-Methodenmix dokumentieren

**Planungsstatus:** Umgesetzt

## Anforderung

Die API-Einträge in `LLMs.txt` sollen nicht nur Read-Endpunkte mit `GET` zeigen, sondern den bereits
implementierten Methodenmix des HTTP-Vertrags sichtbar machen. Insbesondere soll klar werden, dass
administrative Integrationen per API auch SMTP-Konfigurationen anlegen oder ändern koennen.

## Architekturentscheidungen

- `LLMs.txt` bleibt eine kompakte Integrationsdoku und wird nicht zu einer vollstaendigen OpenAPI-Spezifikation ausgebaut.
- Der dokumentierte Vertrag orientiert sich direkt an den implementierten `/api/v1/...`-Routen im Frontend.
- Mutierende Verwaltungsendpunkte werden gruppiert nach SMTP-Konfigurationen, Tokens und Queue-Operationen dokumentiert.
- Die Dokumentation nennt bewusst die real verwendeten Methoden `GET`, `POST` und `DELETE`; nicht implementierte Methoden wie `PUT` oder `PATCH` werden nicht erwaehnt.

## Betroffene Dateien

| Datei                                                                                                    | Beschreibung                                                                       |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [LLMs.txt](../../LLMs.txt)                                                                               | API-Integrationsdoku um mutierende Methoden und administrative Endpunkte erweitert |
| [docs/plan/0015-llms-txt-fuer-api-integration.md](../../docs/plan/0015-llms-txt-fuer-api-integration.md) | Bestehende Plan-Doku auf den erweiterten Dokumentationsumfang angepasst            |

## Implementierungsdetails

- Der Abschnitt zu SMTP-Config- und Token-Management dokumentiert jetzt:
  - `GET` und `POST` fuer Config-Listen und Config-Updates
  - `POST` fuer Config-Validierung
  - `GET`, `POST`, `DELETE` und operative Token-Aktionen fuer tokenbezogene Endpunkte
  - `DELETE` und `POST` fuer Queue-Kontrollaktionen bei Jobs
- Scope-Hinweise wurden von reinen Read-Faellen auf Lese- und Schreiboperationen erweitert.
- Praktische Hinweise erklaeren explizit, dass Relanto aktuell fuer mehrere Verwaltungsoperationen `POST` auch bei Create-/Update-Flows verwendet.

## Testergebnisse

- `pnpm agent:check`
- Ergebnis: erfolgreich
- Enthalten: Lint, Format-Check, Typecheck, Backend-Tests, Frontend-Tests

## Review-Findings und deren Behebung

| Schweregrad | Bereich       | Datei                      | Problem                                                                                                                                    | Behebung                                                         | Status  |
| ----------- | ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------- |
| Hinweis     | Dokumentation | [LLMs.txt](../../LLMs.txt) | Vor der Aenderung wirkte der Verwaltungsbereich wie ein reiner Read-Vertrag, obwohl bereits mutierende API-Operationen implementiert sind. | Endpunkte und Methoden nach tatsaechlichem Codevertrag ergaenzt. | Behoben |
