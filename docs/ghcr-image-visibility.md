# GHCR-Image-Sichtbarkeit – Runbook für die private Übergangsphase

Dieses Runbook beschreibt den einmaligen, bereits genehmigten Wechsel des Container-Pakets `ghcr.io/sebastian-software/relanto` von `private` zu `public`. Bis alle folgenden Nachweise vorliegen, bleibt das Paket privat. Ein anonymer Pull ist in dieser Phase nicht zugesichert.

## Ausgangslage

- Das GHCR-Paket ist `private`.
- Die Paketmetadaten verknüpfen es derzeit fälschlich mit `sebastian-software/relanto-deprecated` statt mit `sebastian-software/relanto`.
- Das künftige vorgebaute Image unterstützt ausschließlich `linux/amd64`.
- Der öffentliche Quellcode bleibt der credential-freie Fallback. Ein lokaler Build ist jedoch keine Zusage für ARM-Unterstützung.

## 1. Gehärteten Workflow auf `main` bringen

Die geänderte `.github/workflows/release-please.yml` muss zuerst auf `main` gemergt sein. Eine Ausführung aus einem Feature-Branch oder mit einem älteren Workflow erfüllt dieses Gate nicht.

Der erste reale Frontend-Release danach muss in einem einzigen Release-Build genau ein OCI-Archiv erzeugen. Smoke-Test, Secret-Scan und Veröffentlichung müssen dieses unveränderte Archiv verwenden. Der Release-Nachweis muss Folgendes enthalten:

1. den exakten SHA-256-Byte-Checksum-Wert von `relanto-release.oci.tar` und erfolgreiche erneute Prüfungen nach Smoke-Test, nach Scan und unmittelbar vor dem Push;
2. den ausgewählten OCI-Manifest-Digest im Format `sha256:<64 hexadezimale Zeichen>`;
3. eine fehlgeschlagene Trivy-Positivkontrolle mit einem absichtlich eingebrachten Test-Secret;
4. einen grünen Trivy-Scan des Release-Archivs mit der präzisen Aussage „keine erkannten Secrets unter den aktiven Trivy-Regeln“ – nicht die absolute Abwesenheit jeglicher Secrets;
5. den von `skopeo copy --digestfile` geschriebenen Digest und dessen Gleichheit mit dem ausgewählten OCI-Manifest-Digest;
6. frische Registry-Abfragen, nach denen Release-Tag, `sha-<short-sha>` und `latest` auf exakt denselben Digest zeigen.

Fehlt ein Nachweis oder weichen Archiv-Checksum beziehungsweise Digests ab, endet der Übergang fail-closed. Die Sichtbarkeit bleibt privat.

## 2. Paketverknüpfung und Workflow-Zugriff korrigieren

Vor der Freigabe muss ein autorisierter Operator in den GitHub Package Settings:

1. die falsche Repository-Verknüpfung `sebastian-software/relanto-deprecated` entfernen;
2. das Paket mit exakt `sebastian-software/relanto` verknüpfen;
3. unter **Manage Actions access** dem Repository `sebastian-software/relanto` den für den aktuellen Release-Workflow erforderlichen Paket-Zugriff gewähren.

Danach den Release-Gate erneut frisch ausführen. Sein abschließender Read-only-Metadatencheck mit dem `GITHUB_TOKEN` des Release-Workflows muss erfolgreich sein. Dieser allgemeine Release-Check akzeptiert ausschließlich die bekannten Zustände `private` und `public`, damit spätere Releases auch nach der Freigabe möglich bleiben; er ändert die Sichtbarkeit nie. Für die erstmalige manuelle Umstellung müssen die unmittelbar davor separat und frisch gelesenen Paketmetadaten zusätzlich exakt `private` und `sebastian-software/relanto` melden:

```bash
gh api --method GET \
  /orgs/sebastian-software/packages/container/relanto \
  --jq '{visibility: .visibility, repository: .repository.full_name}'
```

Erwartet:

```json
{ "repository": "sebastian-software/relanto", "visibility": "private" }
```

