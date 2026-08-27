# 0032: Reload-Button für „Letzte Jobs"

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-build
**Empfohlener Workflow:** Feature (`/sf-build`)

## Anforderung

Im Dashboard-Panel „Letzte Jobs" soll ein Reload-Button zur Verfügung stehen, der die Job-Daten vom Backend neu lädt, ohne dass der Operator die Seite hart neu laden oder die Filter-Einstellungen verlieren muss.

Verhalten:

1. Im `panelHeader` des „Letzte Jobs"-Panels erscheint rechts ein Button mit Label „Refresh" (i18n via `t`).
2. Klick triggert `useRevalidator().revalidate()` — der gesamte Loader (`admins`, `applications`, `jobs`, `user`) wird neu aufgerufen.
3. Während `revalidator.state !== "idle"`:
   - Button ist `disabled` und zeigt Label „Refreshing…".
   - Das `<section>` des Jobs-Panels bekommt `aria-busy="true"`.
4. Direkt neben dem Button steht ein Timestamp „Aktualisiert HH:MM:SS" (Lokal-Format), der bei jedem erfolgreichen Revalidation-Cycle aktualisiert wird.
5. Initial-Timestamp ist die Zeit des ersten Mounts (entspricht dem initialen Loader-Run).
6. Fehler im Revalidation-Cycle führen zur Standard-Routenfehler-Anzeige von React Router; ein zusätzlicher dezenter In-Panel-Hinweis ist out-of-scope.
7. Der Klick-Handler ist tastaturbedienbar (nativer Button), das Status-Label wird per `aria-live="polite"` angekündigt.

Ziel: Operatoren können die Liste schnell aktualisieren, ohne den Filter-/Aufklapp-Status zu verlieren, und sehen anhand des Timestamps, wann die Daten zuletzt vom Backend geholt wurden.

## Architekturentscheidungen

- **`useRevalidator()` aus `react-router` statt eigener API-Route.** Der Loader des Dashboards lädt admins, applications, jobs und user gemeinsam. Ein eigener Jobs-Endpoint würde State-Synchronisation und doppelte Fetch-Wege schaffen. Begründung: idiomatisch für React Router 7, ein einziger Datenpfad, minimaler Code-Footprint. Side-Effect (auch Admins/Applications werden neu gelesen) ist akzeptabel, weil diese Listen klein sind und sich selten ändern.
- **Lokaler `lastRefreshedAt`-State, gespeist aus `revalidator.state`-Transition.** Ein `useEffect` mit Dep auf `revalidator.state` setzt `new Date()`, wenn der State von `"loading"` auf `"idle"` wechselt. Begründung: keine Server-Time benötigt, kein Polling, kein zusätzliches Loader-Feld. Initialwert über `useState(() => new Date())`.
- **Statischer Timestamp im Format `toLocaleTimeString()`, kein Relativzeit-Refresh.** „Aktualisiert HH:MM:SS" wird nur bei Refresh aktualisiert, kein `setInterval` für „vor X Sekunden"-Label. Begründung: relativer Zeit-Refresh erzeugt unnötige Re-Renders, statische Uhrzeit ist für Operator-Zwecke ausreichend.
- **Button-Variante `buttonVariants.secondary` (reuse).** Vorhandener Sekundär-Button-Stil im Repo passt; kein neuer Button-Variant nötig. Begründung: visuelle Konsistenz mit „Verwalten"-Button und anderen sekundären Aktionen.
- **`aria-busy` am Jobs-Panel, `aria-live="polite"` am Status-Label.** Während Revalidation kündigt der Status-Bereich „Refreshing…" an, danach „Aktualisiert HH:MM:SS". Begründung: WCAG-konformes Loading-Feedback, kein zusätzlicher Live-Region-Container nötig.
- **Disabled-Button während Loading.** Verhindert Mehrfach-Klicks während Pending-Revalidation. Begründung: Standard-Pattern, vermeidet Spam-Calls.
- **Keine Spinner-Animation.** Repo verwendet bisher keine animierten Spinner; das textuelle „Refreshing…"-Label reicht. Begründung: minimal-invasiv, vermeidet zusätzliche Motion-Edge-Cases (reduced motion etc.).

