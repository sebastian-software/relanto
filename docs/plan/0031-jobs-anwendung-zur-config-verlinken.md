# 0031: Job-Anwendung mit Anwendungskonfiguration verlinken

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-build
**Empfohlener Workflow:** Feature (`/sf-build`)

## Anforderung

Im Dashboard-Bereich „Letzte Jobs" steht in der Spalte „Anwendung" derzeit nur der Label der Anwendung als Plain-Text. Es soll möglich werden, von dort direkt zur zugehörigen Anwendungskonfiguration im oberen Panel „Applications" zu springen.

Verhalten bei Klick auf den Anwendungsnamen einer Jobzeile:

1. Falls die Anwendung durch den Admin-Filter (`selectedAdminId`) aktuell ausgeblendet ist: Filter zurücksetzen, sodass die Anwendung wieder gerendert wird. Eine kurzzeitige Inline-Notice am Applications-Panel weist auf den Reset hin und bietet einen Undo-Link, um den vorherigen Filter wiederherzustellen.
2. Die zugehörige Anwendungs-Card aufklappen, wie bei einem Klick auf den Button „Verwalten" (`openApplicationId` auf die Anwendungs-ID setzen).
3. Sanft zur Card scrollen (`scrollIntoView` mit `behavior: "smooth"`, `block: "nearest"`); die Card definiert dafür `scroll-margin-top` als CSS-Anker.
4. Den Fokus per `tabIndex={-1}` und `.focus({ preventScroll: true })` auf die Card setzen, damit Screen-Reader und Tastatur-Nutzer am Ziel landen.
5. Die Card kurz mit einem Pulse-Outline in der Akzentfarbe highlighten (ca. 1100 ms, einmaliger Pulse, exponentielles Ease-out).
6. Bei `prefers-reduced-motion: reduce`: kein Pulse, sondern ein statischer Outline-Frame für die gleiche Gesamtdauer, plus `scrollIntoView({ behavior: "auto" })` statt Smooth-Scroll.

Ziel ist eine schnelle Operator-Erfahrung: vom Job-Fehler direkt zur SMTP-/Token-Verwaltung der betroffenen Anwendung — ohne manuelles Scrollen, ohne den Admin-Filter manuell zurückzusetzen und mit transparentem, rückgängig machbarem Filter-Reset.

## Architekturentscheidungen

