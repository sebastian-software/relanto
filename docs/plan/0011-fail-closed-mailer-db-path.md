# 0011: Fail-Closed fuer MAILER_DB_PATH und persistentes SQLite-Deployment

**Planungsstatus:** Umgesetzt

## Anforderung

Haertung des Produktivstarts von Relanto gegen fluechtige SQLite-Defaults mit:

- fail-closed Runtime-Validierung fuer `MAILER_DB_PATH` ausserhalb lokaler Entwicklung
- Beibehaltung des lokalen SQLite-Fallbacks fuer Development
- expliziter Dokumentation der Single-Instance-Annahme
- persistentem SQLite-Pfad in einem named volume fuer den Container-Betrieb

## Architekturentscheidungen

- Die Runtime-Validierung bleibt zentral in `packages/backend/src/env.ts`, weil `getMailerDbPath()` bereits die einzige Quelle fuer den DB-Pfad ist.
- Lokale Entwicklung darf weiter ohne explizites `MAILER_DB_PATH` auf `tmp/mailer.sqlite` im Repository zurueckfallen, um `pnpm dev` einfach zu halten.
- Ausserhalb lokaler Entwicklung muss `MAILER_DB_PATH` explizit gesetzt sein; stilles Zurueckfallen auf `tmp/` ist nicht mehr erlaubt.
- Das empfohlene Container-Deployment bleibt Single-Instance und speichert SQLite persistent unter `/var/lib/relanto/mailer.sqlite` in einem named volume.

## Betroffene Dateien

| Datei                                                                                      | Beschreibung                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [packages/backend/src/env.ts](../../packages/backend/src/env.ts)                           | fail-closed Validierung fuer `MAILER_DB_PATH` ausserhalb lokaler Entwicklung        |
| [packages/backend/src/env.test.mjs](../../packages/backend/src/env.test.mjs)               | Regressionstests fuer lokalen Fallback, fehlenden Produktivpfad und expliziten Pfad |
| [deploy/quadlet/relanto.container.example](../../deploy/quadlet/relanto.container.example) | Quadlet-Beispiel mit persistentem SQLite-Pfad unter `/var/lib/relanto`              |
| [packages/frontend/README.md](../../packages/frontend/README.md)                           | Deployment-Doku fuer Single-Instance- und Persistent-Volume-Annahme                 |
| `review-report-2026-03-30.md`                                                              | Finding zum fluechtigen SQLite-Default als umgesetzt markiert                       |

## Implementierungsdetails

- `getMailerDbPath()`:
  - erlaubt den bisherigen Default `tmp/mailer.sqlite` nur noch bei `NODE_ENV=development`
  - wirft ausserhalb lokaler Entwicklung einen klaren Startfehler, wenn `MAILER_DB_PATH` fehlt
  - erstellt weiterhin das Zielverzeichnis des expliziten Pfads automatisch
- Die Regressionstests decken drei Faelle ab:
  - lokaler Development-Fallback erlaubt
  - fehlender Produktivpfad wird abgewiesen
  - expliziter Pfad wird akzeptiert
- Das Quadlet-Beispiel setzt:
  - `MAILER_DB_PATH=/var/lib/relanto/mailer.sqlite`
  - `Volume=relanto-data:/var/lib/relanto`
- Die Deployment-Doku nennt explizit:
  - named volume als Pflicht fuer Neustart-Persistenz
  - Single-Instance-Betrieb als aktuelle Betriebsannahme
  - keine Unterstuetzung fuer mehrere parallele Replikate mit lokaler SQLite-Datei

## Testergebnisse

- `pnpm --filter @relanto/backend test` erfolgreich
- `pnpm agent:check` erfolgreich

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 0 | 0 | 0 |

- Interne Review-Pruefung der geaenderten Dateien ergab keine offenen Findings.
