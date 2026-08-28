# Relanto Frontend

React-Router-Frontend für die Relanto-Mailer-Admin-Oberfläche.

## Stack

- React Router im SSR-Modus
- vanilla-extract für Styling
- Palamedes-Makros und Runtime für Übersetzungen
- DE/EN per Cookie-basierter Sprachumschaltung
- Pocket ID für den System-Admin-Login

## Development

```bash
pnpm install
pnpm dev
```

Relanto benötigt für lokalen und containerisierten Betrieb aktuell mindestens Node `24`. Der Backend-Pfad nutzt SQLite über einen stabilen nativen Treiber, und der Containerpfad ist darauf abgestimmt.

Lege vor dem Start eine lokale `packages/frontend/.env.development` an.

Pflichtvariablen für die lokale Admin-Session:

- `APP_SESSION_SECRET`
- `POCKET_ID_ISSUER`
- `POCKET_ID_CLIENT_ID`
- `POCKET_ID_REDIRECT_URI`
- `MAILER_SECRET_KEY`

Die vollständige Liste aller Variablen mit Defaults steht unter [Umgebungsvariablen](#umgebungsvariablen).

Für `APP_SESSION_SECRET` sollte ein ausreichend starkes Zufallssecret verwendet werden, zum Beispiel per `openssl rand -hex 32`.
Für `MAILER_SECRET_KEY` gilt dasselbe. Die Anwendung startet nicht mit fehlenden, zu kurzen oder placeholderhaften Secret-Werten.
In lokaler Entwicklung darf SQLite weiter auf `tmp/mailer.sqlite` im Repository zurückfallen.
Außerhalb lokaler Entwicklung muss `MAILER_DB_PATH` explizit gesetzt sein.

## Send-Mail-API-Limits

Die Server-API lehnt übergroße Mail-Payloads vor dem Persistieren ab.

- HTML-Body: maximal 200000 Zeichen
- Text-Body: maximal 100000 Zeichen
- Anhänge: maximal 10
- Einzelanhang: maximal 5 MiB decodiert
- Gesamte Anhangsgröße: maximal 20 MiB decodiert

## API-Scopes und Konfigurationslese-Endpunkt

Anwendungstoken können neben Versand- und Statusrechten auch den Scope `readConfig` erhalten.
Mit diesem Scope kann eine Anwendung ihre aktuell gebundene SMTP-Konfiguration über den Endpunkt lesen:

```http
GET /api/v1/config
Authorization: Bearer <access_token>
```

Der Endpunkt akzeptiert nur Anwendungstoken. System-Admin-Sessions und Application-Admin-Token werden abgewiesen.
Die Antwort enthält die SMTP-Konfiguration der Anwendung ohne SMTP-Benutzernamen und ohne Secrets.

Beispielhafte Antwort:

```json
{
  "ok": true,
  "config": {
    "id": "cfg_...",
    "applicationId": "app_...",
    "applicationAdminId": "appadm_...",
    "applicationLabel": "My Application",
    "name": "Primary SMTP",
    "host": "smtp.example.com",
    "port": 587,
    "defaultFromAddress": "mailer@example.com",
    "secure": false,
    "requireTls": true,
    "minTlsVersion": "TLSv1.2",
    "connectionTimeoutMs": 10000,
    "greetingTimeoutMs": 10000,
    "socketTimeoutMs": 20000,
    "hasPassword": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## OpenAPI-Spezifikation

Eine maschinenlesbare OpenAPI-3.1-Spezifikation liegt unter [`packages/backend/openapi.json`](../../packages/backend/openapi.json). Sie eignet sich für Client-Generierung und Contract-Tests. Mit folgendem Befehl wird sie neu erzeugt:

```bash
pnpm --filter @relanto/backend openapi:generate
```

CI und Tests erzwingen, dass die Spec stets aktuell ist und alle Routen lückenlos abdeckt.

## Umgebungsvariablen

Vollständige Referenz der von Relanto gelesenen Umgebungsvariablen. Quelle der Wahrheit sind `packages/backend/src/env.ts`, `packages/frontend/app/lib/server/oidc.server.ts` und `packages/frontend/app/lib/server/environment-validation.server.ts` (Fail-fast-Prüfung beim Boot). `NODE_ENV=development` lockert die Pflichtvariablen für den lokalen Betrieb (siehe Spalte "Erforderlich").

### Pflicht (Boot)

Fehlt eine dieser Variablen außerhalb lokaler Entwicklung, startet der Prozess nicht (Fail-fast).

| Variable                 | Erforderlich   | Default                       | Zweck                                                                                   |
| ------------------------ | -------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `APP_SESSION_SECRET`     | ja             | --                            | Secret für die verschlüsselte Admin-Session. Mindestens 32 Zeichen, kein Platzhalter.   |
| `MAILER_SECRET_KEY`      | ja             | --                            | Secret für die Signatur der Mailer-API-Tokens. Mindestens 32 Zeichen, kein Platzhalter. |
| `MAILER_DB_PATH`         | ja (außer dev) | `tmp/mailer.sqlite` (nur dev) | Pfad zur SQLite-Datei. Außerhalb dev zwingend auf persistentem Storage.                 |
| `POCKET_ID_ISSUER`       | ja             | --                            | OIDC-Issuer-URL von Pocket ID.                                                          |
| `POCKET_ID_CLIENT_ID`    | ja             | --                            | OIDC-Client-ID.                                                                         |
| `POCKET_ID_REDIRECT_URI` | ja (außer dev) | aus Request abgeleitet (dev)  | Kanonische OIDC-Callback-URL, z. B. `https://mailer.example.com/auth/callback`.         |

### OIDC (optional)

| Variable                   | Erforderlich | Default      | Zweck                                                                                                            |
| -------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `POCKET_ID_CLIENT_SECRET`  | nein         | --           | Client-Secret für einen Confidential-Client (`client_secret_post`). Ohne Wert läuft der Login als Public-Client. |
| `POCKET_ID_GROUPS_CLAIM`   | nein         | `groups`     | Name des JWT-Claims, aus dem die Gruppenzugehörigkeit gelesen wird.                                              |
| `POCKET_ID_REQUIRED_GROUP` | nein         | `superadmin` | Gruppe, in der ein Nutzer sein muss, um als System-Admin zugelassen zu werden.                                   |

### Mailer-Worker und API-Limits (optional)

Alle Werte haben Defaults; ungültige oder zu kleine Werte fallen auf den Default zurück.

| Variable                             | Erforderlich | Default    | Zweck                                                                                  |
| ------------------------------------ | ------------ | ---------- | -------------------------------------------------------------------------------------- |
| `MAILER_WORKER_INTERVAL_MS`          | nein         | `2500`     | Poll-Intervall des Worker-Loops in ms (min. 250).                                      |
| `MAILER_RETENTION_INTERVAL_MS`       | nein         | `3600000`  | Intervall des Retention-/Cleanup-Laufs in ms (min. 1000).                              |
| `MAILER_PROCESSING_TIMEOUT_MS`       | nein         | `120000`   | Timeout, nach dem ein hängender `processing`-Job zurückgeholt wird, in ms (min. 1000). |
| `MAILER_SHUTDOWN_TIMEOUT_MS`         | nein         | `10000`    | Graceful-Shutdown-Timeout in ms (min. 0).                                              |
| `MAILER_TOKEN_RATE_LIMIT_PER_MINUTE` | nein         | `30`       | Rate-Limit für `POST /api/v1/token` pro Minute (min. 1).                               |
| `MAILER_SEND_RATE_LIMIT_PER_MINUTE`  | nein         | `60`       | Rate-Limit für `POST /api/v1/send` pro Minute (min. 1).                                |
| `MAILER_MAX_REQUEST_BODY_BYTES`      | nein         | `1048576`  | Max. Body-Größe der generischen API-Routen in Bytes (1 MiB).                           |
| `MAILER_SEND_MAX_BODY_BYTES`         | nein         | `31457280` | Max. Body-Größe für `POST /api/v1/send` in Bytes (30 MiB).                             |
| `MAILER_TOKEN_MAX_BODY_BYTES`        | nein         | `32768`    | Max. Body-Größe für `POST /api/v1/token` in Bytes (32 KiB).                            |
| `API_FAILURE_RETENTION_DAYS`         | nein         | `30`       | Aufbewahrungsdauer der API-Fehlereinträge im Admin-Panel in Tagen.                     |

### Monitoring, Build und Operator-Assets (optional)

| Variable                  | Erforderlich | Default | Zweck                                                                                                                                                                         |
| ------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `METRICS_TOKEN`           | nein         | --      | Bearer-Token für `GET /metrics`. Ohne Wert antwortet der Endpunkt mit 404. Siehe [Health und Metrics](../../docs/health-and-metrics-relanto.md).                              |
| `RELANTO_GIT_SHORT_SHA`   | nein         | `dev`   | Kurzer Git-Hash für Footer und `GET /health`. Zur Build-Zeit setzen.                                                                                                          |
| `GITHUB_SHA`              | nein         | `dev`   | Fallback für `RELANTO_GIT_SHORT_SHA`, z. B. in GitHub Actions.                                                                                                                |
| `NODE_ENV`                | nein         | --      | `development` aktiviert lokale Lockerungen (SQLite-Fallback, abgeleitete Redirect-URI); in Produktion `production`.                                                           |
| `RELANTO_OPERATOR_ASSETS` | nein         | `false` | Aktiviert mit dem exakten Wert `true` die vollständig bereitgestellten Operator-Assets. Nicht gesetzt oder `false` verwendet ausschließlich die generische Relanto-Identität. |

## Deployment

Relanto wird als einzelnes Container-Image für das pnpm-Workspace gebaut und über GitHub Releases nach GHCR veröffentlicht. Während der aktuellen PR-1-Übergangsphase bleibt das GHCR-Paket privat; ein anonymer Pull wird noch nicht unterstützt oder dokumentiert.

- Ziel-Image: `ghcr.io/sebastian-software/relanto`
- Release-Quelle: `release-please`
- Build-Auslöser: erfolgreicher Release-Please-Lauf mit erzeugtem Frontend-Release
- Laufzeit: `pnpm --filter @relanto/frontend start`

Beim produktiven Start importiert Relanto vor dem eigentlichen HTTP-Server einen dedizierten Startup-Hook und startet damit den internen Mail-Worker deterministisch beim Prozessstart.
Die Verarbeitung wartender `queued`- und `retry_scheduled`-Jobs hängt damit nicht mehr vom ersten eingehenden HTTP-Request ab.

### GitHub Actions

- `.github/workflows/release-please.yml` erstellt Release-PRs und GitHub-Releases auf `main`
- derselbe Workflow baut das Release-Image genau einmal als OCI-Archiv und pusht es danach nach GHCR, wenn für `packages/frontend` ein Release erzeugt wurde
- Archiv-Checksum, Smoke-Test, Trivy-Secret-Scan und Skopeo-Publish beziehen sich auf dasselbe OCI-Archiv; der Scan belegt „keine erkannten Secrets unter den aktiven Trivy-Regeln“, nicht die absolute Abwesenheit jeglicher Secrets
- `skopeo copy --digestfile` und frische Registry-Abfragen müssen denselben OCI-Manifest-Digest für Release-Tag, `sha-<short-sha>` und `latest` bestätigen
- der Containerpfad nutzt `node:24-bookworm-slim` als aktuelle Runtime-Basis für Build und Betrieb
- das künftige vorgebaute GHCR-Image unterstützt ausschließlich `linux/amd64`

### Credential-freier lokaler Container-Start

Der primäre Installationsweg in der privaten Übergangsphase ist ein frischer Clone des öffentlichen Repositorys mit lokalem Podman-Build. Dafür sind weder npm- noch GitHub- oder Registry-Zugangsdaten erforderlich. Das Startbeispiel setzt alle sechs Pflichtvariablen; `MAILER_DB_PATH` verweist auf das persistente Volume:

```bash
git clone https://github.com/sebastian-software/relanto.git
cd relanto
podman build --build-arg RELANTO_GIT_SHORT_SHA=$(git rev-parse --short HEAD) -t ghcr.io/sebastian-software/relanto:local .

APP_SESSION_SECRET="$(openssl rand -hex 32)"
MAILER_SECRET_KEY="$(openssl rand -hex 32)"
podman volume create relanto-data
podman run --rm --name relanto \
  --publish 3000:3000 \
  --env NODE_ENV=production \
  --env APP_SESSION_SECRET="${APP_SESSION_SECRET}" \
  --env MAILER_SECRET_KEY="${MAILER_SECRET_KEY}" \
  --env MAILER_DB_PATH=/var/lib/relanto/mailer.sqlite \
  --env POCKET_ID_ISSUER=https://pocket-id.example.com \
  --env POCKET_ID_CLIENT_ID=mailer \
  --env POCKET_ID_REDIRECT_URI=http://localhost:3000/auth/callback \
  --volume relanto-data:/var/lib/relanto:U \
  ghcr.io/sebastian-software/relanto:local
```

Vor dem Start müssen `POCKET_ID_ISSUER`, `POCKET_ID_CLIENT_ID` und `POCKET_ID_REDIRECT_URI` zur eigenen Pocket-ID-Konfiguration passen. `APP_SESSION_SECRET` und `MAILER_SECRET_KEY` sind starke, zufällig erzeugte Laufzeit-Secrets. `MAILER_DB_PATH` zeigt in das persistente Volume; dadurch bleibt die SQLite-Datenbank nach einem Container-Neustart erhalten.

Docker kann alternativ denselben lokalen Build verwenden. Die beiden Secret-Variablen aus dem vorherigen Block müssen noch in derselben Shell gesetzt sein:

```bash
docker build --build-arg RELANTO_GIT_SHORT_SHA=$(git rev-parse --short HEAD) -t ghcr.io/sebastian-software/relanto:local .
docker volume create relanto-data
docker run --rm --name relanto \
  --publish 3000:3000 \
  --env NODE_ENV=production \
  --env APP_SESSION_SECRET="${APP_SESSION_SECRET}" \
  --env MAILER_SECRET_KEY="${MAILER_SECRET_KEY}" \
  --env MAILER_DB_PATH=/var/lib/relanto/mailer.sqlite \
  --env POCKET_ID_ISSUER=https://pocket-id.example.com \
  --env POCKET_ID_CLIENT_ID=mailer \
  --env POCKET_ID_REDIRECT_URI=http://localhost:3000/auth/callback \
  --volume relanto-data:/var/lib/relanto \
  ghcr.io/sebastian-software/relanto:local
```

Der Standardpfad mit `pnpm install`, `pnpm --filter @relanto/frontend build` und dem Container-Build benötigt keine privaten npm-Zugangsdaten und keine geheime Build-Konfiguration. Anwendungs- und OIDC-Secrets werden ausschließlich beim Start übergeben und dürfen nicht in Build-Argumente, Image-Layer, Labels oder den Build-Kontext gelangen. Sollten spätere Builds Zugangsdaten benötigen, dürfen sie ausschließlich über kurzlebige BuildKit-Secret-Mounts eingebunden werden. Das Standard-Image enthält keine Operator-Assets und keine Schriftdateien.

Der lokale Quell-Build bleibt auch nach einer späteren GHCR-Freigabe der Fallback. Er ist jedoch keine Zusage, dass Relanto auf ARM oder anderen Architekturen unterstützt wird.

Der Footer im Admin-Frontend zeigt die laufende Frontend-Version zusammen mit dem kurzen Git-Hash im Format `vX.Y.Z-<hash>`. Im Containerpfad kommt der Hash über `RELANTO_GIT_SHORT_SHA`.

### Übergang zur öffentlichen GHCR-Nutzung

Die Sichtbarkeit darf erst geändert werden, wenn der gehärtete Workflow auf `main` gemergt ist, ein realer Release alle Archiv-, Trivy-, Skopeo- und Digest-Gates bestanden hat, das Package exakt mit `sebastian-software/relanto` verknüpft ist, der aktuelle Release-Workflow den erforderlichen Package-Zugriff besitzt und unmittelbar davor frisch gelesene Metadaten weiterhin exakt `private` melden. Danach führt ein autorisierter Operator den bereits genehmigten, irreversiblen Wechsel von `private` zu `public` einmalig unter **Package settings** → **Danger Zone** → **Change visibility** aus. GitHub dokumentiert dafür keinen REST- oder GraphQL-Mutationsendpunkt; der Workflow versucht keine Sichtbarkeitsänderung.

Der abschließende Read-only-Metadatencheck des Workflows akzeptiert ausschließlich die bekannten Zustände `private` und `public`. Dadurch bleiben spätere Releases nach der Freigabe möglich; die zusätzliche `private`-Prüfung ist nur die Vorbedingung der erstmaligen manuellen Umstellung.

Nach dem UI-Schritt muss ein anonymer Pull ohne Login oder Token für `linux/amd64` real erfolgreich sein. Erst ein späterer PR 2 darf diesen Pull als normalen Installationsweg dokumentieren. Das vollständige Verfahren und die erforderlichen Nachweise stehen im [Runbook zur GHCR-Image-Sichtbarkeit](../../docs/ghcr-image-visibility.md).

### Optionale Operator-Assets

Ohne `RELANTO_OPERATOR_ASSETS` oder mit `RELANTO_OPERATOR_ASSETS=false` verwendet Relanto die MIT-lizenzierte generische Identität: Systemschriften, die textbasierte Relanto-Wortmarke und das Relanto-`R` als SVG-Favicon. In diesem Modus fordert die Anwendung keine Dateien unter `/operator-assets/` an.

Nur der exakte Wert `RELANTO_OPERATOR_ASSETS=true` aktiviert die Operator-Identität. Andere Werte sind ungültig. Bei aktiviertem Overlay bindet Relanto das Operator-Stylesheet nach den Anwendungsstyles ein, zeigt im Dashboard das Operator-Logo und verwendet das Operator-SVG-Favicon. Im Produktivbetrieb schlägt der Start fehl, wenn eine der drei Pflichtdateien fehlt, nicht lesbar oder kein reguläres File ist; es gibt dann keinen stillen Rückfall auf die generische Identität.

Das vollständig vorbereitete Verzeichnis wird read-only an genau diesem Containerpfad eingebunden:

```text
/app/build/client/operator-assets
```

Im Wurzelverzeichnis des Mounts sind genau diese Dateien erforderlich:

- `theme.css`
- `logo-software.svg`
- `favicon.svg`

Weitere Dateien sind nur als lokale Abhängigkeiten dieser drei Dateien zulässig, zum Beispiel Schriftdateien in einem Unterverzeichnis. Jede Datei im gemounteten Verzeichnis ist ohne zusätzliche Zugriffskontrolle öffentlich unter `/operator-assets/` abrufbar. Lizenzbelege, Zugangsdaten, Quellpakete und nicht benötigte Dateien dürfen deshalb niemals in diesem Verzeichnis liegen.

Der Operator ist für die erforderlichen Nutzungsrechte und die vollständige Bereitstellung verantwortlich. Erst wenn alle Pflichtdateien, alle referenzierten Schriftdateien und die folgende CSS-Prüfung erfolgreich sind, darf `RELANTO_OPERATOR_ASSETS=true` gesetzt werden.

#### Vertrag für `theme.css`

Das Stylesheet darf lokale `@font-face`-Regeln mit `font-display: swap` enthalten und in `:root` ausschließlich diese sieben Custom Properties setzen:

- `--relanto-font-body`
- `--relanto-font-display`
- `--relanto-font-accent`
- `--relanto-color-night`
- `--relanto-color-base`
- `--relanto-color-bright`
- `--relanto-color-paper`

Minimales Schema:

```css
@font-face {
  font-display: swap;
  font-family: "Operator Body";
  src: url("./fonts/operator-body.woff2") format("woff2");
}

:root {
  --relanto-font-body: "Operator Body", system-ui, sans-serif;
  --relanto-font-display: "Operator Body", system-ui, sans-serif;
  --relanto-font-accent: ui-serif, Georgia, serif;
  --relanto-color-night: #17243a;
  --relanto-color-base: #304c67;
  --relanto-color-bright: #b88736;
  --relanto-color-paper: #f4efe2;
}
```

`theme.css` ist vertrauenswürdige, vom Operator kontrollierte Deployment-Eingabe; Relanto bereinigt sie nicht zur Laufzeit. Die Bereitstellung muss das Stylesheet vor dem Aktivieren ablehnen, sobald eine der folgenden Bedingungen zutrifft:

- eine `@import`-Regel;
- eine Remote-, protokollrelative oder `data:`-URL;
- ein Schriftpfad, der relativ ausgewertet das gemountete Verzeichnis verlässt;
- eine andere Regel oder ein anderer Selektor als lokale `@font-face`-Regeln und `:root` mit genau den sieben erlaubten Properties.

Schrift-URLs müssen relativ zu `theme.css` bleiben. Damit werden sie unter demselben Origin aus `/operator-assets/` geladen und können nicht auf ein externes Ziel oder aus dem gemounteten Verzeichnis heraus zeigen.

#### Prüfung nach dem Deployment

Nach dem Neustart müssen alle festen Dateien per HTTP 200 mit dem passenden MIME-Typ erreichbar sein:

```bash
RELANTO_BASE_URL=https://relanto.example
curl --fail --silent --show-error --output /dev/null --dump-header - "$RELANTO_BASE_URL/operator-assets/theme.css"
curl --fail --silent --show-error --output /dev/null --dump-header - "$RELANTO_BASE_URL/operator-assets/logo-software.svg"
curl --fail --silent --show-error --output /dev/null --dump-header - "$RELANTO_BASE_URL/operator-assets/favicon.svg"
```

Erwartet werden `text/css` für `theme.css` und `image/svg+xml` für beide SVG-Dateien. Jede relative Schrift-URL aus `theme.css` muss anschließend unter dem daraus resultierenden Pfad geprüft werden, zum Beispiel:

```bash
curl --fail --silent --show-error --output /dev/null --dump-header - "$RELANTO_BASE_URL/operator-assets/fonts/operator-body.woff2"
```

Für eine WOFF2-Datei werden HTTP 200 und `font/woff2` erwartet. Abschließend im Browser prüfen, dass keine Asset-Anfrage fehlschlägt, das Operator-Logo und -Favicon sichtbar sind und die berechneten `font-family`-Werte repräsentativer Body-, Display- und Accent-Texte die konfigurierten Familien enthalten. Für jede per `@font-face` definierte Familie kann zusätzlich `document.fonts.check('16px "Operator Body"')` in der Browserkonsole geprüft werden.

Wenn der produktive Start fehlschlägt, entweder das Overlay deaktivieren und mit der generischen Identität neu starten oder den vollständigen read-only Mount korrigieren und danach neu starten.

### Quadlet

Ein Beispiel für Podman/Quadlet liegt unter `deploy/quadlet/relanto.container.example`.
Die dortigen Secret-Werte sind absichtlich ungültige Platzhalter und müssen vor dem ersten Start ersetzt werden.

Vor dem produktiven Start müssen mindestens diese Umgebungsvariablen gesetzt werden:

- `APP_SESSION_SECRET`
- `MAILER_DB_PATH`
- `MAILER_SECRET_KEY`
- `POCKET_ID_ISSUER`
- `POCKET_ID_CLIENT_ID`
- `POCKET_ID_REDIRECT_URI`

Alle weiteren, optionalen Variablen (OIDC-Gruppen, Worker-Intervalle, Rate-Limits, Body-Limits, `METRICS_TOKEN`, Git-Hash) mit Defaults sind unter [Umgebungsvariablen](#umgebungsvariablen) dokumentiert.

Optional steuert `API_FAILURE_RETENTION_DAYS` die Aufbewahrungsdauer der API-Fehlereinträge im Admin-Panel.
Default sind 30 Tage; ältere Einträge werden vom Worker-Cleanup entfernt.

Das Admin-Panel zeigt unter `/api-failures` 4xx-Antworten der API mit Methode, Pfad, HTTP-Status, Ursachen-Kategorie und optional Application-Bezug.
Persistiert werden nur HTTP-Status, Pfad, Methode, Ursache und kontrollierte Detailfelder (z. B. Issue-Pfade aus Zod). Niemals Request-Bodies, Header oder Tokenmaterial.

Außerhalb lokaler Entwicklung startet der OIDC-Login fail-closed nicht ohne explizite `POCKET_ID_REDIRECT_URI`.
Die Redirect-URI wird dann nicht mehr aus dem eingehenden Request-Host abgeleitet, sondern muss kanonisch konfiguriert sein, zum Beispiel:

- `POCKET_ID_REDIRECT_URI=https://mailer.example.com/auth/callback`

Relanto ist im aktuellen Schnitt für Single-Instance-Betrieb mit lokaler SQLite-Datei ausgelegt.
Für produktive Deployments muss die Datenbankdatei auf persistentem Storage liegen, zum Beispiel:

- `MAILER_DB_PATH=/var/lib/relanto/mailer.sqlite`
- `Volume=relanto-data:/var/lib/relanto`

Ein Container-Neustart darf damit die SQLite-Datei nicht verlieren. Mehrere parallele Replikate mit derselben lokalen SQLite-Datei sind nicht unterstützt.
Da der Worker im selben Prozess wie der Webserver läuft, startet die Queue-Verarbeitung nach jedem Prozess- oder Container-Neustart automatisch wieder mit dem Server.

### Backup und Restore der persistenten Daten

Die persistenten Relanto-Daten liegen im named volume `relanto-data`.
Backup und Restore laufen vom Host aus über die Skripte unter `deploy/`.

Backup:

```bash
deploy/backup-relanto-data.sh
```

Optional mit eigenem Zielpfad:

```bash
deploy/backup-relanto-data.sh ./backups/relanto-$(date +%Y%m%d-%H%M%S).tar.gz
```

Restore:

1. Relanto stoppen, zum Beispiel per Quadlet:

```bash
systemctl --user stop relanto.service
```

2. Backup in das named volume zurückspielen:

```bash
deploy/restore-relanto-data.sh --yes ./backups/relanto-20260330-120000.tar.gz
```

3. Relanto wieder starten:

```bash
systemctl --user start relanto.service
```

Hinweise:

- Restore überschreibt den aktuellen Inhalt des Volumes `relanto-data`.
- Gesichert werden die persistenten App-Daten im Volume, aktuell insbesondere `mailer.sqlite`.
- Secrets, Quadlet-Dateien und andere Host-Konfigurationen sind nicht Teil dieses Backups.

Die GHCR-Package-Sichtbarkeit selbst wird in GitHub verwaltet. Während der PR-1-Übergangsphase bleibt das Package privat; der Release-Workflow pusht nach `ghcr.io/sebastian-software/relanto`, ändert die Sichtbarkeit aber nicht.

Der pnpm-Workspace gibt Native-Builds bewusst nur für `better-sqlite3` frei, und der Docker-Build führt danach explizit `pnpm rebuild better-sqlite3` plus einen kurzen Import-Smoke-Test aus. Damit scheitert der GitHub-Actions-Pfad früh, falls die SQLite-Bindings nicht wirklich gebaut wurden.

## Internationalization

- Quell-Sprache ist `en`
- Übersetzungen liegen unter `app/locales/en.po` und `app/locales/de.po`
- Laufzeit und Makros kommen aus Palamedes
- Die benötigten Palamedes-Pakete sind im Workspace lokal eingebunden, damit die
  React-Router-Integration dem aktuellen Upstream-Stand folgt, ohne direkte `@lingui/*`-Imports im App-Code.