- **Single-Page-Scroll statt Route-Wechsel.** Das gesamte Dashboard ist eine Route (`dashboard.tsx`). Die Verlinkung bleibt damit ein In-Page-Anker; keine neuen Routen, keine URL-Änderung. Begründung: Application-Cards werden bereits hier gerendert, ein Route-Wechsel würde State und Filter unnötig verlieren.
- **DOM-Anker per stabiler ID statt React-Ref-Map.** Jede Application-Card bekommt `id={\`application-${application.id}\`}`und`tabIndex={-1}`. Begründung: Scroll-Ziel ist deklarativ über die ID auffindbar, kein Ref-State, der mit Re-Renders synchronisiert werden muss. `tabIndex={-1}` ist nötig, damit programmatischer Fokus möglich ist, ohne die natürliche Tab-Reihenfolge zu stören.
- **`scroll-margin-top` auf der Card statt `block: "start"`.** Mit `block: "nearest"` plus `scroll-margin-top` als CSS-Layout-Hinweis bleibt der Scroll robust gegen Änderungen am Layout darüber und springt nicht, wenn die Card bereits sichtbar ist. Begründung: weniger „springt aus heiterem Himmel"-Effekt, idiomatisch.
- **`useEffect` für DOM-Zugriff nach State-Update statt `requestAnimationFrame`.** Der Scroll-/Fokus-Effekt hängt an `highlightedApplicationId`. Begründung: React-Effekte laufen garantiert nach Commit; rAF allein gibt keine Garantie, dass Filter-Reset, Aufklappen und Card-Render bereits im DOM stehen.
- **Filter-Auto-Reset mit Inline-Notice + Undo statt stiller Reset.** Wenn `selectedAdminId` durch den Klick zurückgesetzt werden muss, wird der vorherige Filter in `recentFilterReset` gemerkt. Eine `aria-live="polite"` Inline-Notice am Applications-Panel zeigt „Filter zurückgesetzt, um {label} anzuzeigen — Filter wiederherstellen". Die Notice verschwindet bei manuellem Filter-Wechsel, beim Undo-Klick oder nach 6 s automatisch. Begründung: Vorhersehbarkeit, Rückgängig-Möglichkeit, Screen-Reader-Ankündigung.
- **Highlight per CSS-Animation mit data-Attribut-Trigger und `outline`/`outline-offset`.** Die Card bekommt vorübergehend ein `data-highlight="true"`-Attribut; CSS-Selektor `[data-highlight="true"]` triggert die `@keyframes`-Pulse-Animation auf der `outline`-Property. Begründung: `outline` hat semantisch korrekte Trennung von der existierenden `box-shadow`-Erhebung der Card; `outline-offset` schafft Luft zur Card-Border, ohne Layout zu beeinflussen.
- **Animation kurz und exponentiell.** 1100 ms mit `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart-ähnlich). Begründung: längere Pulse fühlen sich wie Bug an; exponentielles Ease-out wirkt entschlossen statt schwammig.
- **Reduced-Motion: statischer Outline ohne Transition.** Statt `transition` über `box-shadow` (was bei Initial-`none` keinen Übergang erzeugt und WCAG 2.3.3 grenzwertig ist) wird bei `prefers-reduced-motion: reduce` schlicht für 1100 ms ein deckender Outline gesetzt; State-Cleanup entfernt ihn dann. Smooth-Scroll wird ebenfalls auf `behavior: "auto"` reduziert.
- **`useMemo`-Map für O(1) Application-Lookup.** Statt `applications.find(...)` pro Job-Zeile wird einmal pro Render eine `Map<id, application>` aufgebaut. Begründung: Performance bei vielen Jobs; in der bestehenden Jobs-Tabelle ist dasselbe `find()` bereits ein Hotspot.
- **Application-Cell als Button mit `aria-label`.** Die Zelle wird als `<button type="button">` mit zusätzlichem `aria-label="Open configuration for {label}"` gerendert. Begründung: Screen-Reader kündigen die Aktion an, nicht nur den Anwendungsnamen.
- **Kein `useCallback` für `focusApplication`.** Der Handler wird nur direkt in `onClick`-Props übergeben, keine memoized Children dahinter. Begründung: `useCallback` mit `[applications, selectedAdminId]`-Deps memoisiert eh bei jeder Loader-Antwort neu und bringt hier keinen Re-Render-Vorteil; ohne `useCallback` ist der Code schlanker.
- **Kein zusätzliches Touch-State im DOM.** Aufklappen, Highlighten und Filter-Notice reuse bestehende React-States plus drei neue lokale States: `highlightedApplicationId`, `recentFilterReset`. Kein globaler Store, kein URL-Query.

## Betroffene Dateien

| Datei                                             | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/app/routes/dashboard.tsx`      | Application-Card erhält `id`-Attribut und `tabIndex={-1}`. `useMemo`-Map für Application-Lookup. Neue Handler-Funktion `focusApplication(applicationId)` setzt Filter (mit `recentFilterReset`-Hinweis), öffnet Card, triggert Highlight. Neuer `useEffect` mit Dep auf `highlightedApplicationId` führt Scroll und Fokus aus. Jobs-Tabelle: Application-Zelle wird auf Button mit `aria-label` umgestellt. Inline-Notice am Applications-Panel mit Undo-Link. |
| `packages/frontend/app/routes/dashboard.css.ts`   | Neue Style-Regeln: `configCard`-Erweiterung mit `scroll-margin-top` (≈ Höhe der Header-Bereich oben). `configCardHighlight` mit `@keyframes`-Pulse auf `outline`/`outline-offset` (1100 ms, ease-out-quart) und `prefers-reduced-motion`-Branch mit statischem Outline. Style-Regel für klickbaren Application-Button in Jobs-Tabelle (text-styled, Underline-Affordance, Hover/Focus). Style-Regel für die Filter-Reset-Notice (dezentes Banner).             |
| `packages/frontend/app/routes/dashboard.test.tsx` | Neue Tests für Click-Flow: Klick triggert Filter-Reset (wenn nötig) und schreibt `recentFilterReset`, setzt `openApplicationId`, setzt/entfernt `data-highlight`, mockt `scrollIntoView` und prüft die Aufrufargumente (`block: "nearest"`, `behavior` je nach reduced-motion). Test für Undo-Aktion: Klick auf Undo-Link stellt `selectedAdminId` wieder her und entfernt die Notice. Bestehende Tests bleiben unverändert tragfähig.                         |