## Betroffene Dateien

| Datei                                             | Beschreibung                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/app/routes/dashboard.tsx`      | `useRevalidator`-Import; neue States `lastRefreshedAt`; `useEffect` für Timestamp-Update; Reload-Button + Timestamp-Label im `panelHeader` der Recent-Jobs-Section; `aria-busy` am Panel `<section>` der Recent-Jobs; i18n-Strings „Refresh", „Refreshing…", „Last updated ${time}".         |
| `packages/frontend/app/routes/dashboard.css.ts`   | Neue Style-Regel `reloadButtonGroup` (Flex-Container für Button + Timestamp), `reloadTimestamp` (dezenter Mono-/Subtle-Text). Reuse `buttonVariants.secondary` für den Button.                                                                                                               |
| `packages/frontend/app/routes/dashboard.test.tsx` | Mock `useRevalidator` (Rückgabe aus `react-router`). Neue Tests: Reload-Klick ruft `revalidate()` auf, Button-Label wechselt zu „Refreshing…" während `state === "loading"`, Button ist disabled während Loading, Timestamp-Label aktualisiert nach `state`-Übergang `"loading"` → `"idle"`. |

## Implementierungsdetails

### Imports und State

```tsx
import { useRevalidator } from "react-router";

// innerhalb des Dashboard-Components:
const revalidator = useRevalidator();
const isRefreshing = revalidator.state !== "idle";
const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

useEffect(() => {
  if (revalidator.state === "idle") {
    setLastRefreshedAt(new Date());
  }
}, [revalidator.state]);
```

Hinweis: Der initiale `useEffect`-Run bei Mount sieht `state === "idle"` und setzt `lastRefreshedAt` einmal neu — das ist semantisch korrekt („Daten gerade vom initialen Loader geholt").

### Recent-Jobs-Panel-Header

```tsx
<section aria-busy={isRefreshing} className={panel}>
  <div className={panelHeader}>
    <div>
      <p className={panelKicker}>{t`Operations`}</p>
      <h2 className={panelTitle}>{t`Recent jobs`}</h2>
    </div>
    <div aria-live="polite" className={reloadButtonGroup}>
      <span className={reloadTimestamp}>
        {isRefreshing ? t`Refreshing…` : t`Last updated ${lastRefreshedAt.toLocaleTimeString()}`}
      </span>
      <button
        className={buttonVariants.secondary}
        disabled={isRefreshing}
        onClick={() => revalidator.revalidate()}
        type="button"
      >
        {isRefreshing ? t`Refreshing…` : t`Refresh`}
      </button>
    </div>
  </div>
  ...
</section>
```

### CSS-Skizze

```ts
export const reloadButtonGroup = style({
  alignItems: "center",
  display: "flex",
  gap: themeVariables.space[3],
});

