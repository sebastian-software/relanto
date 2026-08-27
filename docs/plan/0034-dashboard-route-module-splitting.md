# 0034: Route-Modul-Splitting für `dashboard.tsx`

**Planungsstatus:** Nicht umgesetzt
**Empfohlener Workflow:** /refactor

## Anforderung

Das React-Router-7-Future-Flag `v8_splitRouteModules` ist aktiv, bringt für die Dashboard-Route bisher aber keinen Splitting-Effekt. Dieser Plan dokumentiert den Befund aus dem Review-Report [`review-report-2026-06-08-rr7-future-flags.md`](../../.sf-plugin/review/review-report-2026-06-08-rr7-future-flags.md) (Finding R-0000004) und legt zwei Optionen für das weitere Vorgehen vor. Ziel ist eine bewusste Entscheidung darüber, ob und wann der Aufwand für eine echte Trennung von Server- und Client-Code investiert wird.

## Ist-Zustand / Befund

- `packages/frontend/react-router.config.ts` setzt `v8_splitRouteModules: true`. Für kleinere Routen (z. B. `routes/login`, `routes/dashboard.api-failures`) funktioniert das Splitting wie erwartet.
- `packages/frontend/app/routes/dashboard.tsx` ist mit aktuell 2.898 Zeilen ein Monolith und enthält `loader` (Z. 868), `action` (Z. 888) sowie den Default-Export (Z. 1462) in derselben Datei.
- Build-Manifest (`build/client/assets/manifest-42a0d190.js`) für die Dashboard-Route:

  ```text
  "routes/dashboard": {
    "hasAction": true,
    "hasLoader": true,
    "hasDefaultExport": true,
    "module": "/assets/dashboard-Bocl3gHa.js",
    ...
  }
  ```

  Es existiert nur ein einziger Modul-Pfad — keine separaten `loader`/`action`/`Component`-Chunks.

