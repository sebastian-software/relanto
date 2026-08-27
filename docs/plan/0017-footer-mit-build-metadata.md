# 0017 Footer mit Build-Metadaten

**Planungsstatus:** Umgesetzt

## Anforderung

Im Admin-Frontend soll ein Footer erscheinen, der Copyright fuer Sebastian Software GmbH sowie
die laufende Frontend-Version und den kurzen Git-Hash anzeigt. Version und Hash sollen im Format
`vX.Y.Z-<hash>` erscheinen.

## Architekturentscheidungen

- Der Footer wird global im Root-Layout gerendert, damit er auf allen Seiten des Frontends
  erscheint.
- Die Versionsnummer kommt aus `packages/frontend/package.json`.
- Der Git-Hash wird produktivtauglich ueber `RELANTO_GIT_SHORT_SHA` in den Containerpfad
  injiziert.
- Fuer lokale oder unvollstaendige Umgebungen bleibt der Hash fail-soft mit einem Fallback
  verfügbar.

## Betroffene Dateien

| Datei                                                       | Beschreibung                                           |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `packages/frontend/app/lib/server/build-metadata.server.ts` | Serverseitige Ableitung von Footer-Metadaten           |
| `packages/frontend/app/root.tsx`                            | Loader und globaler Footer                             |
| `packages/frontend/app/root.css.ts`                         | Footer-Styling                                         |
| `packages/frontend/app/root.test.tsx`                       | Regressionen fuer Format und Rendering                 |
| `Dockerfile`                                                | Build-Arg und Runtime-Env fuer `RELANTO_GIT_SHORT_SHA` |
| `.github/workflows/release-please.yml`                      | Uebergabe des Git-Hashs an den Container-Build         |
| `packages/frontend/README.md`                               | Hinweis auf lokalen Build-Arg und Footer-Metadaten     |

## Implementierungsdetails

- Der Footer zeigt aktuell in 2026 `Copyright 2026 Sebastian Software GmbH`.
- Fuer spaetere Jahre wird automatisch `2026-<Jahr>` gebildet.
- Das Build-Label wird als `v${version}-${shortHash}` zusammengesetzt.
- Im GHCR-/Docker-Pfad wird der Hash ueber `${{ github.sha }}` eingespeist und auf sieben Zeichen
  gekuerzt.

## Testergebnisse

- `pnpm --filter @relanto/frontend test -- app/root.test.tsx`
- `pnpm agent:check`

## Review-Findings und Behebung

- Keine offenen Findings.
