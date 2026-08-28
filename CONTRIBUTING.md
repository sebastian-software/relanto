# Zu Relanto beitragen

Danke für dein Interesse an Relanto. Diese Anleitung beschreibt den unterstützten Weg von einer Änderung bis zum Pull Request.

## Änderung abstimmen

Fokussierte Dokumentationsänderungen und kleine, klar abgegrenzte Fehlerkorrekturen kannst du direkt als Pull Request einreichen. Eröffne vor der Umsetzung ein Issue und stimme den Ansatz dort ab, wenn du ein neues Feature, eine inkompatible Änderung oder eine Architekturänderung planst.

## Voraussetzungen

Verwende die im Repository festgelegten Werkzeugversionen:

- Node.js `24.18.0` aus [`.nvmrc`](.nvmrc)
- pnpm `11.10.0` aus [`package.json`](package.json)

## Lokale Entwicklungsumgebung

Installiere die Abhängigkeiten im Repository-Stamm:

```bash
pnpm install
```

Der Standardpfad benötigt weder Zugangsdaten für eine private npm-Registry noch eine geheime Build-Konfiguration. Lege vor dem Start die lokale Entwicklungsdatei an:

```bash
cp packages/frontend/.env.development.example packages/frontend/.env.development
```

Ersetze die beiden Platzhalter-Secrets vor dem ersten Start durch lokale Testwerte und committe keine Zugangsdaten. Die erforderlichen Variablen und ihre Bedeutung beschreibt die [Frontend-Dokumentation](packages/frontend/README.md#development).

```bash
pnpm dev
```

Für die weitere Orientierung:

- [Architekturüberblick](docs/developer-guide/architecture.md)
- [Teststrategie und Prüfkommandos](docs/developer-guide/testing.md)

## Änderungen umsetzen

Halte Pull Requests auf ein klar beschriebenes Ziel begrenzt. Beschreibe im Pull Request den Anlass, den Umfang und die ausgeführten Prüfungen.

Beachte dabei die Repository-Konventionen:

- Dokumentation und Fließtext werden auf Deutsch geschrieben.
- Code-Bezeichner und Commit-Messages werden auf Englisch geschrieben.
- Neue Routendateien unter `packages/frontend/app/routes/` müssen zusätzlich in `packages/frontend/app/routes.ts` registriert werden.
- Release-relevante Commit-Messages verwenden die Conventional-Commit-Typen `feat:`, `fix:` oder `deps:`. Diese Typen lösen über release-please eine Veröffentlichung aus; `chore:` tut das nicht. Abhängigkeits- oder Lockfile-Änderungen, die veröffentlicht werden sollen, verwenden `fix(deps):`.

## Änderungen prüfen

Führe vor dem Pull Request die repository-weite Prüfung aus:

```bash
pnpm agent:check
```

Der Befehl prüft Linting, Formatierung, Typen, Build und Tests. Ergänze abhängig von deiner Änderung die gezielten Prüfungen aus der [Teststrategie](docs/developer-guide/testing.md).

## Verhaltenskodex und vertrauliche Meldungen

Beachte bei allen Beiträgen und Diskussionen den [Verhaltenskodex](CODE_OF_CONDUCT.md). Melde mögliche Verstöße gegen den Verhaltenskodex sowie vermutete Sicherheitslücken vertraulich an [security@sebastian-software.de](mailto:security@sebastian-software.de). Für Sicherheitsmeldungen gelten zusätzlich die Hinweise in [`SECURITY.md`](SECURITY.md).

## Lizenz der Beiträge

Mit dem Einreichen eines Beitrags bestätigst du, dass du ihn unter der [MIT-Lizenz](LICENSE) des Projekts bereitstellen darfst. Relanto verlangt weder ein Contributor License Agreement (CLA) noch ein Developer Certificate of Origin (DCO) oder eine `Signed-off-by`-Zeile.