- Die resultierende Bundle-Datei `dashboard-Bocl3gHa.js` ist ca. 31 KB (gzipped ca. 7,65 KB).
- **Primärer Blocker:** Der Translation-Tag `t` aus `packages/frontend/app/lib/i18n/tag.ts` wird in `dashboard.tsx` auf Z. 42 importiert und sowohl im `action`-Branch (für `t`Notice`-Strings) als auch in 100+ JSX-Template-Literalen im Component-Body verwendet. Da `t` ein Top-Level-Identifier ist, kann Vite/Rollup die Datei nicht modulweit in Server- und Client-Hälften trennen.
- **Sekundäre Blocker:** `activateServerI18n` (Z. 40) und `resolveLocaleFromRequest` (Z. 41) werden im `action`/`loader` verwendet, sind aber ebenfalls Top-Level-Imports der Datei und verhindern, dass die Server-Hälfte komplett aus dem Client-Chunk fällt. Sie sind in der Praxis weniger relevant als `t`, weil sie zumindest nicht im Component-Body referenziert werden — das Problem bleibt dennoch, solange die Datei eine Einheit ist.

Damit ist `dashboard.tsx` bisher der einzige messbare Fall, in dem das Future-Flag wirkungslos bleibt. Das Flag selbst ist korrekt aktiviert und für alle anderen Routen wirksam.

## Optionen

### Option A: Status quo akzeptieren

Keine Code-Änderung. Der 31-KB-Chunk bleibt bestehen, das Future-Flag liefert für `dashboard.tsx` keinen messbaren Nutzen.

**Pro:**

- Kein Risiko von Regressionen in einer der komplexesten Routen des Projekts.
- Kein Aufwand für eine umfangreiche Datei-Aufteilung.
- 31 KB (gzipped 7,65 KB) sind für eine systemadmin-only Route ohne kritisches Performance-Budget vertretbar.
- Der bestehende `eslint-disable`-Kommentar am Datei-Kopf signalisiert bereits, dass ein größerer UI-Refactor bewusst aufgeschoben wurde.

**Contra:**

- `v8_splitRouteModules` bleibt für die größte Route ohne Effekt.
- Bei weiterem Wachstum der Datei wächst auch der Client-Chunk linear mit.

**Wann wählen:** Solange keine konkrete Performance-Anforderung an die Dashboard-Route besteht und keine andere Motivation für einen UI-Refactor existiert.

### Option B: Komponenten-Extraktion

Die Datei wird in mehrere Module aufgeteilt, sodass der `loader`/`action`-Teil von den Component-Teilen klar getrennt ist und Vite/Rollup tatsächlich separate Chunks erzeugen kann.

**Was bewegt werden muss:**

- Alle Sub-Komponenten mit `t`-Aufrufen (`ConfigForm`, `RenameForm`, `TokenForm`, `Dashboard` selbst) in eigene Dateien unter `packages/frontend/app/routes/dashboard/` ausgliedern.
- Die geteilten Helper (`getFormKeyFor…`, `getFormState`, `getFormResetKey`, `formatTimestamp` etc.) in `dashboard/lib/` extrahieren.
- `loader` und `action` sowie deren server-only Imports (`activateServerI18n`, `resolveLocaleFromRequest`, `requireSystemAdminUser`, `ensureRuntimeStarted`, Backend-Service-Calls) in einer dünnen `dashboard.tsx` belassen; diese Datei re-exportiert `default` aus einem Client-Modul.
- Konsequenz: `t` wird im Server-Teil entweder gar nicht mehr verwendet (Notice-Strings über Lookup-Tabellen oder serverseitige `t`-Variante) oder über einen lokalen Import isoliert.

**Aufwandsschätzung:** groß (Touch auf ~2.900 Zeilen, mehrere Sub-Komponenten, Anpassung aller Form-State-Tests, Risiko von subtilen Render-/State-Regressionen).

**Erwarteter Gewinn:**

- Server-only Code (Backend-Service-Imports, i18n-Server-Setup) verschwindet aus dem Client-Bundle.
- `dashboard-*.js`-Chunk wird kleiner und in `loader`/`action`/`Component`-Chunks aufgeteilt.
- Bessere Wartbarkeit der einzelnen Sub-Komponenten als Seiteneffekt.
- Der vorhandene `eslint-disable`-Kommentar mit `max-lines`/`max-lines-per-function`/`complexity` kann zurückgebaut werden.

**Wann wählen:** Wenn ohnehin ein größerer UI-Refactor der Dashboard-Route ansteht (z. B. neue Sektion, neues Layout) oder wenn das Performance-Budget für `/dashboard` perspektivisch enger wird.

## Empfehlung

**Option A (Status quo)** als Default. Begründung:

- Die dominante Größe von `dashboard.tsx` ist nicht das Chunk-Splitting, sondern die monolithische Struktur der Komponente selbst. Ein Splitting allein, ohne den ohnehin nötigen UI-Refactor, würde nur die Verpackung ändern, nicht den Inhalt.
- 31 KB für eine selten genutzte Admin-Route sind kein akuter Engpass.
- Der Risikofaktor eines 2.900-Zeilen-Refactors ist hoch und sollte mit einer realen UI-Motivation gekoppelt sein.

**Option B** sollte bewusst geplant werden, sobald ohnehin größere Dashboard-Änderungen anstehen — dann lassen sich Komponenten-Extraktion und Route-Splitting in einem Zug umsetzen. Ein eigenständiger Plan rein für das Splitting wird nicht empfohlen.

## Akzeptanzkriterien

Nur relevant, wenn Option B aktiv umgesetzt wird:

- [ ] Build-Manifest enthält für `routes/dashboard` separate Chunks für `loader`, `action` und `Component` (statt eines einzigen `module`-Eintrags).
- [ ] Der Client-Chunk für die Dashboard-Komponente enthält keine Backend-Service-Imports mehr (verifizierbar per Source-Map oder Chunk-Inspektion).
- [ ] `pnpm agent:check` läuft ohne neue Fehler oder Warnings durch.
- [ ] Manueller Smoke-Test im Dev-Server: alle Form-Aktionen (Create-/Rename-/Token-/Config-Flows) funktionieren wie vorher, Filter- und Aufklapp-State bleibt erhalten.
- [ ] Der `eslint-disable`-Header in `dashboard.tsx` ist mindestens für die Regeln zurückgebaut, deren Verletzung durch die Extraktion entfällt (z. B. `max-lines`, `max-lines-per-function`).

## Betroffene Dateien

| Datei                                                            | Beschreibung                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/frontend/app/routes/dashboard.tsx`                     | Aktueller Monolith mit `loader`, `action`, Default-Export und allen Sub-Komponenten. Bei Option B würde dieser Re-Export-Stub. |
| `packages/frontend/app/lib/i18n/tag.ts`                          | Liefert `t` — primärer Splitting-Blocker durch Verwendung in Server- und Client-Code derselben Datei.                          |
| `packages/frontend/react-router.config.ts`                       | Setzt `v8_splitRouteModules: true`. Bleibt in beiden Optionen unverändert.                                                     |
| `packages/frontend/build/client/assets/manifest-*.js`            | Build-Output zur Verifikation, dass tatsächlich separate Chunks entstehen (nur Option B).                                      |
| `.sf-plugin/review/review-report-2026-06-08-rr7-future-flags.md` | Quelle des Findings R-0000004.                                                                                                 |