## Implementierungsdetails

### State-Layout und Handler-Skizze

```tsx
const [highlightedApplicationId, setHighlightedApplicationId] = useState<null | string>(null);
const [recentFilterReset, setRecentFilterReset] = useState<{
  previousAdminId: string;
  applicationLabel: string;
} | null>(null);

const applicationsById = useMemo(
  () => new Map(applications.map((application) => [application.id, application])),
  [applications],
);

function focusApplication(applicationId: string) {
  const target = applicationsById.get(applicationId);
  if (!target) return;

  if (selectedAdminId && selectedAdminId !== target.applicationAdminId) {
    setRecentFilterReset({
      applicationLabel: target.label,
      previousAdminId: selectedAdminId,
    });
    setSelectedAdminId(null);
  }
  setOpenApplicationId(applicationId);
  setHighlightedApplicationId(applicationId);
}

useEffect(() => {
  if (!highlightedApplicationId) return;

  const node = document.getElementById(`application-${highlightedApplicationId}`);
  if (!node) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "nearest",
  });
  node.focus({ preventScroll: true });

  const timer = window.setTimeout(() => setHighlightedApplicationId(null), 1100);
  return () => window.clearTimeout(timer);
}, [highlightedApplicationId]);

useEffect(() => {
  if (!recentFilterReset) return;
  const timer = window.setTimeout(() => setRecentFilterReset(null), 6000);
  return () => window.clearTimeout(timer);
}, [recentFilterReset]);
```

Erläuterungen:

- `useEffect` läuft nach Commit, daher steht die Card mit `id` und ggf. mit zurückgesetztem Filter bereits im DOM.
- `focus({ preventScroll: true })` setzt den DOM-Fokus, ohne den eben ausgelösten `scrollIntoView`-Smooth-Scroll abzuwürgen.
- Beide `setTimeout`-Cleanups verhindern Leaks bei schneller Folge-Klicks.

### CSS-Skizze (`dashboard.css.ts`)

```ts
import { keyframes, style } from "@vanilla-extract/css";
import { themeVariables } from "../styles/theme.css";

const HIGHLIGHT_DURATION_MS = 1100;

const cardPulse = keyframes({
  "0%": {
    outlineColor: "transparent",
    outlineOffset: "0px",
  },
  "20%": {
    outlineColor: themeVariables.color.accent,
    outlineOffset: "6px",
  },
  "100%": {
    outlineColor: "transparent",
    outlineOffset: "0px",
  },
});

export const configCardHighlight = style({
  outlineStyle: "solid",
  outlineWidth: "2px",
  outlineColor: "transparent",
  scrollMarginTop: themeVariables.space[6],

  selectors: {
    '&[data-highlight="true"]': {
      animationName: cardPulse,
      animationDuration: `${HIGHLIGHT_DURATION_MS}ms`,
      animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      animationFillMode: "forwards",
    },
  },

  "@media": {
    "(prefers-reduced-motion: reduce)": {
      selectors: {
        '&[data-highlight="true"]': {
          animation: "none",
          outlineColor: themeVariables.color.accent,
          outlineOffset: "4px",
        },
      },
    },
  },
});

export const applicationLinkButton = style({
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  padding: 0,
  textAlign: "left",
  textDecoration: "underline",
  textDecorationStyle: "dotted",
  textDecorationThickness: "1px",
  textUnderlineOffset: "3px",

  selectors: {
    "&:hover": {
      textDecorationStyle: "solid",
    },
    "&:focus-visible": {
      outline: `2px solid ${themeVariables.color.accent}`,
      outlineOffset: "2px",
      borderRadius: "2px",
    },
  },
});

export const filterResetNotice = style({
  background: themeVariables.color.accentSoft,
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.sm,
  color: themeVariables.color.ink,
  display: "flex",
  gap: themeVariables.space[3],
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
});
```

