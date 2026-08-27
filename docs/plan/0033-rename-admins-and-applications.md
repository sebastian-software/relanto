# 0033: Anwendungsverantwortliche und Anwendungen umbenennen

**Planungsstatus:** Umgesetzt
**Quelle:** /sf-build
**Empfohlener Workflow:** Feature (`/sf-build`)

## Anforderung

Im Dashboard sollen sowohl Anwendungsverantwortliche (`applicationAdmin`) als auch Anwendungen (`application`) nachträglich umbenannt werden können. Bislang lässt sich nur beim Erstellen ein Label vergeben.

Verhalten:

1. Im aufgeklappten „Verwalten"-Bereich der jeweiligen Card erscheint ein neues Mini-Formular „Rename" mit einem `LabeledInput` für das Label und einem Submit-Button.
2. Initial-Wert des Inputs ist das aktuelle Label.
3. Submit triggert eine POST-Action mit Intent `renameApplicationAdmin` bzw. `renameApplication`. Bei Erfolg wird eine `FormNotice` (`tone: "success"`) angezeigt und die Card-Überschrift zeigt das neue Label nach dem Loader-Re-Run.
4. Validierung im Backend (Zod):
   - Pflichtfeld, `trim()`, `min(1)` mit feldspezifischer Message (analog zu `requiredString("label")`).
5. Audit-Log: Jeder erfolgreiche Rename schreibt einen Audit-Eintrag (`application_admin.renamed` / `application.renamed`) mit alter und neuer Bezeichnung im Detail-Payload, damit der Verlauf nachvollziehbar bleibt.
6. Berechtigung: nur `systemAdmin` (Dashboard-Scope, kein API-Endpoint).
7. Fehlerfälle:
   - Leerer/getrimmt-leerer Label → 400 mit FieldError am Input.
   - Unbekannte ID → 404 mit FormError (Domain-Error wie bei bestehenden Konfig-Operationen).

Ziel: Operatoren können typografische Fehler korrigieren oder Anwendungen umstrukturieren, ohne sie löschen und neu anlegen zu müssen.

## Architekturentscheidungen

- **Eigenständige `rename*`-Service-Funktionen statt generisches `updateApplicationAdmin` / `updateApplication`.** Aktuell ist Label das einzige veränderliche Feld. Eine engumrissene Funktion verhindert Scope-Creep und macht den Audit-Event eindeutig (`application.renamed` statt `application.updated`). Spätere Felder können additiv ergänzt werden.
- **Eigenes Zod-Schema je Operation (`renameApplicationAdminInputSchema`, `renameApplicationInputSchema`).** Folgt dem bestehenden Repo-Pattern (`createApplicationAdminInputSchema` etc.) und nutzt den `requiredString("label")`-Helper. Begründung: konsistente Validation-Messages, kein generisches „Invalid input"-Risiko.
- **Audit-Detail enthält `previousLabel` und `nextLabel`.** Damit ist im Audit-Trail nachvollziehbar, was sich konkret geändert hat. Begründung: konsistent mit anderen Detail-tragenden Audit-Events (z. B. `application.created` mit `applicationAdminId`).
- **Aktor-Identifikation wie bei bestehenden Service-Funktionen.** `actorId` und `actorType: "systemAdmin" | ActorType`. Begründung: gleiches Pattern wie `createApplicationAdmin`/`createApplication`.
- **Frontend reuse `<Form>` + `LabeledInput` + `PrimaryButton`.** Keine neue UI-Komponente, kein Edit-Mode-Toggle, kein modaler Dialog. Begründung: konsistent mit Create-Form und Config-Form, minimaler State, einfache Tests.
- **Form-Key-Schema analog zu Token-/Config-Form-Keys.** Neue Helfer `getFormKeyForRenameAdmin(adminId)` und `getFormKeyForRenameApplication(applicationId)`. Begründung: separate Form-States pro Card, sodass Fehler/Success-Notice je Card sichtbar bleiben und nicht über mehrere Cards springen.
- **Initial-Wert per `useState`, kein `defaultValue`-Re-Sync nach Erfolg.** Nach erfolgreichem Submit wird der Loader revalidiert (durch React-Router-Standardverhalten nach Action). Der State des Inputs wird dann via `useEffect` aus den aktualisierten Loader-Daten neu gespeist, analog zu den bestehenden `createAdminLabel`-/`createApplicationLabel`-Effekten.
- **Submit-Button ist disabled, solange der Input-Wert gleich dem aktuellen Label ist oder leer.** Verhindert No-Op-Submits und gibt visuell Feedback. Begründung: konsistent mit Validierungs-Pattern aus `isCreateAdminSubmitDisabled`.
- **Keine separaten API-Endpunkte unter `/api/v1/`.** Da explizit nur das Dashboard adressiert wird, bleiben die Action-Branches im Dashboard-Loader. Spätere API-Variante (z. B. mit `manageApplications`-Scope) lässt sich additiv ergänzen.

