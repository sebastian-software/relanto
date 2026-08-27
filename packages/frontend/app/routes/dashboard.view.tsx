/* cspell:ignore behaviour Revalidator revalidator sonarjs */
/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions, complexity, max-lines, max-lines-per-function, max-statements, no-nested-ternary, react/ref-name, react/set-state-in-effect, sonarjs/cognitive-complexity -- Legacy dashboard view state and forms are isolated from the route module for a behavior-preserving refactor. */
import type {
  ApplicationAdminToken,
  ApplicationToken,
  getSmtpConfigByApplicationId,
} from "@relanto/backend";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteLoaderData,
} from "react-router";

import type { Locale } from "../lib/i18n";
import type { loader as rootLoader } from "../root";
import type { action, loader, LoaderData } from "./dashboard";
import type { DashboardDetailLoaderData } from "./dashboard.details.$detailKind.$detailId";

import { t } from "../lib/i18n/tag";
import {
  isCreateAdminSubmitDisabled,
  isCreateApplicationSubmitDisabled,
  isCreateTokenSubmitDisabled,
  isRenameSubmitDisabled,
} from "./dashboard-form-state";
import {
  actionRow,
  appIdBadge,
  applicationLinkButton,
  buttonVariants,
  checkboxCard,
  checkboxInput,
  checkboxRow,
  configCard,
  configCardHighlight,
  configGrid,
  configName,
  emptyState,
  eyebrow,
  feedbackTitle,
  fieldError,
  fieldHint,
  fieldLabel,
  fieldsetReset,
  filterResetNotice,
  filterResetNoticeButton,
  formGrid,
  formNotice,
  formNoticeBody,
  formNoticeDiagnosticLabel,
  formNoticeDiagnosticRow,
  formNoticeDiagnostics,
  formNoticeDiagnosticValue,
  formNoticeTitle,
  formNoticeVariants,
  hero,
  heroBody,
  heroCopy,
  heroLogo,
  heroLogoPanel,
  heroLogoWrap,
  heroMeta,
  heroTitle,
  heroVisual,
  heroVisualGlow,
  heroWordmark,
  inlineSplit,
  jobsTable,
  jobsWrap,
  metaBadge,
  modalActions,
  modalBody,
  modalCard,
  modalTitle,
  panel,
  panelBody,
  panelBodyDense,
  panelHeader,
  panelKicker,
  panelTitle,
  principalInfo,
  principalItem,
  principalLabel,
  principalList,
  principalMeta,
  recordSummary,
  recordSummaryHeader,
  recordSummaryMeta,
  reloadButtonGroup,
  reloadTimestamp,
  secretCopy,
  secretCopyFeedback,
  sectionStack,
  selectControl,
  shell,
  statCard,
  statGrid,
  statHint,
  statLabel,
  statusPill,
  statValue,
  subGrid,
  subPanel,
  subTitle,
  tableCell,
  tableHead,
  tableHeaderCell,
  tableRow,
  tokenInfo,
  tokenItem,
  tokenLabel,
  tokenList,
  tokenMeta,
  tokenSecret,
  tokenSecretValue,
  tokenStatus,
  twinGrid,
} from "./dashboard.css";
import {
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  PrimaryButton,
} from "./dashboard.form-primitives";
import {
  CREATE_ADMIN_FORM_KEY,
  CREATE_APPLICATION_FORM_KEY,
  type DashboardActionData,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_PORT,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_SOCKET_TIMEOUT_MS,
  type FieldErrors,
  type FormValues,
  getFirstValue,
  getManyValues,
  JOBS_FORM_KEY,
  type NoticeTone,
  TOKEN_SCOPES,
} from "./dashboard.shared";

type DashboardApplicationSummary = {
  config?: ReturnType<typeof getSmtpConfigByApplicationId>;
  tokens?: ApplicationToken[];
} & LoaderData["admins"][number]["applications"][number];

type DashboardAdminSummary = {
  applications: DashboardApplicationSummary[];
  tokens?: ApplicationAdminToken[];
} & Omit<LoaderData["admins"][number], "applications">;

type AdminDetailData = Extract<DashboardDetailLoaderData, { kind: "admin" }>["admin"];
type ApplicationDetailData = Extract<
  DashboardDetailLoaderData,
  { kind: "application" }
>["application"];

function getTokenScopeLabel(scope: (typeof TOKEN_SCOPES)[number]): string {
  switch (scope) {
    case "manageApplications":
      return t`Manage applications`;
    case "manageTokens":
      return t`Manage tokens`;
    case "readConfig":
      return t`Read SMTP config`;
    case "readStatus":
      return t`Read status`;
    case "send":
      return t`Send`;
    case "validate":
      return t`Validate`;
  }
}

function getJobStatusLabel(status: string): string {
  switch (status) {
    case "cancelled":
      return t`Cancelled`;
    case "delivery_uncertain":
      return t`Delivery uncertain`;
    case "failed":
      return t`Failed`;
    case "paused":
      return t`Paused`;
    case "processing":
      return t`Processing`;
    case "queued":
      return t`Queued`;
    case "retry_scheduled":
      return t`Retry scheduled`;
    case "sent":
      return t`Sent`;
    default:
      return status;
  }
}