Der erfolgreiche Abruf im Release-Workflow belegt zugleich, dass dessen aktueller `GITHUB_TOKEN` auf das Paket zugreifen kann. Bei einem anderen Repository, fehlendem Workflow-Zugriff oder einer anderen Sichtbarkeit als `private` darf die erstmalige manuelle Umstellung nicht erfolgen.

## 3. Einmalig über die GitHub-UI auf öffentlich stellen

GitHub dokumentiert keinen REST- oder GraphQL-Endpunkt zum Ändern der Sichtbarkeit eines Container-Pakets. Deshalb gibt es für diesen Schritt keine API-Mutation und keine Workflow-Automatisierung.

Ein autorisierter Operator führt die bereits genehmigte Änderung ausschließlich in der GitHub-UI aus:

1. Organisation `sebastian-software` → **Packages** → `relanto` öffnen.
2. **Package settings** öffnen.
3. Unter **Danger Zone** **Change visibility** wählen.
4. **Public** wählen, den Paketnamen zur Bestätigung eingeben und die Konsequenzen bestätigen.

Der Wechsel von `private` zu `public` ist irreversibel: GitHub erlaubt anschließend keinen Wechsel zurück zu `private`. Dieser Schritt setzt die bestehende Freigabe um; er ist keine neue Produktentscheidung.

## 4. Anonymen `linux/amd64`-Pull nachweisen

Unmittelbar nach dem UI-Schritt muss ein Pull ohne Login und ohne Token aus einer absichtlich leeren Docker-Konfiguration erfolgreich sein. `<release-tag>` durch den im Release-Gate geprüften unveränderlichen Release-Tag ersetzen:

```bash
anonymous_docker_config="$(mktemp -d)"
trap 'rm -rf -- "$anonymous_docker_config"' EXIT
DOCKER_CONFIG="$anonymous_docker_config" \
  docker pull --platform linux/amd64 \
  ghcr.io/sebastian-software/relanto:<release-tag>
```

Ein Treffer aus einem lokalen Image-Cache genügt nicht; der Test muss den Manifest- und Layer-Abruf aus GHCR zeigen. Scheitert der anonyme Pull, bleibt der Übergang unvollständig und darf nicht als öffentlich nutzbar dokumentiert werden.

## 5. Dokumentationsgrenze

Erst ein späterer PR 2 darf den anonymen GHCR-Pull als normalen Installationspfad dokumentieren. Voraussetzung sind die realen Post-Merge-Nachweise aus diesem Runbook: Release-Gate, korrigierte Repository-Verknüpfung, aktueller Workflow-Zugriff, UI-Änderung und erfolgreicher anonymer `linux/amd64`-Pull.

Issue #6 bleibt bis zu diesem PR 2 funktional offen. Vorher bleibt der credential-freie öffentliche Git-Clone mit lokalem Container-Build der primäre Weg; dafür sind keine npm-, GitHub- oder Registry-Zugangsdaten erforderlich.

## Verhalten bei späteren Release-Fehlern

- Der abschließende Read-only-Metadatencheck akzeptiert bei späteren Releases `private` oder `public`, verlangt aber immer die exakte Repository-Verknüpfung und den funktionierenden Workflow-Zugriff. Er nimmt keine Änderung an der Paketsichtbarkeit vor.
- Ein unveränderlicher Release-Tag darf nie auf einen anderen Digest überschrieben werden. Ein abweichender vorhandener Digest beendet den Lauf fail-closed.
- Zeigt der Release-Tag bereits auf den geprüften Digest, ist er die kanonische Quelle. Fehlende oder abweichende `sha-<short-sha>`- und `latest`-Tags werden idempotent mit `skopeo copy --preserve-digests` von diesem unveränderlichen Digest abgeglichen.
- Die Tag-Abstimmung baut kein zweites Image und löscht keine bereits gültigen Tags. Nach jedem Abgleich werden alle drei Digests frisch gelesen und auf Gleichheit geprüft.
- Zugangsdaten für künftige Builds dürfen nur über kurzlebige BuildKit-Secret-Mounts eingebunden werden. Anwendungs- und OIDC-Secrets bleiben reine Laufzeitkonfiguration und gehören weder in Build-Argumente noch in Images oder Labels.
