/* cspell:ignore sonarjs */
/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions, complexity, max-lines, max-lines-per-function, max-statements, no-nested-ternary, sonarjs/cognitive-complexity, sonarjs/max-union-size -- Legacy dashboard intent handling is kept behavior-preserving while it is isolated from the route module. */
import {
  createApplication,
  createApplicationAdmin,
  createApplicationAdminToken,
  createApplicationToken,
  deleteJob,
  deleteToken,
  getTokenById,
  lockSmtpConfig,
  pauseJob,
  renameApplication,
  renameApplicationAdmin,
  resumeJob,
  retryJob,
  revokeToken,
  rotateToken,
  sendSystemAdminTestMail,
  type TokenScope,
  unlockSmtpConfig,
  updateTokenScopes,
  upsertSmtpConfig,
  validateSmtpConfig,
} from "@relanto/backend";

import type { Route } from "./+types/dashboard";
import type { DashboardActionData, FieldErrors, FormValues, NoticeTone } from "./dashboard.shared";

import { activateServerI18n } from "../lib/i18n";
import { resolveLocaleFromRequest } from "../lib/i18n/detectLocale.server";
import { t } from "../lib/i18n/tag";
import { requireSystemAdminUser } from "../lib/server/auth.server";
import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";
import { requireMethod } from "./require-method";

function getSerializableValues(formData: FormData): FormValues {
  const values: FormValues = {};

  for (const [key, rawValue] of formData.entries()) {
    if (key === "intent" || key === "formKey" || key === "password") {
      continue;
    }

    const value = String(rawValue);
    const existing = values[key];
    if (existing === undefined) {
      values[key] = value;
      continue;
    }

    values[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }

  return values;
}

function createActionResponse(data: DashboardActionData): Response {
  return Response.json(data);
}

function createInvalidResponse(options: {
  fieldErrors: FieldErrors;
  formError?: string;
  formKey: string;
  intent: string;
  values: FormValues;
}): Response {
  return createActionResponse({
    fieldErrors: options.fieldErrors,
    formError: options.formError,
    formKey: options.formKey,
    intent: options.intent,
    ok: false,
    values: options.values,
  });
}

function createSuccessResponse(options: {
  body?: string;
  clientId?: string;
  clientSecret?: string;
  formKey: string;
  intent: string;
  title: string;
  tone?: NoticeTone;
}): Response {
  return createActionResponse({
    formKey: options.formKey,
    intent: options.intent,
    notice: {
      body: options.body,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      title: options.title,
      tone: options.tone ?? "success",
    },
    ok: true,
  });
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) || "").trim();
}