## Betroffene Dateien

| Datei                                                       | Beschreibung                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/types.ts`                             | Neue Schemas `renameApplicationAdminInputSchema` (Felder: `applicationAdminId`, `label`) und `renameApplicationInputSchema` (Felder: `applicationId`, `label`). Type-Exports `RenameApplicationAdminInput`, `RenameApplicationInput`.                                                                                                                   |
| `packages/backend/src/service.ts`                           | Neue Funktionen `renameApplicationAdmin(actorId, actorType, input)` und `renameApplication(actorId, actorType, input)`. SQL: `UPDATE … SET label = ?, updated_at = ? WHERE id = ?`. Audit-Events `application_admin.renamed` und `application.renamed` mit `{ previousLabel, nextLabel }`.                                                              |
| `packages/backend/src/index.ts`                             | Re-Export der beiden neuen Funktionen.                                                                                                                                                                                                                                                                                                                  |
| `packages/backend/src/service.test.mjs`                     | Neue Tests: erfolgreicher Rename, Validierungsfehler (leerer Label, leerer nach Trim), unbekannte ID wirft, Audit-Event ist geschrieben mit korrektem Detail-Payload.                                                                                                                                                                                   |
| `packages/frontend/app/routes/dashboard.tsx`                | Neue Action-Branches `intent === "renameApplicationAdmin"` und `intent === "renameApplication"`. UI: pro Admin- und pro Application-Card im Manage-Detail-Bereich ein neues `<Form>` mit `LabeledInput` für Label + `PrimaryButton`. Neue Form-Key-Helfer, neue lokale States, neue `useEffect`-Synchronisationen analog zu `createAdminLabel`-Pattern. |
| `packages/frontend/app/routes/dashboard-form-state.ts`      | Neue `isRenameSubmitDisabled(currentLabel, draftLabel)`-Helfer-Funktion: `true`, wenn `draftLabel` getrimmt leer ist oder identisch zum `currentLabel`.                                                                                                                                                                                                 |
| `packages/frontend/app/routes/dashboard-form-state.test.ts` | Tests für `isRenameSubmitDisabled`.                                                                                                                                                                                                                                                                                                                     |
| `packages/frontend/app/routes/dashboard.test.tsx`           | Action-Tests für `renameApplicationAdmin`/`renameApplication`: Mock von Service-Funktionen, Validation-Path (leerer Label → 400), erfolgreicher Path (200 mit success-Notice).                                                                                                                                                                          |

## Implementierungsdetails

### Backend-Service (Skizze)

```ts
export function renameApplicationAdmin(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: RenameApplicationAdminInput,
): ApplicationAdmin {
  const parsed = renameApplicationAdminInputSchema.parse(input);
  const previous = getApplicationAdminById(parsed.applicationAdminId);
  const timestamp = nowIso();

  databaseRun(
    `UPDATE application_admins SET label = ?, updated_at = ? WHERE id = ?`,
    parsed.label,
    timestamp,
    parsed.applicationAdminId,
  );

  logAudit(
    actorType,
    actorId,
    "application_admin.renamed",
    "application_admin",
    parsed.applicationAdminId,
    {
      nextLabel: parsed.label,
      previousLabel: previous.label,
    },
  );

  return getApplicationAdminById(parsed.applicationAdminId);
}
```

`renameApplication` ist analog mit `applications`-Tabelle.

### Frontend-Form (Skizze)

```tsx
const renameAdminFormKey = getFormKeyForRenameAdmin(admin.id)
const renameAdminState = getFormState(actionData, renameAdminFormKey)
const [renameAdminLabel, setRenameAdminLabel] = useState(
  getFirstValue(renameAdminState.values, "label") ?? admin.label
)

