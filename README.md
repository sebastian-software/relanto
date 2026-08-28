# Relanto

**E-Mails aus deinen Apps. Über deine SMTP-Server. Unter deiner Kontrolle.**

Relanto bündelt den Versand aus all deinen Anwendungen hinter einer HTTP-API: getrennte SMTP-Konfigurationen, Token mit Scopes, Job-Queue mit Retries und ein Admin-Panel, das jeden Versand nachvollziehbar macht.

- Kein SaaS, kein Vendor-Lock-in – ein Container auf deinem Server reicht
- Jede Anwendung erhält eigene Credentials und SMTP-Konfiguration
- Versandstatus und API-Fehler einsehbar, ohne Container-Logs zu durchsuchen

[![CI](https://github.com/sebastian-software/relanto/actions/workflows/ci.yml/badge.svg)](https://github.com/sebastian-software/relanto/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/sebastian-software/relanto?label=release)](https://github.com/sebastian-software/relanto/releases) [![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](#lizenz) [![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](#)

<!-- TODO: Screenshot der Admin-UI (Dashboard: Tokens, SMTP-Konfiguration, Fehler-Panel) einfügen -->

## Technische Case Study

**Problem und Ansatz.** Sobald mehrere Anwendungen E-Mails versenden, wiederholen sich SMTP-Konfiguration, Zugangsschutz, Fehlerbehandlung und Betriebslogik. Relanto bündelt diese Aufgaben hinter einer selbst gehosteten HTTP-API: Anwendungen authentifizieren sich mit eigenen, begrenzbaren Zugängen und übergeben den Versand zentral an Relanto ([Architekturüberblick](docs/developer-guide/architecture.md)).

**Architektur und Trade-off.** Die React-Router-Anwendung trägt Admin-Oberfläche und HTTP-Schicht; das Backend kapselt Domänenlogik, SQLite-Persistenz und einen Worker für Queue und Aufbewahrung. SQLite und der Worker im Webserver-Prozess halten die Bereitstellung kompakt, setzen aber bewusst auf genau eine laufende Instanz statt horizontalem Multi-Instanz-Betrieb mit einer gemeinsamen Datenbankdatei ([Architekturüberblick](docs/developer-guide/architecture.md), [Container-Build](Dockerfile)).

**Sicherheit.** SMTP-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert, Client-Secrets nur als SHA-256-Hash; sensible Fehlermeldungen werden bereinigt ([Sicherheitsmodul](packages/backend/src/security.ts)). Vor SMTP-Verbindungen prüft Relanto jede aufgelöste Zieladresse und blockiert nicht öffentlich routbare Netze, um SSRF zu begrenzen ([Implementierung](packages/backend/src/service.ts), [SSRF-Tests](packages/backend/src/service.test.mjs)). Tests sichern außerdem ab, dass strukturierte Betriebslogs weder Nachrichteninhalte noch Zugangsdaten enthalten ([Logging-Tests](packages/backend/src/structured-log.test.mjs)). Das Laufzeit-Image startet als unprivilegierter Benutzer und besitzt einen Healthcheck ([Dockerfile](Dockerfile)).

**Teststrategie.** Paketbezogene Vitest-Suiten und verbindliche Coverage-Schwellen prüfen Frontend und Backend ([Teststrategie](docs/developer-guide/testing.md)). Ein Vertragstest hält die generierte OpenAPI-Spezifikation synchron mit den registrierten Routen und prüft die Abdeckung in beide Richtungen ([OpenAPI-Test](packages/backend/src/openapi/openapi.test.ts)). Die CI ergänzt diese Prüfungen um Produktionsabhängigkeits-Audit, Container-Build, Schwachstellen-Scan und Smoke-Tests ([CI-Workflow](.github/workflows/ci.yml)).

**Mein Beitrag.** Ich habe Relanto konzipiert und umgesetzt – vom Domänenmodell und API-Vertrag über Authentifizierung, Queue-Verarbeitung und Admin-Oberfläche bis zu den Betriebs- und Testpfaden. Die technischen Entscheidungen und ihre Grenzen habe ich in der [Entwicklerdokumentation](docs/developer-guide/architecture.md) nachvollziehbar festgehalten.

## Was Relanto besser macht

**Token & Scopes – Zugriff, der zur Anwendung passt**

Jede App bekommt genau die Rechte, die sie braucht. Kompromittierte Tokens rotierst du mit einem Klick.

**Queue & Retries – kein Mailausfall durch SMTP-Wackler**

SMTP-Wackler kosten keine Mails: Jobs werden eingereiht, wiederholt und bleiben nachvollziehbar.

**Admin-Panel – Sichtbarkeit ohne Logdateien**

Sieh, was rausging, was hängt und warum ein Request fehlschlug – ohne Container-Logs zu greppen.

**Self-hosted – dein Server, deine Daten**

Ein Container, eine SQLite-Datei, dein Server. Backup ist ein Skript, kein Support-Ticket.

## So funktioniert's

1. **Container starten** – Image ziehen, Pflicht-Env-Vars setzen, Volume für die SQLite-Datenbank bereitstellen.
2. **App, SMTP-Config und Token anlegen** – im Admin-Panel Anwendungen registrieren, SMTP-Zugänge hinterlegen und API-Tokens mit den nötigen Scopes erstellen.
3. **E-Mails versenden** – Token über `POST /api/v1/token` holen, dann `POST /api/v1/send` aufrufen.

## Schnellstart

```bash
podman run -d -p 3000:3000 \
  -e APP_SESSION_SECRET=$(openssl rand -hex 32) \
  -e MAILER_SECRET_KEY=$(openssl rand -hex 32) \
  -e MAILER_DB_PATH=/var/lib/relanto/mailer.sqlite \
  -e POCKET_ID_ISSUER=https://pocket-id.example.com \
  -e POCKET_ID_CLIENT_ID=mailer \
  -e POCKET_ID_REDIRECT_URI=https://mailer.example.com/auth/callback \
  -v relanto-data:/var/lib/relanto:U \
  ghcr.io/sebastian-software/relanto:latest
```

Für Produktivbetrieb mit systemd-Integration: [deploy/quadlet/relanto.container.example](deploy/quadlet/relanto.container.example)

---

## Wofür Relanto gedacht ist

Relanto eignet sich für Teams, die:

- E-Mails aus eigenen Anwendungen oder internen Systemen versenden wollen
- mehrere SMTP-Konfigurationen sauber trennen müssen
- Versandzugriffe per Token und Scope-Modell absichern wollen
- den Versandstatus einzelner Jobs nachvollziehen müssen
- eine einfache, selbst betriebene Lösung ohne externe SaaS-Abhängigkeit suchen

## Was Relanto bietet

- API-basierter Versand von HTML- und Text-E-Mails
- SMTP-Konfigurationen pro Anwendung
- getrennte Rollen für System-Admins und Application-Admins
- Token-Modell mit klaren Scopes für Versand, Status und Verwaltung
- Job-Queue mit Retry-Logik und Statusverfolgung
- Admin-Oberfläche für Konfiguration, Tokens und Betriebsdaten
- Backup- und Restore-Pfad für die persistenten Daten

## Wie Relanto betrieben wird

Relanto ist für einen einfachen, kontrollierten Single-Instance-Betrieb ausgelegt.

- Betrieb als Container
- Persistente SQLite-Datenbank auf einem Volume
- OIDC-Login für den System-Admin über Pocket ID
- Interner Worker für Queue-Verarbeitung im selben Prozess wie der Webserver

Wichtig:

- Die SQLite-Daten müssen auf persistentem Storage liegen.
- Mehrere parallele Instanzen mit derselben lokalen SQLite-Datei sind nicht vorgesehen.
- Der Worker startet beim Prozessstart automatisch und verarbeitet wartende Jobs ohne zusätzlichen Trigger.

## Schnellstart für Betreiber

1. Container-Image verwenden:
   `ghcr.io/sebastian-software/relanto`
2. Persistentes Volume für die Datenbank bereitstellen, zum Beispiel unter `/var/lib/relanto`
3. Pflichtvariablen setzen:
   - `APP_SESSION_SECRET`
   - `MAILER_DB_PATH`
   - `MAILER_SECRET_KEY`
   - `POCKET_ID_ISSUER`
   - `POCKET_ID_CLIENT_ID`
   - `POCKET_ID_REDIRECT_URI`
4. Optional: `API_FAILURE_RETENTION_DAYS` setzen, um die Aufbewahrungsdauer für API-Fehlereinträge im Admin-Panel zu steuern (Default 30 Tage).
5. Relanto als einzelne Instanz starten
6. System-Admin per OIDC anmelden und Anwendungen, SMTP-Konfigurationen und Tokens anlegen
7. Im Admin-Bereich steht das Panel „API-Fehler" zur Verfügung. Es zeigt 4xx-Antworten der API mit Ursache, Pfad und Client-Bezug, ohne Request-Bodies oder Geheimnisse zu speichern.

Die vollständige Referenz aller Umgebungsvariablen (Pflicht/Optional, Default, Zweck) steht in [packages/frontend/README.md](packages/frontend/README.md#umgebungsvariablen).

## API-Authentifizierung für Clients

Die API verwendet `client_id` und `client_secret` als dauerhafte Client-Credentials.

Ein integrierender Client muss:

1. `client_id` und `client_secret` sicher serverseitig speichern.
2. Über `POST /api/v1/token` ein kurzlebiges JWT Access Token anfordern.
3. Das JWT bei API-Requests als `Authorization: Bearer <access_token>` mitsenden.
4. Bei Ablauf oder `401` ein neues JWT anfordern und den Request einmalig erneut versuchen.
5. Kein `client_secret` in Browser- oder Mobile-App-Code einbetten.

Das JWT ist `15 Minuten` gültig. Es gibt keine Refresh-Tokens. Der Login in die Admin-Oberfläche bleibt davon getrennt und läuft weiter über Pocket ID.

## Wichtige API-Scopes und Endpunkte

Anwendungstoken können je nach Scope für unterschiedliche Integrationen verwendet werden:

- `send`: E-Mails über `POST /api/v1/send` versenden oder einreihen
- `readStatus`: Job-Status über `GET /api/v1/jobs` und `GET /api/v1/jobs/:jobId` lesen sowie Delivery-Status über `GET /api/v1/jobs/:jobId/delivery-status` oder `POST /api/v1/jobs/delivery-status` pollen
- `readConfig`: die aktuelle SMTP-Konfiguration der Anwendung über `GET /api/v1/config` lesen
- `validate`: SMTP-Verbindung validieren
- `manageTokens`: Tokens auflisten, rotieren, widerrufen und deren Scopes aktualisieren (nur für Application-Admin-Tokens)
- `manageApplications`: Anwendungen, SMTP-Konfigurationen und Job-Queue-Operationen verwalten (nur für Application-Admin-Tokens)

Die vollständige Scope-Referenz mit Endpunkten steht in [LLMs.txt](LLMs.txt).

`GET /api/v1/config` ist nur für Anwendungstoken gedacht. Die Antwort enthält technische SMTP-Konfigurationsdaten wie Host, Port, TLS-Einstellungen, Timeouts, Absenderadresse, Statusfelder und Metadaten, aber keinen SMTP-Benutzernamen und keine Secrets.

## Betrieb und Datensicherung

Die persistenten Relanto-Daten liegen im named volume `relanto-data`.

Der Container läuft aus Sicherheitsgründen als unprivilegierter Benutzer `node` (uid/gid 1000) und nicht als root. Das Datenvolume muss deshalb diesem Benutzer gehören, sonst kann der Prozess die SQLite-Datenbank nicht schreiben. Bei einem frisch angelegten, leeren Volume übernimmt Podman die Verzeichnis-Ownership aus dem Image automatisch. Das Quadlet-Beispiel setzt zusätzlich die Mount-Option `:U` (`Volume=relanto-data:/var/lib/relanto:U`), die das Volume bei jedem Start rekursiv auf uid/gid 1000 chownt und damit auch ein bereits vorhandenes, root-owned Volume beschreibbar macht. Ohne Quadlet lässt sich das Volume alternativ einmalig manuell angleichen, zum Beispiel mit `podman unshare chown -R 1000:1000` auf dem Volume-Pfad.

Für Backup und Restore gibt es Host-Skripte:

- [backup-relanto-data.sh](deploy/backup-relanto-data.sh)
- [restore-relanto-data.sh](deploy/restore-relanto-data.sh)

Das Backup erzeugt einen konsistenten Online-Snapshot der SQLite-Datenbank über `sqlite3 ".backup"`. Dadurch bleibt das Backup auch dann konsistent, wenn Relanto währenddessen weiter schreibt – die laufende Instanz muss für das Backup **nicht** gestoppt werden. Der Snapshot ist WAL-sicher: Er liefert eine eigenständige Datenbankdatei ohne begleitende `-wal`/`-shm`-Dateien. Das Helper-Image benötigt `sqlite3`; das voreingestellte Alpine-Image installiert es beim Backup automatisch nach (dafür ist beim Backup Netzwerkzugriff nötig).

Beim Restore muss die laufende Relanto-Instanz weiterhin vorher gestoppt werden. Der bestehende Volume-Inhalt – inklusive eventueller alter `-wal`/`-shm`-Dateien – wird vor dem Entpacken gelöscht, sodass die wiederhergestellte Datenbank ein sauberer, konsistenter Stand ist.

### Monitoring

Relanto stellt zwei Endpunkte für Betrieb und Verfügbarkeitsüberwachung bereit:

- `GET /health` – unauthentifizierte Verfügbarkeitsprüfung für Load Balancer und Uptime-Monitoring. Antwortet mit `200`, wenn Datenbank und Worker-Loop gesund sind, sonst mit `503`.
- `GET /metrics` – detaillierte Betriebsdaten (Queue-Status, Versand- und Fehlerraten, SMTP-Konfigurationsstatus, Worker-Tick, Speicherverbrauch). Erfordert einen Bearer-Token aus der Umgebungsvariable `METRICS_TOKEN`; ohne gesetzten Token antwortet der Endpunkt mit `404`.

Eine fertige Uptime-Kuma-Konfiguration mit empfohlenen Monitors und Schwellwerten steht in [docs/health-and-metrics-relanto.md](docs/health-and-metrics-relanto.md).

## Weiterführende Doku

- Technische und Deployment-Details: [packages/frontend/README.md](packages/frontend/README.md)
- Podman/Quadlet-Beispiel: [relanto.container.example](deploy/quadlet/relanto.container.example)
- Deployment-Pipeline (Container-Build, Quadlet, GHCR und Releases): [packages/frontend/README.md#deployment](packages/frontend/README.md#deployment)
- Changelogs: [Frontend](packages/frontend/CHANGELOG.md) · [Backend](packages/backend/CHANGELOG.md)
- Mitwirken: [CONTRIBUTING.md](CONTRIBUTING.md)
- Sicherheitslücken vertraulich melden: [SECURITY.md](SECURITY.md)

## Lizenz

Der Quellcode von Relanto ist unter der [MIT-Lizenz](LICENSE) veröffentlicht.

---

<!-- sebastian-software-branding:start -->
<p align="center">
  <a href="https://oss.sebastian-software.com">
    <img src="https://sebastian-brand.vercel.app/sebastian-software/logo-software.svg" alt="Sebastian Software" width="240" />
  </a>
</p>

<p align="center">
  <strong>Built by Sebastian Software</strong> — consulting for TypeScript, React &amp; Rust.<br />
  <a href="https://sebastian-software.de">Work with us</a> · <a href="https://oss.sebastian-software.com">More open source</a>
</p>

<p align="center">Copyright &copy; 2026 Sebastian Software GmbH</p>
<!-- sebastian-software-branding:end -->
