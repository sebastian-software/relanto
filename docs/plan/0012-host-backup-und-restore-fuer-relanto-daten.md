# 0012: Host-Backup und Restore fuer Relanto-Daten

**Planungsstatus:** Umgesetzt

## Anforderung

Es soll vom Host aus moeglich sein, die persistenten Daten des Relanto-Containers zu sichern und wiederherzustellen.

## Architekturentscheidungen

- Backup und Restore werden als Host-seitige Skripte unter `deploy/` umgesetzt, nicht als API oder In-Container-Funktion.
- Gesichert wird das named volume `relanto-data`, weil dort die persistenten Relanto-Daten liegen.
- Restore bleibt bewusst destruktiv und erfordert eine explizite Bestaetigung per `--yes`.
- Die Doku schreibt fuer Restore einen gestoppten Relanto-Dienst vor, damit die SQLite-Datei konsistent bleibt.

## Betroffene Dateien

| Datei                                                                                      | Beschreibung                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [deploy/backup-relanto-data.sh](../../deploy/backup-relanto-data.sh)                       | Host-Skript fuer das Backup des named volumes `relanto-data`              |
| [deploy/restore-relanto-data.sh](../../deploy/restore-relanto-data.sh)                     | Host-Skript fuer destruktives Restore des named volumes                   |
| [deploy/quadlet/relanto.container.example](../../deploy/quadlet/relanto.container.example) | Quadlet-Beispiel mit Hinweis auf die Host-Backup-/Restore-Skripte         |
| [packages/frontend/README.md](../../packages/frontend/README.md)                           | Dokumentation fuer Host-Backup, Restore und den gestoppten Restore-Ablauf |

## Implementierungsdetails

- `deploy/backup-relanto-data.sh`
  - nutzt `podman run --rm`
  - mountet `relanto-data` read-only nach `/volume`
  - schreibt ein `tar.gz`-Archiv auf den Host
  - erlaubt optional einen eigenen Zielpfad
- `deploy/restore-relanto-data.sh`
  - erwartet ein bestehendes `tar.gz`-Archiv
  - verlangt `--yes` als Schutz gegen versehentliches Ueberschreiben
  - leert das Volume vor dem Entpacken, damit kein Mischzustand bleibt
  - setzt voraus, dass die laufende Relanto-Instanz vorher gestoppt wurde
- Die Doku trennt klar zwischen persistenten Volumedaten und nicht gesicherten Secrets bzw. Host-Konfigurationen.

## Testergebnisse

- `bash -n deploy/backup-relanto-data.sh`
- `bash -n deploy/restore-relanto-data.sh`
- `pnpm agent:check`

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 0 | 0 | 0 |

- Interne Review-Pruefung der geaenderten Dateien ergab keine offenen Findings.
