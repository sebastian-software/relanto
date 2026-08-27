# 0015: LLMs.txt fuer API-Integration

**Planungsstatus:** Umgesetzt

## Anforderung

Eine neue `LLMs.txt` auf Root-Ebene mit den wichtigsten Informationen fuer eine LLM, die Relantos API in eine Anwendung integrieren soll. Die Datei sollte auf Englisch geschrieben sein und nur das Frontend als Admin-Oberflaeche erwaehnen.

## Architekturentscheidungen

- `LLMs.txt` dient als kompakte Integrationsgrundlage fuer LLMs.
- Der Inhalt konzentriert sich auf API-Nutzung, Token-Scopes, Statusverhalten und Integrationsgrenzen.
- Der dokumentierte API-Vertrag nennt nicht nur Read-Endpunkte, sondern auch die bereits vorhandenen mutierenden Methoden fuer Verwaltung und Queue-Operationen.
- Interne Paket- oder Backend-Strukturen werden bewusst nicht erklaert.
- Das Frontend wird nur als Admin-Frontend fuer Betreiber erwaehnt.

## Betroffene Dateien

| Datei                                             | Beschreibung                                   |
| ------------------------------------------------- | ---------------------------------------------- |
| `LLMs.txt`                                        | Neue Integrationsdoku fuer LLMs auf Root-Ebene |
| `docs/plan/0015-llms-txt-fuer-api-integration.md` | Dokumentation dieser Doku-Erweiterung          |

## Implementierungsdetails

- Beschreibung von Relanto als API plus Admin-Frontend
- Dokumentation der relevanten Scopes fuer Integrationen
- Erklaerung von `/api/v1/send`, Job-Status-Reads und administrativen API-Endpunkten inklusive mutierender Methoden
- Hinweise zu `queued` vs. `direct`, Payload-Limits und Fehlerbehandlung
- Klare Aussage, dass bestehende Token nicht im Klartext auslesbar sind

## Testergebnisse

- `pnpm agent:check`

## Review-Findings und Behebung

- Keine offenen Findings
