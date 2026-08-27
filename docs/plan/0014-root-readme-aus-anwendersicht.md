# 0014: Root-README aus Anwendersicht

**Planungsstatus:** Umgesetzt

## Anforderung

Eine neue Root-`README.md` fuer Relanto, geschrieben aus Sicht eines Anwenders bzw. Betreibers statt aus Sicht eines Entwicklers.

## Architekturentscheidungen

- Die neue Root-README dient als produktorientierter Einstieg in das Repository.
- Technische Detaildoku bleibt in `packages/frontend/README.md`.
- Die Root-README erklaert Zweck, Nutzen, Betriebsmodell und die wichtigsten Betriebsanforderungen in knapper Form.

## Betroffene Dateien

| Datei                                             | Beschreibung                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `README.md`                                       | Neuer nutzerorientierter Einstieg fuer Relanto auf Repository-Ebene |
| `docs/plan/0014-root-readme-aus-anwendersicht.md` | Dokumentation dieser Doku-Erweiterung                               |

## Implementierungsdetails

- Beschreibung von Relanto als selbst gehosteter Mailer-Service
- Fokus auf Betreiber- und Admin-Sicht statt Entwickler-Setup
- Kurze Erklaerung von Funktionsumfang, Betriebsmodell, Pflichtvoraussetzungen und Datensicherung
- Verweise auf bestehende Detaildoku fuer Deployment und Quadlet

## Testergebnisse

- `pnpm agent:check`

## Review-Findings und Behebung

- Keine offenen Findings