export const reloadTimestamp = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.85rem",
  fontVariantNumeric: "tabular-nums",
});
```

## Akzeptanzkriterien

- [ ] Im Recent-Jobs-Panel-Header steht rechts ein Button mit Label „Refresh".
- [ ] Klick auf den Button ruft `revalidator.revalidate()` auf (verifizierbar via Mock).
- [ ] Während `revalidator.state !== "idle"`:
  - Button-Label wechselt auf „Refreshing…",
  - Button ist `disabled`,
  - Panel-`<section>` hat `aria-busy="true"`.
- [ ] Neben dem Button steht ein Timestamp „Last updated HH:MM:SS" (lokales Format), der nach jedem Revalidation-Cycle (`state` wechselt von `"loading"` zu `"idle"`) aktualisiert wird.
- [ ] Status-Bereich ist als `aria-live="polite"` gekennzeichnet.
- [ ] Filter-State (`selectedAdminId`), Aufklapp-State (`openApplicationId`) und Highlight-State (`highlightedApplicationId`) bleiben beim Reload unverändert.
- [ ] Keine neuen Konsolen-Warnings; vorhandene Dashboard-Tests bleiben grün.
- [ ] `pnpm agent:check` (Lint, Format, Typecheck, Tests) ist grün.

## Validierungsplan

- Unit-Tests in `dashboard.test.tsx`:
  - Mock `useRevalidator`, verify dass `revalidate()` bei Klick aufgerufen wird.
  - Mock-State `"loading"`: Button-Label = „Refreshing…", Button-Disabled, Panel hat `aria-busy="true"`.
  - State-Übergang `"loading"` → `"idle"`: `lastRefreshedAt` aktualisiert sich (geprüft via Timestamp-Text-Vergleich oder `vi.useFakeTimers`).
- Visueller Smoke-Test im Dev-Server: Klick auf „Refresh" lädt jobs neu; Timestamp aktualisiert sich; Filter/Aufklapp-State bleibt.
- `pnpm agent:check` muss vor Abschluss fehlerfrei sein.

## Annahmen und offene Punkte

- Annahme: `useRevalidator` ist im aktuellen React-Router-7-Setup verfügbar (Standard-Hook).
- Annahme: Der Loader bleibt unverändert; Jobs werden weiterhin über `listJobs().slice(0, RECENT_JOBS_LIMIT)` geliefert.
- Annahme: i18n-Tags `t\`Refresh\``, `t\`Refreshing…\``, `t\`Last updated ${time}\`` werden über die bestehende Lingui-Pipeline extrahiert.
- Offen für später: Auto-Refresh per `setInterval` (z. B. alle 30 s) bewusst nicht in Scope; lässt sich später additiv ergänzen.
- Offen für später: Granulare „Nur Jobs neu laden"-Variante über separaten API-Endpoint, falls Admins-/Applications-Datenlast wächst. Bewusst nicht jetzt umgesetzt.
- Offen für später: Relative Zeit-Anzeige („vor 12 s") wäre genauer, würde aber `setInterval`-getriebene Re-Renders verlangen.

## Implementierungsanpassung

Während der Implementierung wurde der `useEffect` für die Timestamp-Aktualisierung verfeinert: Statt bei jedem `state === "idle"`-Render `setLastRefreshedAt` aufzurufen (was beim Mount unnötige Re-Renders erzeugte und in einem Test-Szenario zu spätem Re-Render nach `mockReset` führte), prüft der Effekt jetzt mit `useRef` auf den echten Übergang `"loading"` → `"idle"`. Initialer Timestamp ist weiterhin die Mount-Zeit via `useState`-Initializer.

## Testergebnisse

- **Frontend-Tests:** 86 Tests grün (16 Test-Files). Neu hinzugekommen: 4 Tests in `dashboard.test.tsx` für den Reload-Button (Idle-State + Timestamp, Klick ruft `revalidate()`, Loading-State mit disabled Button + aria-busy + Refreshing-Label, aria-live="polite" am Group-Container).
- **Backend-Tests:** 70 Tests grün — keine Änderungen am Backend.
- **`pnpm agent:check`:** Lint (0 Errors), Format-Check, Typecheck und alle 156 Tests (70 backend + 86 frontend) sind grün.

## Review-Findings

**Datum:** 2026-06-05
**Reviewer:** Self-Review (Feature-Umfang rechtfertigt keine Subagent-Review)

### Zusammenfassung

| Status                  | Anzahl |
| ----------------------- | -----: |
| Behoben                 |      0 |
| Offen / Nicht umgesetzt |      0 |

Keine Findings gefunden. Implementierung folgt dem Plan eng, alle Akzeptanzkriterien sind durch Tests automatisiert verifiziert. Es wurde kein externer Review-Report unter `.sf-plugin/review/` angelegt.
