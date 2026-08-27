# GHCR-Image-Sichtbarkeit -- Runbook

Kurzes Betriebs-Runbook zur Sichtbarkeit des Container-Images `ghcr.io/sebastian-software/relanto`.

## Vorgabe

Das Container-Image `ghcr.io/sebastian-software/relanto` MUSS `private` bleiben. Die MIT-Lizenzierung des Quellcodes ändert die bestehende Sichtbarkeit des Container-Pakets nicht automatisch. Eine Veröffentlichung des Images bleibt eine separate Entscheidung.

## Sichtbarkeit prüfen

```bash
gh api /orgs/sebastian-software/packages/container/relanto --jq .visibility
```

Der Befehl gibt `private` oder `public` zurück. Er erfordert für das `gh`-Token den Scope `read:packages`. Fehlt der Scope, ergänzt man ihn mit:

```bash
gh auth refresh -h github.com -s read:packages
```

## Sichtbarkeit auf privat setzen (falls nötig)

Über die GitHub-UI:

- Organisation `sebastian-software` → **Packages** → `relanto` → **Package settings** → **Change visibility** → **Private**

Alternativ über den entsprechenden API-Weg der GitHub-Packages-API.

## Statusnotiz

Am 2026-07-06 verifiziert: Die Sichtbarkeit des Images ist `private`.
