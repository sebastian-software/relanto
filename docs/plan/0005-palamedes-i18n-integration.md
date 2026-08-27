# 0005 Palamedes I18n Integration

**Planungsstatus:** Umgesetzt

## Ausgangszustand

Das Frontend hatte bisher keine Uebersetzungsstruktur. Alle sichtbaren Texte in Root, Login und Dashboard waren hart codiert. Es gab weder Locale-Erkennung noch Sprachpersistenz oder Kataloge.

## Ziel

Die Admin-Oberflaeche soll DE und EN unterstuetzen und Palamedes fuer Runtime und Makro-Transformation nutzen. Direkte `@lingui/*`-Imports im App-Code sollen vermieden werden.

## Umsetzung

- vendorte Workspace-Pakete fuer:
  - `@palamedes/core`
  - `@palamedes/react`
  - `@palamedes/config`
- Frontend-Integration mit:
  - `@palamedes/runtime`
  - `@palamedes/vite-plugin`
- neue i18n-Laufzeit in:
  - `packages/frontend/app/lib/i18n/`
- SSR- und Client-Bootstrap:
  - Root-Loader aktiviert die Server-Locale
  - `app/entry.client.tsx` synchronisiert die Client-Locale vor Hydration
- Sprachumschaltung ueber Cookie und neue Route:
  - `packages/frontend/app/routes/set-locale.ts`
- Uebersetzungskataloge:
  - `packages/frontend/app/locales/en.po`
  - `packages/frontend/app/locales/de.po`
- sichtbare Root-, Login- und Dashboard-Texte auf Palamedes-Makros umgestellt

## Architekturentscheidungen

- keine URL-basierten Locale-Segmente
- Locale-Aufloesung ueber Cookie, dann `Accept-Language`, dann Fallback `en`
- `en` bleibt Source Locale
- Backend/API-Texte bleiben unveraendert

## Kompatibilitaetshinweis

Das offizielle React-Router-Beispiel auf GitHub nutzt bereits Palamedes-eigene Runtime- und Macro-Imports ohne direkte Lingui-Referenzen im App-Code. Die aktuell veroeffentlichte `@palamedes/vite-plugin`-Version erwartet fuer ihre Build-Konfiguration jedoch weiterhin eine `lingui.config.ts`. Diese Datei wurde deshalb als Tooling-Kompatibilitaet ergaenzt, ohne den Anwendungs-Code auf Lingui umzustellen.

## Verifikation

- `pnpm --filter @relanto/frontend typecheck`
- `pnpm agent:check`