useEffect(() => {
  setRenameAdminLabel(getFirstValue(renameAdminState.values, "label") ?? admin.label)
}, [renameAdminState.values, admin.label])

// JSX innerhalb des Manage-Bereichs:
<div className={subPanel}>
  <h4 className={subTitle}>{t`Rename`}</h4>
  <Form className={formGrid} method="post">
    <input name="intent" type="hidden" value="renameApplicationAdmin" />
    <input name="applicationAdminId" type="hidden" value={admin.id} />
    <input name="formKey" type="hidden" value={renameAdminFormKey} />
    <LabeledInput
      error={renameAdminState.fieldErrors.label}
      label={t`Label`}
      name="label"
      onChange={setRenameAdminLabel}
      value={renameAdminLabel}
    />
    <PrimaryButton
      disabled={isRenameSubmitDisabled(admin.label, renameAdminLabel)}
      label={t`Rename`}
    />
  </Form>
  <FormNotice
    formError={renameAdminState.formError}
    notice={renameAdminState.notice}
    tone={renameAdminState.notice?.tone}
  />
</div>
```

Application-Card erhält ein analoges Form mit `intent="renameApplication"` und versteckten `applicationId`-Input.

### Action-Branches (Skizze)

```ts
if (intent === "renameApplicationAdmin") {
  const fieldErrors: FieldErrors = {};
  const applicationAdminId = requireText(formData, {
    label: t`applicationAdminId`,
    name: "applicationAdminId",
  });
  const label = requireText(formData, { label: t`Label`, name: "label" });
  if (Object.keys(fieldErrors).length > 0) {
    return createInvalidResponse({ fieldErrors, formKey, intent, values });
  }
  renameApplicationAdmin(user.oidcSubject, "systemAdmin", { applicationAdminId, label });
  return createSuccessResponse({
    formKey,
    intent,
    notice: { body: t`Renamed to ${label}.`, title: t`Application admin renamed`, tone: "success" },
  });
}
```

`renameApplication` ist analog mit `applicationId`-Feld.

## Akzeptanzkriterien

- [ ] Backend exportiert `renameApplicationAdmin` und `renameApplication` aus `@relanto/backend`.
- [ ] Neue Zod-Schemas validieren `label` (Pflicht, Trim, min(1)) und liefern feldspezifische Messages.
- [ ] Service-Funktionen schreiben `UPDATE`-Statement mit aktualisiertem `updated_at` und einen Audit-Event mit `previousLabel` und `nextLabel`.
- [ ] Im Dashboard erscheint im Manage-Detail-Bereich jeder Admin-Card ein „Rename"-Formular mit aktuellem Label als Initial-Wert.
- [ ] Im Dashboard erscheint im Manage-Detail-Bereich jeder Application-Card ein „Rename"-Formular mit aktuellem Label als Initial-Wert.
- [ ] Submit-Button ist disabled, wenn das Label leer ist oder gleich dem aktuellen Label.
- [ ] Erfolgreicher Rename zeigt `FormNotice` mit `tone: "success"` und Loader-Re-Run aktualisiert die Card-Überschrift.
- [ ] Validation-Fehler (leerer Label) zeigt feld-spezifische Fehlermeldung am Input, kein Service-Call.
- [ ] Backend-Tests decken Happy-Path + Validation + Audit ab.
- [ ] Frontend-Tests decken Action-Branches (success und validation-fail) ab.
- [ ] `pnpm agent:check` (Lint, Format, Typecheck, Tests) ist grün.

## Validierungsplan

- Backend: Vitest-Tests in `service.test.mjs` für Rename-Funktionen, Validierung, Audit-Trail.
- Frontend-State: Vitest-Tests in `dashboard-form-state.test.ts` für `isRenameSubmitDisabled`.
- Frontend-Action: Vitest-Tests in `dashboard.test.tsx` mit Mock von `createApplicationAdmin`-Pattern, prüfen `renameApplicationAdmin`/`renameApplication`-Branches.
- Visueller Smoke-Test im Dev-Server: Admin/Application umbenennen, prüfen ob neuer Name nach Submit erscheint.
- `pnpm agent:check` muss vor Abschluss fehlerfrei sein.

## Annahmen und offene Punkte

- Annahme: `application_admins.label` und `applications.label` sind nicht unique-constrained und müssen es auch jetzt nicht sein.
- Annahme: Keine Cascade-Auswirkung auf Tokens, Konfigurationen oder Jobs — Foreign Keys verweisen auf IDs, nicht auf Labels.
- Annahme: Initial-Wert-Sync via `useEffect` auf `admin.label` reicht; bei Loader-Re-Run nach Submit aktualisiert sich der Input automatisch auf den neuen Wert.
- Offen für später: API-Endpoint `/api/v1/applications/:id` mit PATCH-Methode, wenn `applicationAdmin`-Tokens eigene Applikationen umbenennen sollen. Bewusst nicht jetzt umgesetzt.
- Offen für später: Bulk-Rename oder Rename per CSV-Import — bewusst nicht jetzt.
- Offen für später: Unique-Constraint auf Label, falls sich später herausstellt, dass doppelte Labels Verwirrung stiften.

## Implementierungsanpassung

Während der Implementierung wurde der Form-State-Sync vereinfacht: Statt eines `useEffect` mit `setDraftLabel` (was vom Lint als „derived state" geflagged würde) verwendet `RenameForm` jetzt einen Single-`useState`-Init und wird über den `key`-Prop des aufrufenden Codes zurückgesetzt. Der Key kombiniert den bestehenden `getFormResetKey(actionData, formKey)`-Helper mit dem `currentLabel`, sodass sowohl nach Action-Response (Erfolg/Fehler mit Echo-Werten) als auch bei externem Label-Change frisch initialisiert wird.

## Testergebnisse

- **Backend-Tests:** 76 Tests grün (6 Test-Files). Neu: 6 Tests in `service.test.mjs` für `renameApplicationAdmin` und `renameApplication` (Happy-Path inkl. Audit, Validierung leerer Label, unbekannte ID).
- **Frontend-Tests:** 90 Tests grün (16 Test-Files). Neu: 1 Test in `dashboard-form-state.test.ts` für `isRenameSubmitDisabled` und 3 Action-Tests in `dashboard.test.tsx` (Happy-Path Admin-Rename, Validation-Fail, Happy-Path Application-Rename).
- **`pnpm agent:check`:** Lint (0 Errors, 5 unverwandte pre-existing Warnings), Format-Check, Typecheck und alle 166 Tests sind grün.

## Review-Findings

**Datum:** 2026-06-06
**Reviewer:** Self-Review (Feature ist eng am Plan, Tests decken Service- und Action-Pfade ab)

### Zusammenfassung

| Status                  | Anzahl |
| ----------------------- | -----: |
| Behoben                 |      0 |
| Offen / Nicht umgesetzt |      0 |

Keine Findings gefunden. Backend-Service ist mit Audit-Trail abgedeckt, Frontend-Form folgt dem etablierten Pattern (analog `createApplication`), Rename-Reset ist über `key`-Prop sauber. Kein externer Review-Report unter `.sf-plugin/review/` angelegt.
