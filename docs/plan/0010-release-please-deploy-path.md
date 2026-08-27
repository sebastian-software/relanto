# 0010: Release-Please-basierter Deploy-Pfad

**Planungsstatus:** Umgesetzt

## Anforderung

Aufbau eines release-please-basierten Deploy-Pfads fuer Relanto mit:

- GitHub Actions fuer Release-Please
- Container-Build und Push nach GHCR
- Ziel-Image `ghcr.io/sebastian-software/relanto`
- einem Podman-/Quadlet-tauglichen Container-Image
- Bereinigung des bisherigen Scaffold-Dockerfiles

## Architekturentscheidungen

- Es wird ein einzelnes Root-Container-Image fuer die laufende App gebaut, nicht getrennte Images pro Workspace-Paket.
- Der Build erfolgt auf pnpm-Workspace-Basis ueber einen Root-`Dockerfile`, weil die alte Frontend-only-Dockerdatei Workspace-Abhaengigkeiten nicht korrekt abbildet.
- `release-please` bleibt die Quelle fuer Release-PRs und GitHub-Releases; der Container-Publish wird direkt im selben Workflow ausgefuehrt, sobald fuer `packages/frontend` ein Release erzeugt wurde.
- Das Container-Image wird als OCI-kompatibles GHCR-Image gebaut und ist damit fuer Podman/Quadlet geeignet.
- Die GHCR-Sichtbarkeit wird nicht im Workflow hart codiert, sondern ueber GitHub Packages verwaltet; der Workflow pusht nur nach `ghcr.io/sebastian-software/relanto`.

## Betroffene Dateien

| Datei                                                                                      | Beschreibung                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [Dockerfile](../../Dockerfile)                                                             | neuer pnpm-Workspace-tauglicher Root-Container-Build                      |
| [.dockerignore](../../.dockerignore)                                                       | reduzierte Build-Kontexte fuer den Container-Build                        |
| `packages/frontend/Dockerfile`                                                             | veralteter Scaffold-Dockerfile entfernt                                   |
| [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml)         | Release-Please-Workflow fuer `main` inklusive Container-Publish nach GHCR |
| [deploy/quadlet/relanto.container.example](../../deploy/quadlet/relanto.container.example) | Beispiel fuer Podman/Quadlet                                              |
| [packages/frontend/README.md](../../packages/frontend/README.md)                           | Dokumentation fuer Build-, GHCR- und Quadlet-Pfad                         |
| `review-report-2026-03-30.md`                                                              | Docker-/Deployment-Finding als umgesetzt markiert                         |

## Implementierungsdetails

- Der neue Root-`Dockerfile`:
  - nutzt `node:20-bookworm-slim`
  - aktiviert `corepack`
  - installiert das pnpm-Workspace
  - baut `@relanto/frontend`
  - startet zur Laufzeit `pnpm --filter @relanto/frontend start`
- `release-please.yml`:
  - laeuft auf Push nach `main`
  - verwendet die vorhandenen Dateien `release-please-config.json` und `.release-please-manifest.json`
  - baut und pusht das Container-Image direkt im Anschluss, wenn `release-please` fuer `packages/frontend` ein Release erzeugt hat
  - erzeugt Tags aus Frontend-Release-Tag, SHA und `latest`
  - pusht nach `ghcr.io/sebastian-software/relanto`
- Fuer Quadlet liegt ein Beispiel mit `Environment`, `PublishPort` und `Volume` unter `deploy/quadlet/`.

## Testergebnisse

- `pnpm agent:check` erfolgreich
- Lokale Syntax- und Repo-Validierung fuer Code und Tests erfolgreich
- Lokaler `docker build -t relanto:test .` konnte in dieser Umgebung nicht vollstaendig verifiziert werden:
  - Docker CLI ist vorhanden
  - der Docker-Daemon unter Colima war zum Testzeitpunkt nicht erreichbar

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 1 | 0 | 1 |

- Hinweis: Der neue Container-Build konnte lokal noch nicht bis zum Image-Artefakt validiert werden, weil der Docker-Daemon in der aktuellen Umgebung nicht lief.
  - Bereich: Deployment-Validierung
  - Datei: [Dockerfile](../../Dockerfile)
  - Status: offen
  - Empfehlung: Sobald der lokale Docker- oder Podman-Daemon verfuegbar ist, den Build einmal mit `docker build -t relanto:test .` oder `podman build -t relanto:test .` gegen den echten Build-Kontext pruefen.