Die `configCard`-Basis-Style erhält zusätzlich `outlineStyle` (transparent als Idle), damit die Animation nahtlos anlaufen kann; alternativ wird `configCardHighlight` als zweite Klasse via `clsx` mit `configCard` kombiniert.

### Klickbare Zelle

```tsx
<TableCell>
  {(() => {
    const linkedApplication = applicationsById.get(job.applicationId);
    if (!linkedApplication) return null;
    return (
      <button
        aria-label={t`Open configuration for ${linkedApplication.label}`}
        className={applicationLinkButton}
        onClick={() => focusApplication(linkedApplication.id)}
        type="button"
      >
        {linkedApplication.label}
      </button>
    );
  })()}
</TableCell>
```

### Inline-Notice am Applications-Panel

```tsx
{
  recentFilterReset ? (
    <div className={filterResetNotice} aria-live="polite" role="status">
      <span>{t`Filter cleared to show ${recentFilterReset.applicationLabel}.`}</span>
      <button
        type="button"
        onClick={() => {
          setSelectedAdminId(recentFilterReset.previousAdminId);
          setRecentFilterReset(null);
        }}
      >
        {t`Restore filter`}
      </button>
    </div>
  ) : null;
}
```

## Akzeptanzkriterien

- [ ] Jede Application-Card hat ein stabiles `id="application-<applicationId>"` und `tabIndex={-1}`.
- [ ] Application-Zelle in der Jobs-Tabelle ist als `<button>` mit sprechendem `aria-label` umgesetzt und per Tastatur (Tab/Enter/Space) bedienbar.
- [ ] Application-Lookup in der Jobs-Tabelle nutzt eine `useMemo`-Map (keine `find`-Aufrufe pro Zeile).
- [ ] Klick auf die Anwendung:
  - öffnet die Card (`openApplicationId === applicationId`),
  - scrollt zur Card mit `block: "nearest"` (verifizierbar via gemocktes `scrollIntoView`),
  - setzt den DOM-Fokus auf die Card,
  - setzt für 1100 ms `data-highlight="true"` auf der Card,
  - entfernt das Attribut anschließend automatisch.
- [ ] Wenn der Admin-Filter die Ziel-Anwendung aktuell ausblendet:
  - wird `selectedAdminId` auf `null` zurückgesetzt,
  - erscheint eine `aria-live="polite"` Inline-Notice am Applications-Panel mit Anwendungslabel,
  - bietet die Notice einen Undo-Link, der den vorherigen `selectedAdminId` wiederherstellt und die Notice entfernt,
  - verschwindet die Notice spätestens nach 6 s automatisch.
- [ ] Bei `prefers-reduced-motion: reduce`:
  - läuft keine Pulse-Animation; die Card ist für 1100 ms mit statischem Outline-Frame markiert,
  - wird `scrollIntoView` mit `behavior: "auto"` aufgerufen.
- [ ] Card hat `scroll-margin-top` als CSS-Anker; ist die Card bereits vollständig sichtbar, springt der Viewport nicht.
- [ ] Keine neuen Konsolen-Warnings; vorhandene Dashboard-Tests bleiben grün.
- [ ] `pnpm agent:check` (Lint, Format, Typecheck, Tests) ist grün.

## Validierungsplan

- Unit-/Component-Tests in `dashboard.test.tsx`:
  - `scrollIntoView` per `vi.spyOn(Element.prototype, "scrollIntoView")` mocken, Argumente prüfen.
  - `matchMedia` mocken, Reduced-Motion-Variante prüfen.
  - `data-highlight`-Lifecycle: setzt, entfernt nach Timeout (`vi.useFakeTimers`).
  - Filter-Reset-Flow: setzt `selectedAdminId` zurück, schreibt `recentFilterReset`, Undo stellt vorherigen Wert wieder her.
  - Tastatur-Aktivierung: Enter/Space auf Application-Button löst `focusApplication` aus.