function readBoolean(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function requireText(
  formData: FormData,
  options: { label: string; name: string },
): {
  error?: string;
  value: string;
} {
  const { label, name } = options;
  const value = readText(formData, name);

  if (value.length > 0) {
    return { value };
  }

  return {
    error: t`Please enter ${label}.`,
    value,
  };
}

function requireEmailAddress(
  formData: FormData,
  options: { label: string; name: string },
): {
  error?: string;
  value: string;
} {
  const required = requireText(formData, options);

  if (required.error) {
    return required;
  }

  if (
    !required.value.includes(" ") &&
    required.value.includes("@") &&
    required.value.indexOf("@") > 0 &&
    required.value.indexOf("@") === required.value.lastIndexOf("@")
  ) {
    const [, domain = ""] = required.value.split("@");
    const labels = domain.split(".");
    const hasValidLabels =
      labels.length >= 2 && labels.every((label) => label.length > 0 && !label.startsWith("-"));

    if (hasValidLabels && !labels.some((label) => label.endsWith("-"))) {
      return required;
    }
  }

  return {
    error: t`Please enter a valid email address for ${options.label}.`,
    value: required.value,
  };
}

function readInteger(
  formData: FormData,
  options: {
    label: string;
    max?: number;
    min?: number;
    name: string;
  },
): {
  error?: string;
  value: number;
} {
  const { label, max, min, name } = options;
  const rawValue = readText(formData, name);

  if (rawValue.length === 0) {
    return {
      error: t`Please enter ${label}.`,
      value: Number.NaN,
    };
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    return {
      error: t`Please enter a whole number for ${label}.`,
      value: Number.NaN,
    };
  }

  if (min !== undefined && value < min) {
    return {
      error: t`Please enter a value of at least ${min} for ${label}.`,
      value,
    };
  }

  if (max !== undefined && value > max) {
    return {
      error: t`Please enter a value of at most ${max} for ${label}.`,
      value,
    };
  }

  return { value };
}

function hasErrors(fieldErrors: FieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}

function mapActionError(intent: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  switch (message) {
    case "Application admin not found":
      return t`The selected application admin no longer exists. Please refresh the page and try again.`;
    case "Application admin tokens cannot send mail directly":
      return t`Application-admin tokens are only meant for administration.`;
    case "Application not found":
      return t`The selected application no longer exists. Please refresh the page and try again.`;
    case "Application requires an SMTP config before tokens can be issued":
      return t`Create the SMTP configuration first, then issue an application token.`;
    case "Application tokens cannot include management scopes":
      return t`Application tokens may only be used for sending mail and reading status.`;
    case "Job not found":
      return t`This job no longer exists. Please refresh the page.`;
    case "Only failed or uncertain jobs can be retried manually":
      return t`Only failed jobs or jobs with uncertain delivery can be retried.`;
    case "Only paused jobs can be resumed":
      return t`Only paused jobs can be resumed.`;
    case "Only pending jobs can be paused":
      return t`This job cannot be paused in its current state.`;
    case "Private IPv4 targets are not allowed":
    case "Private IPv6 targets are not allowed":
      return t`Private network targets are not allowed for SMTP validation.`;
    case "Sent jobs cannot be deleted":
      return t`Sent jobs cannot be deleted.`;
    case "SMTP config not found":
      return t`The SMTP configuration could not be found anymore. Please refresh the page and try again.`;
    case "System admin email address missing":
      return t`Pocket ID did not provide an email address for your account.`;
    case "Token not found":
      return t`This token no longer exists. Please refresh the page and try again.`;
    default:
      if (
        [
          "createApplication",
          "createApplicationAdmin",
          "createApplicationAdminToken",
          "createApplicationToken",
          "createConfig",
          "sendTestMail",
          "updateConfig",
          "validateConfig",
        ].includes(intent)
      ) {
        return t`The form could not be saved. Please review the entries and try again.`;
      }

      if (
        [
          "deleteJob",
          "deleteToken",
          "lockSmtpConfig",
          "pauseJob",
          "resumeJob",
          "retryJob",
          "revokeToken",
          "rotateToken",
          "unlockSmtpConfig",
          "updateTokenScopes",
        ].includes(intent)
      ) {
        return t`The action could not be completed. Please refresh the page and try again.`;
      }

      return t`Something went wrong. Please try again.`;
  }
}

function getValidationNotice(result: Awaited<ReturnType<typeof validateSmtpConfig>>): {
  body: string;
  diagnostics?: Array<{ label: string; value: string }>;
  title: string;
  tone: NoticeTone;
} {
  if (result.ok) {
    return {
      body: t`The SMTP server accepted the current connection settings.`,
      title: t`SMTP configuration is valid`,
      tone: "success",
    };
  }

  return getMailerFailureNotice(result, {
    body: t`The connection test failed. Please review the SMTP settings and try again.`,
    title: t`SMTP validation failed`,
  });
}

function getTestMailNotice(result: Awaited<ReturnType<typeof sendSystemAdminTestMail>>): {
  body: string;
  diagnostics?: Array<{ label: string; value: string }>;
  title: string;
  tone: NoticeTone;
} {
  if (result.ok) {
    return {
      body: "",
      title: t`Test email sent`,
      tone: "success",
    };
  }

  return getMailerFailureNotice(result, {
    body: t`The test email could not be sent. Please review the SMTP settings and try again.`,
    title: t`Test email failed`,
  });
}

function getMailerFailureNotice(
  result: {
    category: "auth" | "config" | "content" | "network" | "rate_limit" | "tls" | "unknown";
    code?: string;
    debug?: {
      attempts: Array<{
        address: string;
        code?: string;
        family: number;
        message?: string;
        outcome: "failed" | "succeeded";
        phase: "send" | "verify";
      }>;
      host: string;
      minTlsVersion: "TLSv1.2" | "TLSv1.3";
      port: number;
      requireTls: boolean;
      resolvedTargets: string[];
      secure: boolean;
    };
    message: string;
    providerResponseCode?: number;
  },
  genericNotice: { body: string; title: string },
): {
  body: string;
  diagnostics?: Array<{ label: string; value: string }>;
  title: string;
  tone: NoticeTone;
} {
  const diagnostics = getMailerDiagnostics(result);
  switch (result.category) {
    case "auth":
      return {
        body: t`Check user name and password. The SMTP server rejected the credentials.`,
        diagnostics,
        title: t`SMTP login failed`,
        tone: "error",
      };
    case "config":
      return {
        body: t`Check host, port and TLS settings. The connection data is not accepted in this form.`,
        diagnostics,
        title: t`SMTP configuration needs attention`,
        tone: "error",
      };
    case "content":
    case "unknown":
      return {
        ...genericNotice,
        diagnostics,
        tone: "error",
      };
    case "network":
      return {
        body: t`The SMTP server could not be reached. Check host, port and network access.`,
        diagnostics,
        title: t`SMTP server not reachable`,
        tone: "error",
      };
    case "rate_limit":
      return {
        body: t`The SMTP server is currently limiting requests. Please wait a moment and try again.`,
        diagnostics,
        title: t`SMTP server is busy`,
        tone: "error",
      };
    case "tls":
      return {
        body: t`A secure connection could not be established. Check the TLS settings and certificates.`,
        diagnostics,
        title: t`Secure connection failed`,
        tone: "error",
      };
  }
}

function getMailerDiagnostics(result: {
  code?: string;
  debug?: {
    attempts: Array<{
      address: string;
      code?: string;
      family: number;
      message?: string;
      outcome: "failed" | "succeeded";
      phase: "send" | "verify";
    }>;
    host: string;
    minTlsVersion: "TLSv1.2" | "TLSv1.3";
    port: number;
    requireTls: boolean;
    resolvedTargets: string[];
    secure: boolean;
  };
  message: string;
  providerResponseCode?: number;
}): Array<{ label: string; value: string }> | undefined {
  const diagnostics: Array<{ label: string; value: string }> = [];

  if (result.message.length > 0) {
    diagnostics.push({
      label: t`Error`,
      value: result.code ? `${result.code}: ${result.message}` : result.message,
    });
  }

  if (result.providerResponseCode !== undefined) {
    diagnostics.push({
      label: t`Provider response`,
      value: String(result.providerResponseCode),
    });
  }

  if (result.debug) {
    diagnostics.push({
      label: t`SMTP target`,
      value: `${result.debug.host}:${result.debug.port}`,
    });

    if (result.debug.resolvedTargets.length > 0) {
      diagnostics.push({
        label: t`Resolved targets`,
        value: result.debug.resolvedTargets.join(", "),
      });
    }

    diagnostics.push({
      label: t`Transport`,
      value: `secure=${result.debug.secure ? "true" : "false"}, requireTls=${
        result.debug.requireTls ? "true" : "false"
      }, minTlsVersion=${result.debug.minTlsVersion}`,
    });

    if (result.debug.attempts.length > 0) {
      diagnostics.push({
        label: t`Attempts`,
        value: result.debug.attempts
          .map((attempt) => {
            const family = attempt.family === 6 ? "IPv6" : "IPv4";
            const detail =
              attempt.outcome === "succeeded"
                ? "success"
                : attempt.code
                  ? `${attempt.code}: ${attempt.message || ""}`.trim()
                  : attempt.message || "failed";
            return `${attempt.phase} ${family} ${attempt.address} -> ${detail}`;
          })
          .join("; "),
      });
    }
  }

  return diagnostics.length > 0 ? diagnostics : undefined;
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  requireMethod(request, "POST");
  ensureRuntimeStarted();
  await activateServerI18n(resolveLocaleFromRequest(request));

  const user = await requireSystemAdminUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const formKey = String(formData.get("formKey") || intent || "dashboard");
  const values = getSerializableValues(formData);

  try {
    if (intent === "createApplicationAdmin") {
      const fieldErrors: FieldErrors = {};
      const label = requireText(formData, { label: t`Label`, name: "label" });
      if (label.error) {
        fieldErrors.label = label.error;
      }
      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const admin = createApplicationAdmin(user.oidcSubject, "systemAdmin", {
        label: label.value,
      });
      return createSuccessResponse({
        body: t`${admin.label} can now receive admin tokens and own applications.`,
        formKey,
        intent,
        title: t`Application admin created`,
      });
    }

    if (intent === "createApplication") {
      const fieldErrors: FieldErrors = {};
      const label = requireText(formData, { label: t`Label`, name: "label" });
      const applicationAdminId = requireText(formData, {
        label: t`Application admin`,
        name: "applicationAdminId",
      });
      if (label.error) {
        fieldErrors.label = label.error;
      }
      if (applicationAdminId.error) {
        fieldErrors.applicationAdminId = applicationAdminId.error;
      }

      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const application = createApplication(user.oidcSubject, "systemAdmin", {
        applicationAdminId: applicationAdminId.value,
        label: label.value,
      });
      return createSuccessResponse({
        body: t`${application.label} is ready for an SMTP configuration and application tokens.`,
        formKey,
        intent,
        title: t`Application created`,
      });
    }

    if (intent === "renameApplicationAdmin") {
      const fieldErrors: FieldErrors = {};
      const applicationAdminId = requireText(formData, {
        label: t`Application admin`,
        name: "applicationAdminId",
      });
      const label = requireText(formData, { label: t`Label`, name: "label" });
      if (applicationAdminId.error) {
        fieldErrors.applicationAdminId = applicationAdminId.error;
      }
      if (label.error) {
        fieldErrors.label = label.error;
      }
      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const admin = renameApplicationAdmin(user.oidcSubject, "systemAdmin", {
        applicationAdminId: applicationAdminId.value,
        label: label.value,
      });
      return createSuccessResponse({
        body: t`Renamed to ${admin.label}.`,
        formKey,
        intent,
        title: t`Application admin renamed`,
      });
    }

    if (intent === "renameApplication") {
      const fieldErrors: FieldErrors = {};
      const applicationId = requireText(formData, {
        label: t`Application`,
        name: "applicationId",
      });
      const label = requireText(formData, { label: t`Label`, name: "label" });
      if (applicationId.error) {
        fieldErrors.applicationId = applicationId.error;
      }
      if (label.error) {
        fieldErrors.label = label.error;
      }
      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const application = renameApplication(user.oidcSubject, "systemAdmin", {
        applicationId: applicationId.value,
        label: label.value,
      });
      return createSuccessResponse({
        body: t`Renamed to ${application.label}.`,
        formKey,
        intent,
        title: t`Application renamed`,
      });
    }

    if (intent === "createConfig" || intent === "updateConfig") {
      const fieldErrors: FieldErrors = {};
      const applicationId = requireText(formData, { label: t`Application`, name: "applicationId" });
      const name = requireText(formData, { label: t`Name`, name: "name" });
      const host = requireText(formData, { label: t`Host`, name: "host" });
      const port = readInteger(formData, {
        label: t`Port`,
        max: 65_535,
        min: 1,
        name: "port",
      });
      const defaultFromAddress = requireEmailAddress(formData, {
        label: t`Default from address`,
        name: "defaultFromAddress",
      });
      const username = requireText(formData, { label: t`Username`, name: "username" });
      const connectionTimeoutMs = readInteger(formData, {
        label: t`Connection timeout ms`,
        max: 120_000,
        min: 100,
        name: "connectionTimeoutMs",
      });
      const greetingTimeoutMs = readInteger(formData, {
        label: t`Greeting timeout ms`,
        max: 120_000,
        min: 100,
        name: "greetingTimeoutMs",
      });
      const socketTimeoutMs = readInteger(formData, {
        label: t`Socket timeout ms`,
        max: 120_000,
        min: 100,
        name: "socketTimeoutMs",
      });
      const sendRateLimitPerMinute = readInteger(formData, {
        label: t`Send rate limit per minute`,
        max: 10_000,
        min: 0,
        name: "sendRateLimitPerMinute",
      });
      if (applicationId.error) {
        fieldErrors.applicationId = applicationId.error;
      }
      if (name.error) {
        fieldErrors.name = name.error;
      }
      if (host.error) {
        fieldErrors.host = host.error;
      }
      if (port.error) {
        fieldErrors.port = port.error;
      }
      if (defaultFromAddress.error) {
        fieldErrors.defaultFromAddress = defaultFromAddress.error;
      }
      if (username.error) {
        fieldErrors.username = username.error;
      }
      if (connectionTimeoutMs.error) {
        fieldErrors.connectionTimeoutMs = connectionTimeoutMs.error;
      }
      if (greetingTimeoutMs.error) {
        fieldErrors.greetingTimeoutMs = greetingTimeoutMs.error;
      }
      if (socketTimeoutMs.error) {
        fieldErrors.socketTimeoutMs = socketTimeoutMs.error;
      }
      if (sendRateLimitPerMinute.error) {
        fieldErrors.sendRateLimitPerMinute = sendRateLimitPerMinute.error;
      }
      const minTlsVersion =
        (readText(formData, "minTlsVersion") as "TLSv1.2" | "TLSv1.3") || "TLSv1.2";

      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      upsertSmtpConfig(
        user.oidcSubject,
        "systemAdmin",
        {
          applicationId: applicationId.value,
          connectionTimeoutMs: connectionTimeoutMs.value,
          defaultFromAddress: defaultFromAddress.value,
          greetingTimeoutMs: greetingTimeoutMs.value,
          host: host.value,
          minTlsVersion,
          name: name.value,
          password: readText(formData, "password") || undefined,
          port: port.value,
          requireTls: readBoolean(formData, "requireTls"),
          secure: readBoolean(formData, "secure"),
          sendRateLimitPerMinute: sendRateLimitPerMinute.value,
          socketTimeoutMs: socketTimeoutMs.value,
          username: username.value,
        },
        readText(formData, "configId") || undefined,
      );

      return createSuccessResponse({
        body:
          intent === "createConfig"
            ? t`The application can now be validated and receive application tokens.`
            : t`The SMTP configuration has been updated successfully.`,
        formKey,
        intent,
        title:
          intent === "createConfig" ? t`SMTP configuration created` : t`SMTP configuration updated`,
      });
    }

    if (intent === "validateConfig") {
      const configId = requireText(formData, { label: t`SMTP configuration`, name: "configId" });
      if (configId.error) {
        return createActionResponse({
          formError: configId.error,
          formKey,
          intent,
          ok: false,
          values,
        });
      }

      const result = await validateSmtpConfig(configId.value);
      const notice = getValidationNotice(result);

      return createActionResponse({
        formKey,
        intent,
        notice,
        ok: result.ok,
      });
    }

    if (intent === "sendTestMail") {
      const configId = requireText(formData, { label: t`SMTP configuration`, name: "configId" });
      if (configId.error) {
        return createActionResponse({
          formError: configId.error,
          formKey,
          intent,
          ok: false,
          values,
        });
      }

      if (!user.email) {
        throw new Error("System admin email address missing");
      }

      const result = await sendSystemAdminTestMail(user.oidcSubject, configId.value, user.email);
      if (result.ok) {
        return createSuccessResponse({
          body: t`A test email was sent to ${user.email}.`,
          formKey,
          intent,
          title: t`Test email sent`,
        });
      }

      return createActionResponse({
        formKey,
        intent,
        notice: getTestMailNotice(result),
        ok: false,
      });
    }

    if (intent === "createApplicationAdminToken") {
      const fieldErrors: FieldErrors = {};
      const applicationAdminId = requireText(formData, {
        label: t`Application admin`,
        name: "applicationAdminId",
      });
      const label = requireText(formData, { label: t`Label`, name: "label" });
      if (applicationAdminId.error) {
        fieldErrors.applicationAdminId = applicationAdminId.error;
      }
      if (label.error) {
        fieldErrors.label = label.error;
      }
      const scopes = formData.getAll("scopes").map((scope) => String(scope)) as TokenScope[];
      if (scopes.length === 0) {
        fieldErrors.scopes = t`Please select at least one permission.`;
      }

      const retainSentJobsDays = readInteger(formData, {
        label: t`Retain sent jobs (days)`,
        max: 365,
        min: 1,
        name: "retainSentJobsDays",
      });
      const retainFailedJobsDays = readInteger(formData, {
        label: t`Retain failed jobs (days)`,
        max: 365,
        min: 1,
        name: "retainFailedJobsDays",
      });
      const retainAttachmentsDays = readInteger(formData, {
        label: t`Retain attachments (days)`,
        max: 365,
        min: 1,
        name: "retainAttachmentsDays",
      });
      const retainErrorDetailsDays = readInteger(formData, {
        label: t`Retain error details (days)`,
        max: 365,
        min: 1,
        name: "retainErrorDetailsDays",
      });
      if (retainSentJobsDays.error) {
        fieldErrors.retainSentJobsDays = retainSentJobsDays.error;
      }
      if (retainFailedJobsDays.error) {
        fieldErrors.retainFailedJobsDays = retainFailedJobsDays.error;
      }
      if (retainAttachmentsDays.error) {
        fieldErrors.retainAttachmentsDays = retainAttachmentsDays.error;
      }
      if (retainErrorDetailsDays.error) {
        fieldErrors.retainErrorDetailsDays = retainErrorDetailsDays.error;
      }

      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const token = createApplicationAdminToken(user.oidcSubject, "systemAdmin", {
        applicationAdminId: applicationAdminId.value,
        label: label.value,
        retainAttachmentsDays: retainAttachmentsDays.value,
        retainErrorDetailsDays: retainErrorDetailsDays.value,
        retainFailedJobsDays: retainFailedJobsDays.value,
        retainSentJobsDays: retainSentJobsDays.value,
        scopes,
      });

      return createSuccessResponse({
        body: t`Copy the client credentials now. The client secret will not be shown in full again.`,
        clientId: token.clientId,
        clientSecret: token.clientSecret,
        formKey,
        intent,
        title: t`Admin token created`,
      });
    }

    if (intent === "createApplicationToken") {
      const fieldErrors: FieldErrors = {};
      const applicationId = requireText(formData, { label: t`Application`, name: "applicationId" });
      const label = requireText(formData, { label: t`Label`, name: "label" });
      if (applicationId.error) {
        fieldErrors.applicationId = applicationId.error;
      }
      if (label.error) {
        fieldErrors.label = label.error;
      }
      const scopes = formData.getAll("scopes").map((scope) => String(scope)) as TokenScope[];
      if (scopes.length === 0) {
        fieldErrors.scopes = t`Please select at least one permission.`;
      }

      const retainSentJobsDays = readInteger(formData, {
        label: t`Retain sent jobs (days)`,
        max: 365,
        min: 1,
        name: "retainSentJobsDays",
      });
      const retainFailedJobsDays = readInteger(formData, {
        label: t`Retain failed jobs (days)`,
        max: 365,
        min: 1,
        name: "retainFailedJobsDays",
      });
      const retainAttachmentsDays = readInteger(formData, {
        label: t`Retain attachments (days)`,
        max: 365,
        min: 1,
        name: "retainAttachmentsDays",
      });
      const retainErrorDetailsDays = readInteger(formData, {
        label: t`Retain error details (days)`,
        max: 365,
        min: 1,
        name: "retainErrorDetailsDays",
      });
      if (retainSentJobsDays.error) {
        fieldErrors.retainSentJobsDays = retainSentJobsDays.error;
      }
      if (retainFailedJobsDays.error) {
        fieldErrors.retainFailedJobsDays = retainFailedJobsDays.error;
      }
      if (retainAttachmentsDays.error) {
        fieldErrors.retainAttachmentsDays = retainAttachmentsDays.error;
      }
      if (retainErrorDetailsDays.error) {
        fieldErrors.retainErrorDetailsDays = retainErrorDetailsDays.error;
      }

      if (hasErrors(fieldErrors)) {
        return createInvalidResponse({ fieldErrors, formKey, intent, values });
      }

      const token = createApplicationToken(user.oidcSubject, "systemAdmin", {
        applicationId: applicationId.value,
        label: label.value,
        retainAttachmentsDays: retainAttachmentsDays.value,
        retainErrorDetailsDays: retainErrorDetailsDays.value,
        retainFailedJobsDays: retainFailedJobsDays.value,
        retainSentJobsDays: retainSentJobsDays.value,
        scopes,
      });

      return createSuccessResponse({
        body: t`Copy the client credentials now. The client secret will not be shown in full again.`,
        clientId: token.clientId,
        clientSecret: token.clientSecret,
        formKey,
        intent,
        title: t`Application token created`,
      });
    }

    if (intent === "rotateToken") {
      const token = rotateToken(
        user.oidcSubject,
        "systemAdmin",
        String(formData.get("tokenId") || ""),
      );
      return createSuccessResponse({
        body: t`Copy the new client secret now. It replaces the previous secret immediately.`,
        clientId: token.clientId,
        clientSecret: token.clientSecret,
        formKey,
        intent,
        title: t`Client secret rotated`,
      });
    }

    if (intent === "revokeToken") {
      revokeToken(user.oidcSubject, "systemAdmin", String(formData.get("tokenId") || ""));
      return createSuccessResponse({
        body: t`The token can no longer be used for API access.`,
        formKey,
        intent,
        title: t`Token revoked`,
      });
    }

    if (intent === "deleteToken") {
      const token = getTokenById(String(formData.get("tokenId") || ""));
      deleteToken(user.oidcSubject, "systemAdmin", token.id);
      return createSuccessResponse({
        body: t`${token.label} has been removed permanently.`,
        formKey,
        intent,
        title: t`Token deleted`,
      });
    }

    if (intent === "updateTokenScopes") {
      const tokenId = String(formData.get("tokenId") || "");
      const scopes = formData.getAll("scopes").map((scope) => String(scope)) as TokenScope[];

      if (scopes.length === 0) {
        return createInvalidResponse({
          fieldErrors: { scopes: t`Please select at least one permission.` },
          formKey,
          intent,
          values,
        });
      }

      const token = updateTokenScopes(user.oidcSubject, "systemAdmin", tokenId, { scopes });

      return createSuccessResponse({
        body: t`Scopes updated to: ${token.scopes.join(", ")}`,
        formKey,
        intent,
        title: t`Token scopes updated`,
      });
    }

    if (intent === "lockSmtpConfig") {
      const configId = String(formData.get("configId") || "");
      lockSmtpConfig(user.oidcSubject, "systemAdmin", configId);
      return createSuccessResponse({
        body: t`The SMTP configuration is now locked. Config updates and token creation are blocked.`,
        formKey,
        intent,
        title: t`SMTP config locked`,
      });
    }

    if (intent === "unlockSmtpConfig") {
      const configId = String(formData.get("configId") || "");
      unlockSmtpConfig(user.oidcSubject, "systemAdmin", configId);
      return createSuccessResponse({
        body: t`The SMTP configuration is now unlocked.`,
        formKey,
        intent,
        title: t`SMTP config unlocked`,
      });
    }

    if (intent === "pauseJob") {
      pauseJob(user.oidcSubject, "systemAdmin", String(formData.get("jobId") || ""));
      return createSuccessResponse({
        body: t`The delivery attempt has been stopped for now.`,
        formKey,
        intent,
        title: t`Job paused`,
      });
    }

    if (intent === "resumeJob") {
      resumeJob(user.oidcSubject, "systemAdmin", String(formData.get("jobId") || ""));
      return createSuccessResponse({
        body: t`The job has been queued again for delivery.`,
        formKey,
        intent,
        title: t`Job resumed`,
      });
    }

    if (intent === "retryJob") {
      retryJob(user.oidcSubject, "systemAdmin", String(formData.get("jobId") || ""));
      return createSuccessResponse({
        body: t`A new delivery attempt has been scheduled immediately.`,
        formKey,
        intent,
        title: t`Job queued again`,
      });
    }

    if (intent === "deleteJob") {
      deleteJob(user.oidcSubject, "systemAdmin", String(formData.get("jobId") || ""));
      return createSuccessResponse({
        body: t`The job will no longer be processed.`,
        formKey,
        intent,
        title: t`Job removed from queue`,
      });
    }

    return createActionResponse({
      formError: t`This action is not supported.`,
      formKey,
      intent,
      ok: false,
      values,
    });
  } catch (error) {
    return createActionResponse({
      formError: mapActionError(intent, error),
      formKey,
      intent,
      ok: false,
      values,
    });
  }
}
