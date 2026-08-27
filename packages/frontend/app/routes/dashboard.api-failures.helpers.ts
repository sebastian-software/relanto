import type { ApiFailureReason, ApiRequestFailure, ListApiFailuresFilter } from "@relanto/backend";

import type { Locale } from "../lib/i18n";

import { t } from "../lib/i18n/tag";

export const REASON_VALUES = [
  "auth_missing",
  "auth_invalid",
  "scope_missing",
  "validation",
  "domain_error",
  "method_not_allowed",
  "rate_limited",
  "other",
] as const satisfies readonly ApiFailureReason[];

export const DEFAULT_LIMIT = 100;

export type RawFilters = {
  applicationId: string;
  fromTimestamp: string;
  httpStatus: string;
  reasonCategory: string;
  toTimestamp: string;
};

export type LoaderData = {
  failures: ApiRequestFailure[];
  filters: RawFilters;
  locale: Locale;
};

function parseHttpStatus(value: null | string): number | undefined {
  if (value === null || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
    return undefined;
  }

  return parsed;
}

function parseReasonCategory(value: null | string): ApiFailureReason | undefined {
  if (value === null || value.length === 0) {
    return undefined;
  }

  return REASON_VALUES.find((reason) => reason === value);
}

function parseTimestamp(value: null | string): string | undefined {
  if (value === null || value.length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Date.parse(trimmed);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

export function parseFilters(url: URL): {
  filter: ListApiFailuresFilter;
  raw: RawFilters;
} {
  const parameters = url.searchParams;
  const applicationId = (parameters.get("applicationId") ?? "").trim();
  const httpStatusRaw = (parameters.get("httpStatus") ?? "").trim();
  const reasonCategoryRaw = (parameters.get("reasonCategory") ?? "").trim();
  const fromRaw = (parameters.get("from") ?? "").trim();
  const toRaw = (parameters.get("to") ?? "").trim();

  const filter: ListApiFailuresFilter = {
    applicationId: applicationId.length > 0 ? applicationId : undefined,
    fromTimestamp: parseTimestamp(fromRaw),
    httpStatus: parseHttpStatus(httpStatusRaw),
    limit: DEFAULT_LIMIT,
    reasonCategory: parseReasonCategory(reasonCategoryRaw),
    toTimestamp: parseTimestamp(toRaw),
  };

  return {
    filter,
    raw: {
      applicationId,
      fromTimestamp: fromRaw,
      httpStatus: httpStatusRaw,
      reasonCategory: reasonCategoryRaw,
      toTimestamp: toRaw,
    },
  };
}

export function getReasonLabel(reason: ApiFailureReason): string {
  switch (reason) {
    case "auth_invalid":
      return t`Authentication failed`;
    case "auth_missing":
      return t`Missing bearer token`;
    case "domain_error":
      return t`Domain error`;
    case "method_not_allowed":
      return t`Method not allowed`;
    case "other":
      return t`Other`;
    case "rate_limited":
      return t`Rate limit exceeded`;
    case "scope_missing":
      return t`Scope missing`;
    case "validation":
      return t`Validation failed`;
  }
}

export function formatTimestamp(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function stringArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatExpectedScope(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const label = t`Expected scope`;
  return `${label}: ${value}`;
}

function formatIssuePathsField(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const stringIssuePaths = value.filter((entry): entry is string => typeof entry === "string");

  if (stringIssuePaths.length === 0) {
    return undefined;
  }

  const label = t`Issue paths`;
  const joined = stringIssuePaths.join(", ");
  return `${label}: ${joined}`;
}

function formatIssueCount(count: unknown, issuePaths: unknown): string | undefined {
  if (typeof count !== "number" || count <= stringArrayLength(issuePaths)) {
    return undefined;
  }

  const label = t`Total issues`;
  const value = String(count);
  return `${label}: ${value}`;
}

export function formatDetails(failure: ApiRequestFailure): string {
  if (!failure.details) {
    return "";
  }

  const parts: string[] = [];
  const expected = formatExpectedScope(failure.details.expectedScope);
  if (expected !== undefined) {
    parts.push(expected);
  }

  const paths = formatIssuePathsField(failure.details.issuePaths);
  if (paths !== undefined) {
    parts.push(paths);
  }

  const count = formatIssueCount(failure.details.issueCount, failure.details.issuePaths);
  if (count !== undefined) {
    parts.push(count);
  }

  return parts.join(" · ");
}