- Visueller Smoke-Test im Dev-Server: Klick auf Application in einer Jobzeile löst Aufklappen, Scroll, Pulse und ggf. Filter-Notice aus.
- Reduced-Motion-Smoke: über DevTools `prefers-reduced-motion: reduce` simulieren, sicherstellen, dass kein Pulse läuft, Outline-Frame sichtbar bleibt, kein Smooth-Scroll.
- `pnpm agent:check` muss vor Abschluss fehlerfrei sein.

## Annahmen und offene Punkte

- Annahme: Akzentfarbe ist als `themeVariables.color.accent` und `themeVariables.color.accentSoft` verfügbar (bestätigt durch `packages/frontend/app/styles/theme.css.ts`).
- Annahme: Die Jobs-Tabelle hat aktuell keinen sticky Header, der das Scroll-Ziel überlappen würde; `scroll-margin-top` der Card auf `themeVariables.space[6]` reicht als Reserve.
- Annahme: i18n-Tags `t\`Open configuration for ${label}\``, `t\`Filter cleared to show ${label}.\``und`t\`Restore filter\`` werden über die bestehende Lingui-Pipeline extrahiert.
- Offen für später: Falls weitere Felder in Jobs (z. B. SMTP-Config-ID, Token-Bezeichner) zur Konfiguration verlinkt werden sollen, kann der `focusApplication`-Handler verallgemeinert werden — z. B. zu `focusSection(kind, id)`. Nicht Teil dieses Plans.
- Offen für später: Optionale URL-Synchronisation des Anker-Ziels via `?focusApplication=<id>` wäre denkbar für externes Deep-Linking (z. B. aus Slack/Mail). Bewusst nicht Scope dieses Plans.
- Offen für später: Der Admin-Filter-Select im Applications-Panel (`dashboard.tsx:1681`) hat kein `aria-label`. Pre-existing A11y-Gap, im Self-Review als Hinweis F1 festgehalten. Gehört in einen separaten A11y-Sweep-Plan, der auch andere `<select>`-Felder im Dashboard mit konsistenten Labels versorgt.

## Testergebnisse

- **Frontend-Tests:** 82 Tests grün (16 Test-Files). Neu hinzugekommen: 5 Tests in `dashboard.test.tsx` für den Click-Flow (Button-Rendering inkl. `aria-label`, Aufklappen + Scroll + Highlight, Reduced-Motion-Verhalten mit `behavior: "auto"`, Filter-Auto-Reset + Notice, Restore-Filter).
- **Backend-Tests:** 70 Tests grün — keine Änderungen am Backend, alle Bestandstests bleiben tragfähig.
- **Mocks:** `Element.prototype.scrollIntoView` und `window.matchMedia` werden im Test-Setup gemockt; `vi.useFakeTimers({ shouldAdvanceTime: true })` deckt den Highlight- und Notice-Lifecycle ab.
- **`pnpm agent:check`:** Lint (0 Errors, 5 unverwandte pre-existing Warnings zu `URL` in `op_mini`), Format-Check, Typecheck und alle 152 Tests (70 backend + 82 frontend) sind grün.

## Review-Findings

**Datum:** 2026-06-05
**Reviewer:** Self-Review (Feature-Umfang rechtfertigt keine Subagent-Review)

### Zusammenfassung

| Status                  | Anzahl |
| ----------------------- | -----: |
| Behoben                 |      0 |
| Offen / Nicht umgesetzt |      1 |

Das einzige Finding (F1: fehlendes `aria-label` am Admin-Filter-Select, Schweregrad „Hinweis", Komplexität „Leicht") ist eine pre-existing A11y-Lücke, die nicht durch dieses Feature eingeführt wurde. Da kein durch diesen Workflow erzeugter offener Befund existiert, wurde kein externer Review-Report unter `.sf-plugin/review/` angelegt. F1 ist in „Annahmen und offene Punkte" als Hinweis für einen separaten A11y-Sweep-Plan dokumentiert.