function formatTimestamp(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function getFormKeyForConfig(applicationId: string): string {
  return `config:${applicationId}`;
}

function getFormKeyForAdminTokenForm(applicationAdminId: string): string {
  return `application-admin-token-form:${applicationAdminId}`;
}

function getFormKeyForAdminTokenList(applicationAdminId: string): string {
  return `application-admin-token-list:${applicationAdminId}`;
}

function getFormKeyForApplicationTokenForm(applicationId: string): string {
  return `application-token-form:${applicationId}`;
}

function getFormKeyForApplicationTokenList(applicationId: string): string {
  return `application-token-list:${applicationId}`;
}

function getFormKeyForRenameAdmin(applicationAdminId: string): string {
  return `rename-application-admin:${applicationAdminId}`;
}

function getFormKeyForRenameApplication(applicationId: string): string {
  return `rename-application:${applicationId}`;
}

function getFormState(
  actionData: DashboardActionData | undefined,
  formKey: string,
): {
  fieldErrors: FieldErrors;
  formError?: string;
  notice?: DashboardActionData["notice"];
  values?: FormValues;
} {
  if (actionData?.formKey !== formKey) {
    return { fieldErrors: {} };
  }

  return {
    fieldErrors: actionData.fieldErrors ?? {},
    formError: actionData.formError,
    notice: actionData.notice,
    values: actionData.values,
  };
}

function getFormResetKey(actionData: DashboardActionData | undefined, formKey: string): string {
  if (actionData?.formKey !== formKey) {
    return `${formKey}:idle`;
  }

  return JSON.stringify({
    fieldErrors: actionData.fieldErrors,
    formError: actionData.formError,
    notice: actionData.notice,
    values: actionData.values,
  });
}

function getConfigDefaults(
  values: FormValues | undefined,
  config: ReturnType<typeof getSmtpConfigByApplicationId>,
  smtpConfigDefaults: { sendRateLimitPerMinute: number },
): {
  connectionTimeoutMs: number | string;
  defaultFromAddress: string;
  greetingTimeoutMs: number | string;
  host: string;
  minTlsVersion: "TLSv1.2" | "TLSv1.3";
  name: string;
  port: number | string;
  requireTls: boolean;
  secure: boolean;
  sendRateLimitPerMinute: number | string;
  socketTimeoutMs: number | string;
  username: string;
} {
  return {
    connectionTimeoutMs:
      getFirstValue(values, "connectionTimeoutMs") ??
      config?.connectionTimeoutMs ??
      DEFAULT_CONNECTION_TIMEOUT_MS,
    defaultFromAddress:
      getFirstValue(values, "defaultFromAddress") ?? config?.defaultFromAddress ?? "",
    greetingTimeoutMs:
      getFirstValue(values, "greetingTimeoutMs") ??
      config?.greetingTimeoutMs ??
      DEFAULT_CONNECTION_TIMEOUT_MS,
    host: getFirstValue(values, "host") ?? config?.host ?? "",
    minTlsVersion:
      (getFirstValue(values, "minTlsVersion") as "TLSv1.2" | "TLSv1.3" | undefined) ??
      config?.minTlsVersion ??
      "TLSv1.2",
    name: getFirstValue(values, "name") ?? config?.name ?? "",
    port: getFirstValue(values, "port") ?? config?.port ?? DEFAULT_PORT,
    requireTls: values
      ? getFirstValue(values, "requireTls") === "on"
      : (config?.requireTls ?? true),
    secure: values ? getFirstValue(values, "secure") === "on" : Boolean(config?.secure),
    sendRateLimitPerMinute:
      getFirstValue(values, "sendRateLimitPerMinute") ??
      config?.sendRateLimitPerMinute ??
      smtpConfigDefaults.sendRateLimitPerMinute,
    socketTimeoutMs:
      getFirstValue(values, "socketTimeoutMs") ??
      config?.socketTimeoutMs ??
      DEFAULT_SOCKET_TIMEOUT_MS,
    username: getFirstValue(values, "username") ?? config?.username ?? "",
  };
}

function getRetentionDefaults(values: FormValues | undefined): {
  retainAttachmentsDays: number | string;
  retainErrorDetailsDays: number | string;
  retainFailedJobsDays: number | string;
  retainSentJobsDays: number | string;
} {
  return {
    retainAttachmentsDays: getFirstValue(values, "retainAttachmentsDays") ?? DEFAULT_RETENTION_DAYS,
    retainErrorDetailsDays:
      getFirstValue(values, "retainErrorDetailsDays") ?? DEFAULT_RETENTION_DAYS,
    retainFailedJobsDays: getFirstValue(values, "retainFailedJobsDays") ?? DEFAULT_RETENTION_DAYS,
    retainSentJobsDays: getFirstValue(values, "retainSentJobsDays") ?? DEFAULT_RETENTION_DAYS,
  };
}

function getJobActions(status: string): Array<{ intent: string; label: string }> {
  const actions: Array<{ intent: string; label: string }> = [];

  if (["processing", "queued", "retry_scheduled"].includes(status)) {
    actions.push({ intent: "pauseJob", label: t`Pause` });
  }

  if (status === "paused") {
    actions.push({ intent: "resumeJob", label: t`Resume` });
  }

  if (["delivery_uncertain", "failed"].includes(status)) {
    actions.push({ intent: "retryJob", label: t`Retry` });
  }

  if (!["cancelled", "sent"].includes(status)) {
    actions.push({ intent: "deleteJob", label: t`Delete` });
  }

  return actions;
}

/**
 * Reports whether the current React Router navigation is a submission that
 * belongs to a specific form. Every dashboard form carries a unique `formKey`
 * hidden input; shared-key forms (e.g. the SMTP config panel) additionally
 * disambiguate via `intent`, `tokenId` or `jobId`. Returns true from the moment
 * the submission starts until the follow-up revalidation settles, so callers can
 * keep the submit button disabled for the whole cycle and re-enable it once done.
 */
function useFormSubmitting(match: {
  formKey: string;
  intent?: string;
  jobId?: string;
  tokenId?: string;
}): boolean {
  const navigation = useNavigation();

  if (navigation.state === "idle" || !navigation.formData) {
    return false;
  }

  const { formData } = navigation;

  if (formData.get("formKey") !== match.formKey) {
    return false;
  }

  if (match.intent !== undefined && formData.get("intent") !== match.intent) {
    return false;
  }

  if (match.tokenId !== undefined && formData.get("tokenId") !== match.tokenId) {
    return false;
  }

  if (match.jobId !== undefined && formData.get("jobId") !== match.jobId) {
    return false;
  }

  return true;
}

export default function Dashboard(): React.JSX.Element {
  const {
    admins,
    jobs,
    locale,
    smtpConfigDefaults = { sendRateLimitPerMinute: 60 },
    user,
  } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const operatorLogoHref = rootData?.operatorAssets.logoHref;
  const actionData = useActionData<typeof action>() as DashboardActionData | undefined;
  const dashboardAdmins = admins as DashboardAdminSummary[];
  const applications = dashboardAdmins.flatMap((admin) => admin.applications);

  const createAdminState = getFormState(actionData, CREATE_ADMIN_FORM_KEY);
  const createApplicationState = getFormState(actionData, CREATE_APPLICATION_FORM_KEY);
  const jobsState = getFormState(actionData, JOBS_FORM_KEY);
  const [createAdminLabel, setCreateAdminLabel] = useState(
    getFirstValue(createAdminState.values, "label") ?? "",
  );
  const [createApplicationLabel, setCreateApplicationLabel] = useState(
    getFirstValue(createApplicationState.values, "label") ?? "",
  );
  const [createApplicationAdminId, setCreateApplicationAdminId] = useState(
    getFirstValue(createApplicationState.values, "applicationAdminId") ?? "",
  );
  const [openAdminId, setOpenAdminId] = useState<null | string>(null);
  const [openApplicationId, setOpenApplicationId] = useState<null | string>(null);
  const [expandedErrorJobIds, setExpandedErrorJobIds] = useState(new Set<string>());
  const [selectedAdminId, setSelectedAdminId] = useState<null | string>(null);
  const [highlightedApplicationId, setHighlightedApplicationId] = useState<null | string>(null);
  const [recentFilterReset, setRecentFilterReset] = useState<{
    applicationLabel: string;
    previousAdminId: string;
  } | null>(null);
  const revalidator = useRevalidator();
  const isRefreshing = revalidator.state !== "idle";
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const previousRevalidatorStateReference = useRef(revalidator.state);
  const filteredApplications = selectedAdminId
    ? applications.filter((app) => app.applicationAdminId === selectedAdminId)
    : applications;
  const applicationsById = useMemo(
    () => new Map(applications.map((application) => [application.id, application])),
    [applications],
  );

  function focusApplication(applicationId: string): void {
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
    if (!highlightedApplicationId) return undefined;

    const node = document.getElementById(`application-${highlightedApplicationId}`);
    if (!node) return undefined;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
    node.focus({ preventScroll: true });

    const timer = window.setTimeout(() => setHighlightedApplicationId(null), 1100);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedApplicationId]);

  useEffect(() => {
    if (!recentFilterReset) return undefined;
    const timer = window.setTimeout(() => setRecentFilterReset(null), 6000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [recentFilterReset]);

  useEffect(() => {
    if (previousRevalidatorStateReference.current === "loading" && revalidator.state === "idle") {
      setLastRefreshedAt(new Date());
    }
    previousRevalidatorStateReference.current = revalidator.state;
  }, [revalidator.state]);

  useEffect(() => {
    setCreateAdminLabel(getFirstValue(createAdminState.values, "label") ?? "");
  }, [createAdminState.values]);

  useEffect(() => {
    setCreateApplicationLabel(getFirstValue(createApplicationState.values, "label") ?? "");
    setCreateApplicationAdminId(
      getFirstValue(createApplicationState.values, "applicationAdminId") ?? "",
    );
  }, [createApplicationState.values]);

  const isCreateAdminDisabled = isCreateAdminSubmitDisabled(createAdminLabel);
  const isCreateApplicationDisabled = isCreateApplicationSubmitDisabled({
    adminCount: dashboardAdmins.length,
    applicationAdminId: createApplicationAdminId,
    label: createApplicationLabel,
  });
  const isCreateAdminSubmitting = useFormSubmitting({
    formKey: CREATE_ADMIN_FORM_KEY,
    intent: "createApplicationAdmin",
  });
  const isCreateApplicationSubmitting = useFormSubmitting({
    formKey: CREATE_APPLICATION_FORM_KEY,
    intent: "createApplication",
  });

  return (
    <main className={shell}>
      <section className={hero}>
        <div className={heroCopy}>
          <div>
            <p className={eyebrow}>{t`Relanto`}</p>
            <h1 className={heroTitle}>{t`External mailer control plane`}</h1>
          </div>
          <p className={heroBody}>
            {t`Signed in as ${user.label}. Manage application admins, applications, SMTP infrastructure and mail tokens from one operational surface.`}
          </p>
          <div className={heroMeta}>
            <div className={metaBadge}>{t`System-admin only operational console`}</div>
            <div className={metaBadge}>{t`Application admins manage multiple applications`}</div>
            <Link className={metaBadge} to="/api-failures">
              {t`API failures`}
            </Link>
          </div>
        </div>
        <div className={heroVisual}>
          <div className={heroVisualGlow} />
          <div className={heroLogoWrap}>
            <div className={heroLogoPanel}>
              {operatorLogoHref ? (
                <img alt="Sebastian Software" className={heroLogo} src={operatorLogoHref} />
              ) : (
                <p aria-hidden="true" className={heroWordmark}>
                  Relanto
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={statGrid}>
        <article className={statCard}>
          <p className={statLabel}>{t`Application admins`}</p>
          <p className={statValue}>{dashboardAdmins.length}</p>
          <p
            className={statHint}
          >{t`Technical admin roles that manage one or more applications.`}</p>
        </article>
        <article className={statCard}>
          <p className={statLabel}>{t`Applications`}</p>
          <p className={statValue}>{applications.length}</p>
          <p className={statHint}>{t`Each application owns exactly one SMTP configuration.`}</p>
        </article>
        <article className={statCard}>
          <p className={statLabel}>{t`Recent jobs`}</p>
          <p className={statValue}>{jobs.length}</p>
          <p className={statHint}>{t`Queue activity is capped in the initial dashboard load.`}</p>
        </article>
      </section>

      <section className={twinGrid}>
        <section className={panel}>
          <div className={panelHeader}>
            <div>
              <p className={panelKicker}>{t`Administration`}</p>
              <h2 className={panelTitle}>{t`Create application admin`}</h2>
            </div>
          </div>
          <div className={panelBody}>
            <p className={heroBody}>
              {t`Application admins are technical roles. They manage SMTP settings and tokens for their assigned applications.`}
            </p>
            <Form className={formGrid} method="post">
              <input name="intent" type="hidden" value="createApplicationAdmin" />
              <input name="formKey" type="hidden" value={CREATE_ADMIN_FORM_KEY} />
              <LabeledInput
                error={createAdminState.fieldErrors.label}
                label={t`Label`}
                name="label"
                onChange={setCreateAdminLabel}
                value={createAdminLabel}
              />
              <PrimaryButton
                disabled={isCreateAdminDisabled}
                label={t`Create application admin`}
                pending={isCreateAdminSubmitting}
                pendingLabel={t`Creating application admin…`}
              />
            </Form>
            <FormNotice
              formError={createAdminState.formError}
              notice={createAdminState.notice}
              tone={createAdminState.notice?.tone}
            />
          </div>
        </section>

        <section className={panel}>
          <div className={panelHeader}>
            <div>
              <p className={panelKicker}>{t`Applications`}</p>
              <h2 className={panelTitle}>{t`Create application`}</h2>
            </div>
          </div>
          <div className={panelBody}>
            <p className={heroBody}>
              {t`Every application belongs to exactly one application admin and gets one SMTP configuration.`}
            </p>
            {dashboardAdmins.length === 0 ? (
              <div className={emptyState}>
                {t`Create an application admin first. Applications can only be assigned after that.`}
              </div>
            ) : null}
            <Form className={formGrid} method="post">
              <input name="intent" type="hidden" value="createApplication" />
              <input name="formKey" type="hidden" value={CREATE_APPLICATION_FORM_KEY} />
              <LabeledInput
                error={createApplicationState.fieldErrors.label}
                label={t`Label`}
                name="label"
                onChange={setCreateApplicationLabel}
                value={createApplicationLabel}
              />
              <LabeledSelect
                disabled={dashboardAdmins.length === 0}
                error={createApplicationState.fieldErrors.applicationAdminId}
                label={t`Application admin`}
                name="applicationAdminId"
                onChange={setCreateApplicationAdminId}
                options={dashboardAdmins.map((admin) => ({
                  label: admin.label,
                  value: admin.id,
                }))}
                placeholder={t`Select application admin`}
                value={createApplicationAdminId}
              />
              <PrimaryButton
                disabled={isCreateApplicationDisabled}
                label={t`Create application`}
                pending={isCreateApplicationSubmitting}
                pendingLabel={t`Creating application…`}
              />
            </Form>
            <FormNotice
              formError={createApplicationState.formError}
              notice={createApplicationState.notice}
              tone={createApplicationState.notice?.tone}
            />
          </div>
        </section>
      </section>

      <section className={panel}>
        <div className={panelHeader}>
          <div>
            <p className={panelKicker}>{t`Administration`}</p>
            <h2 className={panelTitle}>{t`Application admins`}</h2>
          </div>
        </div>
        <div className={panelBodyDense}>
          {dashboardAdmins.length > 0 ? (
            <div className={configGrid}>
              {dashboardAdmins.map((admin) => (
                <AdminCard
                  actionData={actionData}
                  admin={admin}
                  isOpen={openAdminId === admin.id}
                  key={admin.id}
                  locale={locale}
                  onToggle={() => {
                    setOpenAdminId((current) => (current === admin.id ? null : admin.id));
                  }}
                />
              ))}
            </div>
          ) : (
            <div className={emptyState}>
              {t`No application admins yet. Create the first technical admin role above to start assigning applications.`}
            </div>
          )}
        </div>
      </section>

      <section className={panel}>
        <div className={panelHeader}>
          <div>
            <p className={panelKicker}>{t`Infrastructure`}</p>
            <h2 className={panelTitle}>{t`Applications`}</h2>
          </div>
          {dashboardAdmins.length > 0 ? (
            <select
              aria-label={t`Filter applications by admin`}
              className={selectControl}
              onChange={(event) => {
                setSelectedAdminId(event.target.value || null);
                setRecentFilterReset(null);
              }}
              value={selectedAdminId ?? ""}
            >
              <option value="">{t`All admins`}</option>
              {dashboardAdmins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className={panelBodyDense}>
          {recentFilterReset ? (
            <div aria-live="polite" className={filterResetNotice} role="status">
              <span>{t`Filter cleared to show ${recentFilterReset.applicationLabel}.`}</span>
              <button
                className={filterResetNoticeButton}
                onClick={() => {
                  setSelectedAdminId(recentFilterReset.previousAdminId);
                  setRecentFilterReset(null);
                }}
                type="button"
              >
                {t`Restore filter`}
              </button>
            </div>
          ) : null}
          {filteredApplications.length > 0 ? (
            <div className={configGrid}>
              {filteredApplications.map((application) => (
                <ApplicationCard
                  actionData={actionData}
                  adminLabel={
                    dashboardAdmins.find((admin) => admin.id === application.applicationAdminId)
                      ?.label
                  }
                  application={application}
                  isHighlighted={highlightedApplicationId === application.id}
                  isOpen={openApplicationId === application.id}
                  key={application.id}
                  locale={locale}
                  onToggle={() => {
                    setOpenApplicationId((current) =>
                      current === application.id ? null : application.id,
                    );
                  }}
                  smtpConfigDefaults={smtpConfigDefaults}
                />
              ))}
            </div>
          ) : (
            <div className={emptyState}>
              {selectedAdminId
                ? t`No applications for this admin.`
                : t`No applications yet. Create an application above to add SMTP settings and tokens.`}
            </div>
          )}
        </div>
      </section>

      <section aria-busy={isRefreshing} className={panel}>
        <div className={panelHeader}>
          <div>
            <p className={panelKicker}>{t`Operations`}</p>
            <h2 className={panelTitle}>{t`Recent jobs`}</h2>
          </div>
          <div aria-live="polite" className={reloadButtonGroup}>
            <span className={reloadTimestamp}>
              {isRefreshing
                ? t`Refreshing…`
                : lastRefreshedAt
                  ? t`Last updated ${lastRefreshedAt.toLocaleTimeString(locale)}`
                  : t`Last updated`}
            </span>
            <button
              className={buttonVariants.secondary}
              disabled={isRefreshing}
              onClick={() => {
                void revalidator.revalidate();
              }}
              type="button"
            >
              {isRefreshing ? t`Refreshing…` : t`Refresh`}
            </button>
          </div>
        </div>
        <div className={panelBodyDense}>
          <p className={heroBody}>
            {t`Recent queue activity with the actions that are currently available for each job.`}
          </p>
          <FormNotice
            formError={jobsState.formError}
            notice={jobsState.notice}
            tone={jobsState.notice?.tone}
          />
          {jobs.length > 0 ? (
            <div className={jobsWrap}>
              <table className={jobsTable}>
                <thead>
                  <tr className={tableHead}>
                    <TableHeader>{t`Application`}</TableHeader>
                    <TableHeader>{t`Subject`}</TableHeader>
                    <TableHeader>{t`Status`}</TableHeader>
                    <TableHeader>{t`Created`}</TableHeader>
                    <TableHeader>{t`Actions`}</TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const hasError =
                      (job.status === "failed" || job.status === "delivery_uncertain") &&
                      job.lastError;
                    const isErrorExpanded = expandedErrorJobIds.has(job.id);
                    const linkedApplication = applicationsById.get(job.applicationId);

                    return (
                      <Fragment key={job.id}>
                        <tr className={tableRow}>
                          <TableCell>
                            {linkedApplication ? (
                              <button
                                aria-label={t`Open configuration for ${linkedApplication.label}`}
                                className={applicationLinkButton}
                                onClick={() => focusApplication(linkedApplication.id)}
                                type="button"
                              >
                                {linkedApplication.label}
                              </button>
                            ) : null}
                          </TableCell>
                          <TableCell>{job.subject}</TableCell>
                          <TableCell>
                            <span className={statusPill}>{getJobStatusLabel(job.status)}</span>
                            {hasError ? (
                              <button
                                aria-controls={`job-error-${job.id}`}
                                aria-expanded={isErrorExpanded}
                                className={buttonVariants.subtle}
                                onClick={() => {
                                  setExpandedErrorJobIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(job.id)) {
                                      next.delete(job.id);
                                    } else {
                                      next.add(job.id);
                                    }
                                    return next;
                                  });
                                }}
                                type="button"
                              >
                                {isErrorExpanded ? t`Hide error` : t`Show error`}
                              </button>
                            ) : null}
                          </TableCell>
                          <TableCell>{formatTimestamp(job.createdAt, locale)}</TableCell>
                          <TableCell>
                            <div className={actionRow}>
                              {getJobActions(job.status).map((jobAction) => (
                                <InlineJobForm
                                  confirmationMessage={
                                    jobAction.intent === "deleteJob"
                                      ? t`Do you really want to delete this job? This action cannot be undone.`
                                      : undefined
                                  }
                                  formKey={JOBS_FORM_KEY}
                                  intent={jobAction.intent}
                                  jobId={job.id}
                                  key={`${job.id}:${jobAction.intent}`}
                                  label={jobAction.label}
                                />
                              ))}
                            </div>
                          </TableCell>
                        </tr>
                        {hasError && isErrorExpanded ? (
                          <tr className={tableRow}>
                            <td colSpan={5} id={`job-error-${job.id}`}>
                              <dl className={formNoticeDiagnostics}>
                                <div className={formNoticeDiagnosticRow}>
                                  <dt className={formNoticeDiagnosticLabel}>{t`Error`}</dt>
                                  <dd className={formNoticeDiagnosticValue}>{job.lastError}</dd>
                                </div>
                                {job.errorCategory ? (
                                  <div className={formNoticeDiagnosticRow}>
                                    <dt className={formNoticeDiagnosticLabel}>{t`Category`}</dt>
                                    <dd className={formNoticeDiagnosticValue}>
                                      {job.errorCategory}
                                    </dd>
                                  </div>
                                ) : null}
                                {job.errorCode ? (
                                  <div className={formNoticeDiagnosticRow}>
                                    <dt className={formNoticeDiagnosticLabel}>{t`Code`}</dt>
                                    <dd className={formNoticeDiagnosticValue}>{job.errorCode}</dd>
                                  </div>
                                ) : null}
                              </dl>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={emptyState}>
              {t`No jobs yet. Jobs will appear here after an application starts sending mail.`}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminCard({
  actionData,
  admin,
  isOpen,
  locale,
  onToggle,
}: {
  actionData: DashboardActionData | undefined;
  admin: DashboardAdminSummary;
  isOpen: boolean;
  locale: Locale;
  onToggle: () => void;
}): React.JSX.Element {
  const fetcher = useFetcher<DashboardDetailLoaderData>();
  const fallbackDetail =
    admin.tokens === undefined
      ? undefined
      : {
          applications: admin.applications.map((application) => ({
            ...application,
            config: application.config ?? null,
          })),
          tokens: admin.tokens,
        };
  const detail = fetcher.data?.kind === "admin" ? fetcher.data.admin : fallbackDetail;

  useEffect(() => {
    if (isOpen && !detail && fetcher.state === "idle") {
      void fetcher.load(`/dashboard/details/admin/${encodeURIComponent(admin.id)}`);
    }
  }, [admin.id, detail, fetcher, isOpen]);

  return (
    <section className={configCard}>
      <div className={recordSummary}>
        <div className={recordSummaryHeader}>
          <h3 className={configName}>{admin.label}</h3>
          <p className={recordSummaryMeta}>
            {t`${admin.applications.length} applications`} ·{" "}
            {detail ? t`${detail.tokens.length} admin tokens` : t`Token details load on demand`}
          </p>
        </div>
        <button className={buttonVariants.secondary} onClick={onToggle} type="button">
          {isOpen ? t`Hide details` : t`Manage`}
        </button>
      </div>

      {isOpen ? (
        detail ? (
          <>
            <div className={sectionStack}>
              <h4 className={subTitle}>{t`Rename`}</h4>
              <RenameForm
                actionData={actionData}
                currentLabel={admin.label}
                formKey={getFormKeyForRenameAdmin(admin.id)}
                hiddenInputName="applicationAdminId"
                hiddenInputValue={admin.id}
                intent="renameApplicationAdmin"
                key={`${getFormResetKey(actionData, getFormKeyForRenameAdmin(admin.id))}|${admin.label}`}
              />
            </div>
            <div className={subGrid}>
              <div className={subPanel}>
                <h4 className={subTitle}>{t`Issue admin token`}</h4>
                <p className={fieldHint}>
                  {t`Use admin tokens for configuration work across the assigned applications.`}
                </p>
                <TokenForm
                  actionData={actionData}
                  formKey={getFormKeyForAdminTokenForm(admin.id)}
                  intent="createApplicationAdminToken"
                  key={getFormResetKey(actionData, getFormKeyForAdminTokenForm(admin.id))}
                  ownerFieldName="applicationAdminId"
                  ownerId={admin.id}
                  scopes={["manageApplications", "manageTokens", "readStatus", "validate"]}
                />
              </div>
              <div className={subPanel}>
                <h4 className={subTitle}>{t`Assigned applications`}</h4>
                {detail.applications.length > 0 ? (
                  <ul className={principalList}>
                    {detail.applications.map((application) => (
                      <li className={principalItem} key={application.id}>
                        <div className={principalInfo}>
                          <div className={principalLabel}>{application.label}</div>
                          <div className={principalMeta}>
                            {application.config
                              ? t`SMTP ready on ${application.config.host}:${String(application.config.port)}`
                              : t`No SMTP config yet`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={emptyState}>
                    {t`No applications are assigned yet. Create an application and assign it to this admin.`}
                  </div>
                )}
              </div>
            </div>

            <div className={sectionStack}>
              <h4 className={subTitle}>{t`Admin tokens`}</h4>
              <TokenList
                actionData={actionData}
                allowedScopes={["manageApplications", "manageTokens", "readStatus", "validate"]}
                formKey={getFormKeyForAdminTokenList(admin.id)}
                locale={locale}
                tokens={detail.tokens}
              />
            </div>
          </>
        ) : (
          <div className={emptyState}>{t`Loading details…`}</div>
        )
      ) : null}
    </section>
  );
}

function ApplicationCard({
  actionData,
  adminLabel,
  application,
  isHighlighted,
  isOpen,
  locale,
  onToggle,
  smtpConfigDefaults,
}: {
  actionData: DashboardActionData | undefined;
  adminLabel?: string;
  application: DashboardApplicationSummary;
  isHighlighted: boolean;
  isOpen: boolean;
  locale: Locale;
  onToggle: () => void;
  smtpConfigDefaults: { sendRateLimitPerMinute: number };
}): React.JSX.Element {
  const fetcher = useFetcher<DashboardDetailLoaderData>();
  const fallbackDetail =
    application.config === undefined && application.tokens === undefined
      ? undefined
      : {
          config: application.config ?? null,
          tokens: application.tokens ?? [],
        };
  const detail = fetcher.data?.kind === "application" ? fetcher.data.application : fallbackDetail;
  const configStatus = detail
    ? detail.config
      ? detail.config.lockedAt
        ? t`SMTP configuration (locked)`
        : t`SMTP configuration`
      : t`No SMTP config yet`
    : t`Details load on demand`;
  const tokenStatusText = detail
    ? t`${detail.tokens.length} application tokens`
    : t`Tokens load on demand`;

  useEffect(() => {
    if (isOpen && !detail && fetcher.state === "idle") {
      void fetcher.load(`/dashboard/details/application/${encodeURIComponent(application.id)}`);
    }
  }, [application.id, detail, fetcher, isOpen]);

  return (
    <section
      className={`${configCard} ${configCardHighlight}`}
      data-highlight={isHighlighted ? "true" : undefined}
      id={`application-${application.id}`}
      tabIndex={-1}
    >
      <div className={recordSummary}>
        <div className={recordSummaryHeader}>
          <h3 className={configName}>{application.label}</h3>
          <div className={appIdBadge}>{t`App ID ${application.id}`}</div>
          <p className={recordSummaryMeta}>
            {adminLabel} · {configStatus} · {tokenStatusText}
          </p>
        </div>
        <button className={buttonVariants.secondary} onClick={onToggle} type="button">
          {isOpen ? t`Hide details` : t`Manage`}
        </button>
      </div>

      {isOpen ? (
        detail ? (
          <>
            <div className={sectionStack}>
              <h4 className={subTitle}>{t`Rename`}</h4>
              <RenameForm
                actionData={actionData}
                currentLabel={application.label}
                formKey={getFormKeyForRenameApplication(application.id)}
                hiddenInputName="applicationId"
                hiddenInputValue={application.id}
                intent="renameApplication"
                key={`${getFormResetKey(actionData, getFormKeyForRenameApplication(application.id))}|${application.label}`}
              />
            </div>
            {detail.config ? (
              <div className={actionRow}>
                <LockConfigForm
                  configId={detail.config.id}
                  formKey={getFormKeyForConfig(application.id)}
                  locked={Boolean(detail.config.lockedAt)}
                />
                {detail.config.lockedAt ? (
                  <span className={tokenStatus}>
                    {t`Locked since ${formatTimestamp(detail.config.lockedAt, locale)}`}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className={subGrid}>
              <div className={subPanel}>
                <h4 className={subTitle}>
                  {detail.config ? t`Update SMTP config` : t`Create SMTP config`}
                </h4>
                <p className={fieldHint}>
                  {detail.config?.lockedAt
                    ? t`This SMTP configuration is locked. Unlock it to make changes.`
                    : t`Define credentials, TLS posture and timeout behavior for outbound delivery.`}
                </p>
                {detail.config?.lockedAt ? null : (
                  <ConfigForm
                    actionData={actionData}
                    applicationId={application.id}
                    config={detail.config}
                    smtpConfigDefaults={smtpConfigDefaults}
                  />
                )}
              </div>
              <div className={subPanel}>
                <h4 className={subTitle}>{t`Issue application token`}</h4>
                <p className={fieldHint}>
                  {t`Application tokens are used by the application itself for delivery and status checks.`}
                </p>
                <TokenForm
                  actionData={actionData}
                  disabled={!detail.config || Boolean(detail.config.lockedAt)}
                  disabledMessage={
                    detail.config?.lockedAt
                      ? t`Token creation is blocked while the SMTP configuration is locked.`
                      : t`Create and save the SMTP configuration before issuing an application token.`
                  }
                  formKey={getFormKeyForApplicationTokenForm(application.id)}
                  intent="createApplicationToken"
                  key={getFormResetKey(
                    actionData,
                    getFormKeyForApplicationTokenForm(application.id),
                  )}
                  ownerFieldName="applicationId"
                  ownerId={application.id}
                  scopes={["send", "readStatus", "readConfig", "validate"]}
                />
              </div>
            </div>

            <div className={sectionStack}>
              <h4 className={subTitle}>{t`Application tokens`}</h4>
              <TokenList
                actionData={actionData}
                allowedScopes={["send", "readStatus", "readConfig", "validate"]}
                formKey={getFormKeyForApplicationTokenList(application.id)}
                locale={locale}
                tokens={detail.tokens}
              />
            </div>
          </>
        ) : (
          <div className={emptyState}>{t`Loading details…`}</div>
        )
      ) : null}
    </section>
  );
}

function LockConfigForm({
  configId,
  formKey,
  locked,
}: {
  configId: string;
  formKey: string;
  locked: boolean;
}): React.JSX.Element {
  const intent = locked ? "unlockSmtpConfig" : "lockSmtpConfig";
  const idleLabel = locked ? t`Unlock config` : t`Lock config`;
  const isSubmitting = useFormSubmitting({ formKey, intent });

  return (
    <Form method="post">
      <input name="formKey" type="hidden" value={formKey} />
      <input name="configId" type="hidden" value={configId} />
      <input name="intent" type="hidden" value={intent} />
      <button
        aria-busy={isSubmitting}
        className={buttonVariants.subtle}
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? t`Working…` : idleLabel}
      </button>
    </Form>
  );
}

function ConfigForm({
  actionData,
  applicationId,
  config,
  smtpConfigDefaults,
}: {
  actionData: DashboardActionData | undefined;
  applicationId: string;
  config: ReturnType<typeof getSmtpConfigByApplicationId>;
  smtpConfigDefaults: { sendRateLimitPerMinute: number };
}): React.JSX.Element {
  const formKey = getFormKeyForConfig(applicationId);
  const state = getFormState(actionData, formKey);
  const defaults = getConfigDefaults(state.values, config, smtpConfigDefaults);
  const saveIntent = config ? "updateConfig" : "createConfig";
  const isValidating = useFormSubmitting({ formKey, intent: "validateConfig" });
  const isSendingTestMail = useFormSubmitting({ formKey, intent: "sendTestMail" });
  const isSavingConfig = useFormSubmitting({ formKey, intent: saveIntent });

  return (
    <>
      {config ? (
        <div className={actionRow}>
          <Form method="post">
            <input name="configId" type="hidden" value={config.id} />
            <input name="formKey" type="hidden" value={formKey} />
            <input name="intent" type="hidden" value="validateConfig" />
            <button
              aria-busy={isValidating}
              className={buttonVariants.secondary}
              disabled={isValidating}
              type="submit"
            >
              {isValidating ? t`Validating config…` : t`Validate config`}
            </button>
          </Form>
          <Form method="post">
            <input name="configId" type="hidden" value={config.id} />
            <input name="formKey" type="hidden" value={formKey} />
            <input name="intent" type="hidden" value="sendTestMail" />
            <button
              aria-busy={isSendingTestMail}
              className={buttonVariants.secondary}
              disabled={isSendingTestMail}
              type="submit"
            >
              {isSendingTestMail ? t`Sending test email…` : t`Send test email`}
            </button>
          </Form>
        </div>
      ) : null}
      <Form className={formGrid} method="post">
        <input name="applicationId" type="hidden" value={applicationId} />
        <input name="configId" type="hidden" value={config?.id || ""} />
        <input name="formKey" type="hidden" value={formKey} />
        <input name="intent" type="hidden" value={saveIntent} />
        <LabeledInput
          error={state.fieldErrors.name}
          label={t`Name`}
          name="name"
          value={defaults.name}
        />
        <LabeledInput
          error={state.fieldErrors.host}
          label={t`Host`}
          name="host"
          value={defaults.host}
        />
        <div className={inlineSplit}>
          <LabeledInput
            error={state.fieldErrors.port}
            label={t`Port`}
            name="port"
            type="number"
            value={defaults.port}
          />
          <LabeledInput
            error={state.fieldErrors.username}
            label={t`Username`}
            name="username"
            value={defaults.username}
          />
        </div>
        <LabeledInput
          autoComplete="off"
          error={state.fieldErrors.defaultFromAddress}
          hint={t`Used when the send API request does not provide a from address.`}
          label={t`Default from address`}
          name="defaultFromAddress"
          type="email"
          value={defaults.defaultFromAddress}
        />
        <LabeledInput
          autoComplete="new-password"
          hint={t`Leave this empty to keep the current password.`}
          label={t`Password`}
          name="password"
          type="password"
          value=""
        />
        <div className={inlineSplit}>
          <CheckboxInput checked={defaults.secure} label={t`Secure connection`} name="secure" />
          <CheckboxInput checked={defaults.requireTls} label={t`Require TLS`} name="requireTls" />
        </div>
        <LabeledSelect
          label={t`Min TLS version`}
          name="minTlsVersion"
          options={[
            { label: "TLSv1.2", value: "TLSv1.2" },
            { label: "TLSv1.3", value: "TLSv1.3" },
          ]}
          value={defaults.minTlsVersion}
        />
        <div className={inlineSplit}>
          <LabeledInput
            error={state.fieldErrors.connectionTimeoutMs}
            label={t`Connection timeout ms`}
            name="connectionTimeoutMs"
            type="number"
            value={defaults.connectionTimeoutMs}
          />
          <LabeledInput
            error={state.fieldErrors.greetingTimeoutMs}
            label={t`Greeting timeout ms`}
            name="greetingTimeoutMs"
            type="number"
            value={defaults.greetingTimeoutMs}
          />
        </div>
        <LabeledInput
          error={state.fieldErrors.socketTimeoutMs}
          label={t`Socket timeout ms`}
          name="socketTimeoutMs"
          type="number"
          value={defaults.socketTimeoutMs}
        />
        <LabeledInput
          error={state.fieldErrors.sendRateLimitPerMinute}
          hint={t`Use 0 to disable the send rate limit for this application.`}
          label={t`Send rate limit per minute`}
          name="sendRateLimitPerMinute"
          type="number"
          value={defaults.sendRateLimitPerMinute}
        />
        <PrimaryButton
          label={config ? t`Update config` : t`Create config`}
          pending={isSavingConfig}
          pendingLabel={config ? t`Updating config…` : t`Creating config…`}
        />
      </Form>
      <FormNotice formError={state.formError} notice={state.notice} tone={state.notice?.tone} />
    </>
  );
}

function RenameForm({
  actionData,
  currentLabel,
  formKey,
  hiddenInputName,
  hiddenInputValue,
  intent,
}: {
  actionData: DashboardActionData | undefined;
  currentLabel: string;
  formKey: string;
  hiddenInputName: "applicationAdminId" | "applicationId";
  hiddenInputValue: string;
  intent: "renameApplication" | "renameApplicationAdmin";
}): React.JSX.Element {
  const state = getFormState(actionData, formKey);
  const [draftLabel, setDraftLabel] = useState(
    getFirstValue(state.values, "label") ?? currentLabel,
  );
  const isSubmitting = useFormSubmitting({ formKey, intent });

  return (
    <>
      <Form className={formGrid} method="post">
        <input name="intent" type="hidden" value={intent} />
        <input name="formKey" type="hidden" value={formKey} />
        <input name={hiddenInputName} type="hidden" value={hiddenInputValue} />
        <LabeledInput
          error={state.fieldErrors.label}
          label={t`Label`}
          name="label"
          onChange={setDraftLabel}
          value={draftLabel}
        />
        <PrimaryButton
          disabled={isRenameSubmitDisabled(currentLabel, draftLabel)}
          label={t`Rename`}
          pending={isSubmitting}
          pendingLabel={t`Renaming…`}
        />
      </Form>
      <FormNotice formError={state.formError} notice={state.notice} tone={state.notice?.tone} />
    </>
  );
}

function TokenForm({
  actionData,
  disabled = false,
  disabledMessage,
  formKey,
  intent,
  ownerFieldName,
  ownerId,
  scopes,
}: {
  actionData: DashboardActionData | undefined;
  disabled?: boolean;
  disabledMessage?: string;
  formKey: string;
  intent: "createApplicationAdminToken" | "createApplicationToken";
  ownerFieldName: "applicationAdminId" | "applicationId";
  ownerId: string;
  scopes: (typeof TOKEN_SCOPES)[number][];
}): React.JSX.Element {
  const state = getFormState(actionData, formKey);
  const initialLabel = getFirstValue(state.values, "label") ?? "";
  const selectedScopes = getManyValues(state.values, "scopes");
  const initialScopes = scopes.filter(
    (scope) => scope === "send" || scope === "readStatus" || scope === "manageTokens",
  );
  const persistedScopes = selectedScopes.length > 0 ? selectedScopes : initialScopes;
  const [label, setLabel] = useState(initialLabel);
  const [liveScopes, setLiveScopes] = useState(persistedScopes);
  const retentionDefaults = getRetentionDefaults(state.values);
  const isSubmitDisabled = isCreateTokenSubmitDisabled({
    disabled,
    label,
    scopes: liveScopes,
  });
  const isSubmitting = useFormSubmitting({ formKey, intent });

  return (
    <>
      {disabled ? <div className={emptyState}>{disabledMessage}</div> : null}
      <Form className={formGrid} method="post">
        <input name="intent" type="hidden" value={intent} />
        <input name="formKey" type="hidden" value={formKey} />
        <input name={ownerFieldName} type="hidden" value={ownerId} />
        <LabeledInput
          error={state.fieldErrors.label}
          label={t`Label`}
          name="label"
          onChange={setLabel}
          value={label}
        />
        <fieldset className={fieldsetReset} disabled={disabled}>
          <legend className={fieldLabel}>{t`Scopes`}</legend>
          <div className={checkboxRow}>
            {scopes.map((scope) => {
              const isChecked =
                selectedScopes.length > 0
                  ? selectedScopes.includes(scope)
                  : scope === "send" || scope === "readStatus" || scope === "manageTokens";

              return (
                <label className={checkboxCard} key={scope}>
                  <input
                    className={checkboxInput}
                    defaultChecked={isChecked}
                    name="scopes"
                    onChange={(event) => {
                      const { checked } = event.currentTarget;
                      const nextScopes = checked
                        ? [...liveScopes, scope]
                        : liveScopes.filter((selectedScope) => selectedScope !== scope);

                      setLiveScopes(nextScopes);
                    }}
                    type="checkbox"
                    value={scope}
                  />
                  {getTokenScopeLabel(scope)}
                </label>
              );
            })}
          </div>
          {state.fieldErrors.scopes ? (
            <p className={fieldError}>{state.fieldErrors.scopes}</p>
          ) : null}
        </fieldset>
        <div className={inlineSplit}>
          <LabeledInput
            error={state.fieldErrors.retainSentJobsDays}
            label={t`Retain sent jobs (days)`}
            name="retainSentJobsDays"
            type="number"
            value={retentionDefaults.retainSentJobsDays}
          />
          <LabeledInput
            error={state.fieldErrors.retainFailedJobsDays}
            label={t`Retain failed jobs (days)`}
            name="retainFailedJobsDays"
            type="number"
            value={retentionDefaults.retainFailedJobsDays}
          />
        </div>
        <div className={inlineSplit}>
          <LabeledInput
            error={state.fieldErrors.retainAttachmentsDays}
            label={t`Retain attachments (days)`}
            name="retainAttachmentsDays"
            type="number"
            value={retentionDefaults.retainAttachmentsDays}
          />
          <LabeledInput
            error={state.fieldErrors.retainErrorDetailsDays}
            label={t`Retain error details (days)`}
            name="retainErrorDetailsDays"
            type="number"
            value={retentionDefaults.retainErrorDetailsDays}
          />
        </div>
        <PrimaryButton
          disabled={isSubmitDisabled}
          label={
            intent === "createApplicationAdminToken"
              ? t`Create admin token`
              : t`Create application token`
          }
          pending={isSubmitting}
          pendingLabel={
            intent === "createApplicationAdminToken"
              ? t`Creating admin token…`
              : t`Creating application token…`
          }
        />
      </Form>
      <FormNotice formError={state.formError} notice={state.notice} tone={state.notice?.tone} />
    </>
  );
}

function EditScopesForm({
  allowedScopes,
  currentScopes,
  formKey,
  onCancel,
  tokenId,
}: {
  allowedScopes: (typeof TOKEN_SCOPES)[number][];
  currentScopes: (typeof TOKEN_SCOPES)[number][];
  formKey: string;
  onCancel: () => void;
  tokenId: string;
}): React.JSX.Element {
  const [liveScopes, setLiveScopes] = useState<string[]>(currentScopes);
  const isSubmitting = useFormSubmitting({ formKey, intent: "updateTokenScopes", tokenId });

  return (
    <Form className={formGrid} method="post" onSubmit={onCancel}>
      <input name="intent" type="hidden" value="updateTokenScopes" />
      <input name="formKey" type="hidden" value={formKey} />
      <input name="tokenId" type="hidden" value={tokenId} />
      <fieldset className={fieldsetReset}>
        <legend className={fieldLabel}>{t`Scopes`}</legend>
        <div className={checkboxRow}>
          {allowedScopes.map((scope) => (
            <label className={checkboxCard} key={scope}>
              <input
                className={checkboxInput}
                defaultChecked={currentScopes.includes(scope)}
                name="scopes"
                onChange={(event) => {
                  const { checked } = event.currentTarget;
                  const nextScopes = checked
                    ? [...liveScopes, scope]
                    : liveScopes.filter((s) => s !== scope);
                  setLiveScopes(nextScopes);
                }}
                type="checkbox"
                value={scope}
              />
              {getTokenScopeLabel(scope)}
            </label>
          ))}
        </div>
      </fieldset>
      <PrimaryButton
        disabled={liveScopes.length === 0}
        label={t`Save scopes`}
        pending={isSubmitting}
        pendingLabel={t`Saving scopes…`}
      />
    </Form>
  );
}

function TokenList({
  actionData,
  allowedScopes,
  formKey,
  locale,
  tokens,
}: {
  actionData: DashboardActionData | undefined;
  allowedScopes: (typeof TOKEN_SCOPES)[number][];
  formKey: string;
  locale: Locale;
  tokens: Array<ApplicationAdminToken | ApplicationToken>;
}): React.JSX.Element {
  const state = getFormState(actionData, formKey);
  const [editingScopeTokenId, setEditingScopeTokenId] = useState<null | string>(null);

  if (tokens.length === 0) {
    return <div className={emptyState}>{t`No tokens yet.`}</div>;
  }

  return (
    <>
      <FormNotice formError={state.formError} notice={state.notice} tone={state.notice?.tone} />
      <ul className={tokenList}>
        {tokens.map((token) => (
          <li className={tokenItem} key={token.id}>
            <div className={tokenInfo}>
              <div className={tokenLabel}>{token.label}</div>
              <div className={tokenMeta}>
                {token.clientId} · {token.scopes.join(", ")}
              </div>
              <div className={tokenStatus}>
                {token.revokedAt ? t`Revoked` : t`Active`} · {t`Created`}{" "}
                {formatTimestamp(token.createdAt, locale)}
              </div>
            </div>
            {editingScopeTokenId === token.id ? (
              <EditScopesForm
                allowedScopes={allowedScopes}
                currentScopes={token.scopes}
                formKey={formKey}
                onCancel={() => {
                  setEditingScopeTokenId(null);
                }}
                tokenId={token.id}
              />
            ) : null}
            <div className={actionRow}>
              <button
                className={buttonVariants.subtle}
                onClick={() => {
                  setEditingScopeTokenId((current) => (current === token.id ? null : token.id));
                }}
                type="button"
              >
                {editingScopeTokenId === token.id ? t`Cancel edit` : t`Edit scopes`}
              </button>
              <InlineIntentForm
                confirmationMessage={t`Do you really want to rotate this token? The current client secret will stop working immediately.`}
                formKey={formKey}
                intent="rotateToken"
                label={t`Rotate secret`}
                tokenId={token.id}
              />
              {token.revokedAt ? null : (
                <InlineIntentForm
                  confirmationMessage={t`Do you really want to revoke this token? It will no longer work for API access.`}
                  formKey={formKey}
                  intent="revokeToken"
                  label={t`Revoke`}
                  tokenId={token.id}
                />
              )}
              <InlineIntentForm
                confirmationMessage={t`Do you really want to delete this token? This action cannot be undone.`}
                formKey={formKey}
                intent="deleteToken"
                label={t`Delete`}
                tokenId={token.id}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function FormNotice({
  formError,
  notice,
  tone = "success",
}: {
  formError?: string;
  notice?: DashboardActionData["notice"];
  tone?: NoticeTone;
}): null | React.JSX.Element {
  const secretBoxReference = useRef<HTMLDivElement>(null);
  const hasSecret = Boolean(notice?.clientSecret);

  // Move focus into the one-time client-secret box so screen readers announce
  // the credentials the user must copy before they disappear on reload.
  useEffect(() => {
    if (hasSecret) {
      secretBoxReference.current?.focus();
    }
  }, [hasSecret]);

  if (!formError && !notice) {
    return null;
  }

  if (formError) {
    return (
      <div
        aria-live="assertive"
        className={`${formNotice} ${formNoticeVariants.error}`}
        role="alert"
      >
        <p className={formNoticeTitle}>{t`Please review the form`}</p>
        <p className={formNoticeBody}>{formError}</p>
      </div>
    );
  }

  if (!notice) {
    return null;
  }

  const isError = tone === "error";

  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      className={`${formNotice} ${formNoticeVariants[tone]}`}
      role={isError ? "alert" : "status"}
    >
      <p className={formNoticeTitle}>{notice.title}</p>
      {notice.body ? <p className={formNoticeBody}>{notice.body}</p> : null}
      {notice.diagnostics ? (
        <dl className={formNoticeDiagnostics}>
          {notice.diagnostics.map((entry) => (
            <div className={formNoticeDiagnosticRow} key={`${entry.label}:${entry.value}`}>
              <dt className={formNoticeDiagnosticLabel}>{entry.label}</dt>
              <dd className={formNoticeDiagnosticValue}>{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {notice.clientId || notice.clientSecret ? (
        <div className={tokenSecret} ref={secretBoxReference} tabIndex={hasSecret ? -1 : undefined}>
          <p className={feedbackTitle}>{t`Copy client credentials now`}</p>
          {notice.clientId ? (
            <code className={tokenSecretValue}>{`client_id: ${notice.clientId}`}</code>
          ) : null}
          {notice.clientSecret ? (
            <code className={tokenSecretValue}>{`client_secret: ${notice.clientSecret}`}</code>
          ) : null}
          {notice.clientSecret ? (
            <SecretCopyButton label={t`Copy client secret`} value={notice.clientSecret} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Copies the one-time client secret to the clipboard with a short, accessible
// confirmation. Uses the async Clipboard API and falls back to a hidden textarea
// plus execCommand where the API is unavailable (e.g. non-secure contexts).
function SecretCopyButton({ label, value }: { label: string; value: string }): React.JSX.Element {
  const [status, setStatus] = useState<"copied" | "failed" | "idle">("idle");
  const resetTimerReference = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      if (resetTimerReference.current !== undefined) {
        clearTimeout(resetTimerReference.current);
      }
    },
    [],
  );

  function scheduleReset(): void {
    if (resetTimerReference.current !== undefined) {
      clearTimeout(resetTimerReference.current);
    }

    resetTimerReference.current = setTimeout(() => {
      setStatus("idle");
    }, 2000);
  }

  async function writeToClipboard(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    // Legacy fallback for browsers or insecure contexts without the async API.
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Deliberate legacy fallback where the async Clipboard API is unavailable (e.g. insecure contexts).
      if (!document.execCommand("copy")) {
        throw new Error("Clipboard copy command was rejected");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function copy(): Promise<void> {
    try {
      await writeToClipboard();
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    scheduleReset();
  }

  return (
    <div className={secretCopy}>
      <button
        className={buttonVariants.subtle}
        onClick={() => {
          void copy();
        }}
        type="button"
      >
        {status === "copied" ? t`Copied` : label}
      </button>
      <span aria-live="polite" className={secretCopyFeedback} role="status">
        {status === "copied"
          ? t`Client secret copied to the clipboard.`
          : status === "failed"
            ? t`Could not copy automatically. Please select and copy the value manually.`
            : ""}
      </span>
    </div>
  );
}

function ConfirmableActionForm({
  actionId,
  confirmationMessage,
  formKey,
  hiddenFields,
  intent,
  isSubmitting,
  label,
}: {
  actionId: string;
  confirmationMessage?: string;
  formKey: string;
  hiddenFields: Record<string, string>;
  intent: string;
  isSubmitting: boolean;
  label: React.ReactNode;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const formReference = useRef<HTMLFormElement>(null);
  const dialogReference = useRef<HTMLDialogElement>(null);
  const triggerReference = useRef<HTMLButtonElement>(null);
  const cancelReference = useRef<HTMLButtonElement>(null);
  const requiresConfirmation = Boolean(confirmationMessage);
  const titleId = `confirm-${intent}-${actionId}`;
  const wasSubmittingReference = useRef(false);
  const showTriggerPending = isSubmitting && !requiresConfirmation;

  useEffect(() => {
    const dialog = dialogReference.current;

    if (!dialog) {
      return;
    }

    if (isOpen) {
      // Native showModal() provides the focus trap and Escape-to-close in the
      // browser. jsdom does not implement it, so fall back to the open
      // attribute there while keeping our explicit focus handling below.
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else {
        dialog.setAttribute("open", "");
      }

      // Send the initial focus to the non-destructive cancel action.
      cancelReference.current?.focus();
    } else if (typeof dialog.close === "function") {
      if (dialog.open) {
        dialog.close();
      }
    } else {
      dialog.removeAttribute("open");
    }
  }, [isOpen]);

  function closeDialog(): void {
    setIsOpen(false);
    // Return focus to the trigger button that opened the dialog.
    triggerReference.current?.focus();
  }

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change -- Closing the dialog is a reaction to the router navigation settling (an external async event), not to a user interaction, so it genuinely belongs in an effect. */
  useEffect(() => {
    // Once the confirmed submission settles, dismiss the dialog automatically so
    // the pending state stays visible for the whole in-flight request.
    if (wasSubmittingReference.current && !isSubmitting && isOpen) {
      closeDialog();
    }

    wasSubmittingReference.current = isSubmitting;
  }, [isSubmitting, isOpen]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  return (
    <>
      <Form method="post" ref={formReference}>
        <input name="formKey" type="hidden" value={formKey} />
        <input name="intent" type="hidden" value={intent} />
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <button
          aria-busy={isSubmitting}
          className={buttonVariants.subtle}
          disabled={isSubmitting}
          onClick={
            requiresConfirmation
              ? (event) => {
                  event.preventDefault();
                  setIsOpen(true);
                }
              : undefined
          }
          ref={triggerReference}
          type="submit"
        >
          {showTriggerPending ? t`Working…` : label}
        </button>
      </Form>
      {requiresConfirmation && confirmationMessage ? (
        <dialog
          aria-labelledby={titleId}
          className={modalCard}
          onCancel={(event) => {
            // Spec-correct Escape path in browsers: take over the native close
            // so React state and focus return stay in sync.
            event.preventDefault();
            closeDialog();
          }}
          onClick={(event) => {
            // Light dismiss: close when the backdrop (area outside the card) is
            // clicked. On such clicks the event target is the dialog itself.
            const rect = dialogReference.current?.getBoundingClientRect();

            if (!rect) {
              return;
            }

            const clickedOutside =
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom;

            if (clickedOutside) {
              closeDialog();
            }
          }}
          onKeyDown={(event) => {
            // Escape handling that also works where native <dialog> behaviour is
            // unavailable (e.g. jsdom in tests).
            if (event.key === "Escape") {
              event.preventDefault();
              closeDialog();
            }
          }}
          ref={dialogReference}
        >
          <p className={modalTitle} id={titleId}>
            {t`Confirm action`}
          </p>
          <p className={modalBody}>{confirmationMessage}</p>
          <div className={modalActions}>
            <button
              className={buttonVariants.neutral}
              disabled={isSubmitting}
              onClick={() => {
                closeDialog();
              }}
              ref={cancelReference}
              type="button"
            >
              {t`Cancel`}
            </button>
            <button
              aria-busy={isSubmitting}
              className={buttonVariants.primary}
              disabled={isSubmitting}
              onClick={() => {
                // Keep the dialog open and submit; the auto-close effect dismisses
                // it once the request settles so the pending state stays visible.
                formReference.current?.requestSubmit();
              }}
              type="button"
            >
              {isSubmitting ? t`Working…` : label}
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function InlineIntentForm({
  confirmationMessage,
  formKey,
  intent,
  label,
  tokenId,
}: {
  confirmationMessage?: string;
  formKey: string;
  intent: string;
  label: React.ReactNode;
  tokenId: string;
}): React.JSX.Element {
  const isSubmitting = useFormSubmitting({ formKey, intent, tokenId });

  return (
    <ConfirmableActionForm
      actionId={tokenId}
      confirmationMessage={confirmationMessage}
      formKey={formKey}
      hiddenFields={{ tokenId }}
      intent={intent}
      isSubmitting={isSubmitting}
      label={label}
    />
  );
}

function InlineJobForm({
  confirmationMessage,
  formKey,
  intent,
  jobId,
  label,
}: {
  confirmationMessage?: string;
  formKey: string;
  intent: string;
  jobId: string;
  label: React.ReactNode;
}): React.JSX.Element {
  const isSubmitting = useFormSubmitting({ formKey, intent, jobId });

  return (
    <ConfirmableActionForm
      actionId={jobId}
      confirmationMessage={confirmationMessage}
      formKey={formKey}
      hiddenFields={{ jobId }}
      intent={intent}
      isSubmitting={isSubmitting}
      label={label}
    />
  );
}

function TableHeader({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <th className={tableHeaderCell} scope="col">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <td className={tableCell}>{children}</td>;
}
