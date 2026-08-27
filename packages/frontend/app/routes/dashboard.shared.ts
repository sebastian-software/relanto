export type NoticeTone = "error" | "info" | "success";
export type FieldErrors = Partial<Record<string, string>>;
export type FormValues = Record<string, string | string[]>;

export type DashboardActionData = {
  fieldErrors?: FieldErrors;
  formError?: string;
  formKey: string;
  intent: string;
  notice?: {
    body?: string;
    clientId?: string;
    clientSecret?: string;
    diagnostics?: Array<{ label: string; value: string }>;
    title: string;
    tone: NoticeTone;
  };
  ok: boolean;
  values?: FormValues;
};

export const TOKEN_SCOPES = [
  "send",
  "validate",
  "readStatus",
  "readConfig",
  "manageTokens",
  "manageApplications",
] as const;

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
export const DEFAULT_SOCKET_TIMEOUT_MS = 20_000;
export const DEFAULT_PORT = 587;

export const CREATE_ADMIN_FORM_KEY = "create-application-admin";
export const CREATE_APPLICATION_FORM_KEY = "create-application";
export const JOBS_FORM_KEY = "jobs-panel";

export function getFirstValue(values: FormValues | undefined, name: string): string | undefined {
  const value = values?.[name];
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

export function getManyValues(values: FormValues | undefined, name: string): string[] {
  const value = values?.[name];
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
