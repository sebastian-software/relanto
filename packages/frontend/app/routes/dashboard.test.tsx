// @vitest-environment jsdom
/* cspell:ignore Revalidator revalidator wordmark Wordmark */
/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/require-await, react/no-flush-sync -- Dashboard tests narrow mocked values and force synchronous React updates for deterministic UI assertions. */

import * as backend from "@relanto/backend";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireSystemAdminUser } from "../lib/server/auth.server";

const useActionData = vi.fn();
const useFetcher = vi.fn();
const useLoaderData = vi.fn();
const useNavigation = vi.fn();
const useRevalidator = vi.fn();
const useRouteLoaderData = vi.fn();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean } & typeof globalThis
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@relanto/backend", () => ({
  createApplication: vi.fn(),
  createApplicationAdmin: vi.fn(),
  createApplicationAdminToken: vi.fn(),
  createApplicationToken: vi.fn(),
  deleteJob: vi.fn(),
  deleteToken: vi.fn(),
  getApplicationAdminById: vi.fn(),
  getApplicationById: vi.fn(),
  getSendRateLimitPerMinute: vi.fn(() => 60),
  getSmtpConfigByApplicationId: vi.fn(),
  getTokenById: vi.fn(),
  listApplicationAdmins: vi.fn(),
  listApplicationAdminTokens: vi.fn(),
  listApplications: vi.fn(),
  listApplicationTokensByApplication: vi.fn(),
  listJobs: vi.fn(),
  pauseJob: vi.fn(),
  renameApplication: vi.fn(),
  renameApplicationAdmin: vi.fn(),
  resumeJob: vi.fn(),
  retryJob: vi.fn(),
  revokeToken: vi.fn(),
  rotateToken: vi.fn(),
  sendSystemAdminTestMail: vi.fn(),
  upsertSmtpConfig: vi.fn(),
  validateSmtpConfig: vi.fn(),
}));

vi.mock("react-router", async () => {
  const React = await import("react");

  return {
    Form: ({ children, ...props }: React.ComponentPropsWithoutRef<"form">): React.JSX.Element =>
      React.createElement("form", props, children),
    Link: ({
      children,
      to,
      ...props
    }: { to: string } & React.ComponentPropsWithoutRef<"a">): React.JSX.Element =>
      React.createElement("a", { ...props, href: to }, children),
    useActionData,
    useFetcher: (): {
      data: unknown;
      load: (href: string) => void;
      state: string;
    } =>
      (useFetcher() as
        | {
            data: unknown;
            load: (href: string) => void;
            state: string;
          }
        | undefined) ?? {
        data: undefined,
        load(href: string) {
          void href;
        },
        state: "idle",
      },
    useLoaderData,
    // Default to an idle navigation so component code can read `state`/`formData`
    // without every test having to configure it; tests override as needed.
    useNavigation: (): { formData: FormData | undefined; state: string } =>
      (useNavigation() as { formData: FormData | undefined; state: string } | undefined) ?? {
        formData: undefined,
        state: "idle",
      },
    useRevalidator,
    useRouteLoaderData,
  };
});

vi.mock("../lib/server/auth.server", () => ({
  requireSystemAdminUser: vi.fn(),
}));

vi.mock("../lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: vi.fn(),
}));

vi.mock("../lib/i18n", () => ({
  activateServerI18n: vi.fn(),
}));

vi.mock("../lib/i18n/detectLocale.server", () => ({
  resolveLocaleFromRequest: vi.fn(),
}));

vi.mock("../lib/i18n/tag", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<number | string>) =>
    strings.reduce(
      (message, part, index) =>
        message + part + (values[index] === undefined ? "" : String(values[index])),
      "",
    ),
}));

vi.mock("./dashboard.css", () => ({
  actionRow: "actionRow",
  appIdBadge: "appIdBadge",
  applicationLinkButton: "applicationLinkButton",
  buttonVariants: {
    danger: "danger",
    primary: "primary",
    secondary: "secondary",
  },
  checkboxCard: "checkboxCard",
  checkboxField: "checkboxField",
  checkboxInput: "checkboxInput",
  checkboxRow: "checkboxRow",
  configCard: "configCard",
  configCardHighlight: "configCardHighlight",
  configGrid: "configGrid",
  configName: "configName",
  control: "control",
  controlInvalid: "controlInvalid",
  emptyState: "emptyState",
  eyebrow: "eyebrow",
  feedbackTitle: "feedbackTitle",
  field: "field",
  fieldError: "fieldError",
  fieldHint: "fieldHint",
  fieldLabel: "fieldLabel",
  fieldsetReset: "fieldsetReset",
  filterResetNotice: "filterResetNotice",
  filterResetNoticeButton: "filterResetNoticeButton",
  formGrid: "formGrid",
  formNotice: "formNotice",
  formNoticeBody: "formNoticeBody",
  formNoticeDiagnosticLabel: "formNoticeDiagnosticLabel",
  formNoticeDiagnosticRow: "formNoticeDiagnosticRow",
  formNoticeDiagnostics: "formNoticeDiagnostics",
  formNoticeDiagnosticValue: "formNoticeDiagnosticValue",
  formNoticeTitle: "formNoticeTitle",
  formNoticeVariants: {
    error: "error",
    info: "info",
    success: "success",
  },
  hero: "hero",
  heroBody: "heroBody",
  heroCopy: "heroCopy",
  heroLogo: "heroLogo",
  heroLogoPanel: "heroLogoPanel",
  heroLogoWrap: "heroLogoWrap",
  heroMeta: "heroMeta",
  heroTitle: "heroTitle",
  heroVisual: "heroVisual",
  heroVisualGlow: "heroVisualGlow",
  heroWordmark: "heroWordmark",
  inlineSplit: "inlineSplit",
  jobsTable: "jobsTable",
  jobsWrap: "jobsWrap",
  metaBadge: "metaBadge",
  modalActions: "modalActions",
  modalBackdrop: "modalBackdrop",
  modalBody: "modalBody",
  modalCard: "modalCard",
  modalDismiss: "modalDismiss",
  modalTitle: "modalTitle",
  panel: "panel",
  panelBody: "panelBody",
  panelBodyDense: "panelBodyDense",
  panelHeader: "panelHeader",
  panelKicker: "panelKicker",
  panelTitle: "panelTitle",
  principalInfo: "principalInfo",
  principalItem: "principalItem",
  principalLabel: "principalLabel",
  principalList: "principalList",
  principalMeta: "principalMeta",
  recordSummary: "recordSummary",
  recordSummaryHeader: "recordSummaryHeader",
  recordSummaryMeta: "recordSummaryMeta",
  reloadButtonGroup: "reloadButtonGroup",
  reloadTimestamp: "reloadTimestamp",
  secretCopy: "secretCopy",
  secretCopyFeedback: "secretCopyFeedback",
  sectionStack: "sectionStack",
  selectControl: "selectControl",
  shell: "shell",
  statCard: "statCard",
  statGrid: "statGrid",
  statHint: "statHint",
  statLabel: "statLabel",
  statusPill: "statusPill",
  statValue: "statValue",
  subGrid: "subGrid",
  subPanel: "subPanel",
  subTitle: "subTitle",
  tableCell: "tableCell",
  tableHead: "tableHead",
  tableHeaderCell: "tableHeaderCell",
  tableRow: "tableRow",
  tokenInfo: "tokenInfo",
  tokenItem: "tokenItem",
  tokenLabel: "tokenLabel",
  tokenList: "tokenList",
  tokenMeta: "tokenMeta",
  tokenSecret: "tokenSecret",
  tokenSecretValue: "tokenSecretValue",
  tokenStatus: "tokenStatus",
  twinGrid: "twinGrid",
}));

describe("dashboard identity", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useFetcher.mockReturnValue({ data: undefined, load: vi.fn(), state: "idle" });
    useLoaderData.mockReturnValue({
      admins: [],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useFetcher.mockReset();
    useLoaderData.mockReset();
    useRevalidator.mockReset();
    useRouteLoaderData.mockReset();
  });

  it("renders an accessible Relanto text identity in generic mode", async () => {
    useRouteLoaderData.mockReturnValue({
      operatorAssets: {
        enabled: false,
        faviconHref: "/favicon.svg",
        logoHref: null,
        stylesheetHref: null,
      },
    });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const wordmark = container.querySelector<HTMLElement>(".heroWordmark");
    expect(wordmark?.textContent).toBe("Relanto");
    expect(wordmark?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('img[alt="Sebastian Software"]')).toBeNull();
    expect(useRouteLoaderData).toHaveBeenCalledWith("root");

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders the fixed operator logo selected from root route loader data", async () => {
    useRouteLoaderData.mockReturnValue({
      operatorAssets: {
        enabled: true,
        faviconHref: "/operator-assets/favicon.svg",
        logoHref: "/operator-assets/logo-software.svg",
        stylesheetHref: "/operator-assets/theme.css",
      },
    });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const logo = container.querySelector<HTMLImageElement>('img[alt="Sebastian Software"]');
    expect(logo?.getAttribute("src")).toBe("/operator-assets/logo-software.svg");
    expect(container.querySelector(".heroWordmark")).toBeNull();
    expect(useRouteLoaderData).toHaveBeenCalledWith("root");

    flushSync(() => {
      root.unmount();
    });
  });
});

describe("dashboard lazy detail loaders", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
  });

  afterEach(() => {
    vi.mocked(backend.getApplicationAdminById).mockReset();
    vi.mocked(backend.getApplicationById).mockReset();
    vi.mocked(backend.getSmtpConfigByApplicationId).mockReset();
    vi.mocked(backend.listApplicationAdmins).mockReset();
    vi.mocked(backend.listApplicationAdminTokens).mockReset();
    vi.mocked(backend.listApplications).mockReset();
    vi.mocked(backend.listApplicationTokensByApplication).mockReset();
    vi.mocked(backend.listJobs).mockReset();
  });

  it("keeps SMTP configs and tokens out of the initial dashboard loader", async () => {
    vi.mocked(backend.listApplicationAdmins).mockReturnValue([
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "admin_1",
        label: "Admin One",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(backend.listApplications).mockReturnValue([
      {
        applicationAdminId: "admin_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "app_1",
        label: "Mailer App",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(backend.listJobs).mockReturnValue([]);

    const { loader } = await import("./dashboard");
    const result = await loader({
      request: new Request("http://localhost/"),
    } as Parameters<typeof loader>[0]);

    expect(result.admins[0]?.applications[0]).toStrictEqual({
      applicationAdminId: "admin_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "app_1",
      label: "Mailer App",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(backend.getSmtpConfigByApplicationId).not.toHaveBeenCalled();
    expect(backend.listApplicationAdminTokens).not.toHaveBeenCalled();
    expect(backend.listApplicationTokensByApplication).not.toHaveBeenCalled();
  });

  it("loads application detail data on the dashboard detail route", async () => {
    vi.mocked(backend.getApplicationById).mockReturnValue({
      applicationAdminId: "admin_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "app_1",
      label: "Mailer App",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(backend.getSmtpConfigByApplicationId).mockReturnValue({
      applicationAdminId: "admin_1",
      applicationId: "app_1",
      applicationLabel: "Mailer App",
      connectionTimeoutMs: 10_000,
      createdAt: "2026-01-01T00:00:00.000Z",
      defaultFromAddress: "sender@example.com",
      greetingTimeoutMs: 10_000,
      hasPassword: true,
      host: "smtp.example.com",
      id: "cfg_1",
      minTlsVersion: "TLSv1.2",
      name: "Primary",
      port: 587,
      requireTls: true,
      secure: false,
      sendRateLimitPerMinute: 60,
      socketTimeoutMs: 20_000,
      updatedAt: "2026-01-01T00:00:00.000Z",
      username: "mailer",
    });
    vi.mocked(backend.listApplicationTokensByApplication).mockReturnValue([]);

    const { loader } = await import("./dashboard.details.$detailKind.$detailId");
    const response = await loader({
      params: { detailId: "app_1", detailKind: "application" },
      request: new Request("http://localhost/dashboard/details/application/app_1"),
    } as Parameters<typeof loader>[0]);

    await expect(response.json()).resolves.toMatchObject({
      application: {
        config: {
          id: "cfg_1",
        },
        tokens: [],
      },
      kind: "application",
    });
  });

  it("degrades to a null config when the SMTP config fails to load", async () => {
    vi.mocked(backend.getApplicationById).mockReturnValue({
      applicationAdminId: "admin_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "app_1",
      label: "Mailer App",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    // Simulates a malformed row whose schema parsing throws (e.g. an invalid
    // min_tls_version), which previously bubbled up as an unhandled 500 and
    // replaced the entire dashboard.
    vi.mocked(backend.getSmtpConfigByApplicationId).mockImplementation(() => {
      throw new Error("Invalid enum value");
    });
    vi.mocked(backend.listApplicationTokensByApplication).mockReturnValue([]);

    const { loader } = await import("./dashboard.details.$detailKind.$detailId");
    const response = await loader({
      params: { detailId: "app_1", detailKind: "application" },
      request: new Request("http://localhost/dashboard/details/application/app_1"),
    } as Parameters<typeof loader>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      application: {
        config: null,
        tokens: [],
      },
      kind: "application",
    });
  });

  it("returns a handled 500 when the application lookup fails unexpectedly", async () => {
    vi.mocked(backend.getApplicationById).mockImplementation(() => {
      throw new Error("database is locked");
    });

    const { loader } = await import("./dashboard.details.$detailKind.$detailId");
    const response = await loader({
      params: { detailId: "app_1", detailKind: "application" },
      request: new Request("http://localhost/dashboard/details/application/app_1"),
    } as Parameters<typeof loader>[0]);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Failed to load dashboard detail",
    });
  });

  it("returns 404 when an application detail target no longer exists", async () => {
    vi.mocked(backend.getApplicationById).mockImplementation(() => {
      throw new Error("Application not found");
    });

    const { loader } = await import("./dashboard.details.$detailKind.$detailId");
    const response = await loader({
      params: { detailId: "app_missing", detailKind: "application" },
      request: new Request("http://localhost/dashboard/details/application/app_missing"),
    } as Parameters<typeof loader>[0]);

    await expect(response.json()).resolves.toStrictEqual({ error: "Application not found" });
    expect(response.status).toBe(404);
  });

  it("returns 404 when an admin detail target no longer exists", async () => {
    vi.mocked(backend.getApplicationAdminById).mockImplementation(() => {
      throw new Error("Application admin not found");
    });

    const { loader } = await import("./dashboard.details.$detailKind.$detailId");
    const response = await loader({
      params: { detailId: "admin_missing", detailKind: "admin" },
      request: new Request("http://localhost/dashboard/details/admin/admin_missing"),
    } as Parameters<typeof loader>[0]);

    await expect(response.json()).resolves.toStrictEqual({
      error: "Application admin not found",
    });
    expect(response.status).toBe(404);
  });
});

describe("dashboard create forms", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useFetcher.mockReturnValue({ data: undefined, load: vi.fn(), state: "idle" });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: {
                defaultFromAddress: "sender@example.com",
                host: "smtp.example.com",
                id: "cfg_1",
                port: 587,
              },
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [],
        },
      ],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useFetcher.mockReset();
    useLoaderData.mockReset();
    useRevalidator.mockReset();
  });

  function setInputValue(element: HTMLInputElement, value: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setSelectValue(element: HTMLSelectElement, value: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getSubmitButton(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(
      (button) => button.textContent === label,
    );
  }

  function getFormByIntent(intent: string): HTMLFormElement {
    const intentInput = container.querySelector<HTMLInputElement>(
      `input[name="intent"][value="${intent}"]`,
    );
    const form = intentInput?.closest("form");

    if (!form) {
      throw new Error(`Expected form for intent ${intent}`);
    }

    return form;
  }

  it("keeps inputs editable while submit buttons follow the live required fields", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const labelInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="label"]'),
    );
    const applicationAdminSelect = container.querySelector<HTMLSelectElement>(
      'select[name="applicationAdminId"]',
    );
    const submitButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    );

    expect(labelInputs).toHaveLength(2);
    expect(applicationAdminSelect).toBeTruthy();
    expect(submitButtons).toHaveLength(2);

    const createAdminInput = labelInputs[0];
    const createApplicationInput = labelInputs[1];
    const createAdminButton = submitButtons[0];
    const createApplicationButton = submitButtons[1];

    expect(createAdminInput.value).toBe("");
    expect(createAdminButton.disabled).toBe(true);
    expect(createApplicationInput.value).toBe("");
    expect(createApplicationButton.disabled).toBe(true);
    expect(applicationAdminSelect?.value).toBe("");

    await act(async () => {
      setInputValue(createAdminInput, "Mailer Admin");
    });

    expect(createAdminInput.value).toBe("Mailer Admin");
    expect(createAdminButton.disabled).toBe(false);

    await act(async () => {
      setInputValue(createApplicationInput, "Mailer App");
    });

    expect(createApplicationInput.value).toBe("Mailer App");
    expect(createApplicationButton.disabled).toBe(true);

    await act(async () => {
      if (!applicationAdminSelect) {
        throw new Error("Expected application admin select");
      }

      setSelectValue(applicationAdminSelect, "admin_1");
    });

    expect(applicationAdminSelect?.value).toBe("admin_1");
    expect(createApplicationButton.disabled).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders a send test email button for existing SMTP configurations", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );

    await act(async () => {
      manageButtons[1]?.click();
    });

    expect(getSubmitButton("Send test email")).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders the default from address field for SMTP configurations", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );

    await act(async () => {
      manageButtons[1]?.click();
    });

    const defaultFromInput = container.querySelector<HTMLInputElement>(
      'input[name="defaultFromAddress"]',
    );
    const sendRateLimitInput = container.querySelector<HTMLInputElement>(
      'input[name="sendRateLimitPerMinute"]',
    );

    expect(defaultFromInput).toBeTruthy();
    expect(defaultFromInput?.value).toBe("sender@example.com");
    expect(sendRateLimitInput).toBeTruthy();
    expect(sendRateLimitInput?.value).toBe("60");

    await act(async () => {
      root.unmount();
    });
  });

  it("marks the SMTP default from address field with autocomplete=off", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );

    await act(async () => {
      manageButtons[1]?.click();
    });

    const defaultFromInput = container.querySelector<HTMLInputElement>(
      'input[name="defaultFromAddress"]',
    );

    expect(defaultFromInput).toBeTruthy();
    expect(defaultFromInput?.getAttribute("autocomplete")).toBe("off");

    await act(async () => {
      root.unmount();
    });
  });

  it("marks the SMTP password field with autocomplete=new-password", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );

    await act(async () => {
      manageButtons[1]?.click();
    });

    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');

    expect(passwordInput).toBeTruthy();
    expect(passwordInput?.getAttribute("type")).toBe("password");
    expect(passwordInput?.getAttribute("autocomplete")).toBe("new-password");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the application id in the application card header", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    expect(container.textContent).toContain("App ID app_1");

    await act(async () => {
      root.unmount();
    });
  });

  it("disables token creation until label and scopes are valid", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    ).filter((button) => button.textContent === "Manage");

    expect(manageButtons).toHaveLength(2);

    await act(async () => {
      manageButtons[0]?.click();
      manageButtons[1]?.click();
    });

    const adminTokenForm = getFormByIntent("createApplicationAdminToken");
    const applicationTokenForm = getFormByIntent("createApplicationToken");
    const adminTokenInput = adminTokenForm.querySelector<HTMLInputElement>('input[name="label"]');
    const applicationTokenButton =
      applicationTokenForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const adminTokenButton =
      adminTokenForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const adminScopeCheckboxes = Array.from(
      adminTokenForm.querySelectorAll<HTMLInputElement>('input[name="scopes"]'),
    );

    expect(adminTokenInput).toBeTruthy();
    expect(adminTokenButton?.disabled).toBe(true);
    expect(applicationTokenButton?.disabled).toBe(true);

    await act(async () => {
      if (!adminTokenInput) {
        throw new Error("Expected admin token label input");
      }

      setInputValue(adminTokenInput, "Admin Token");
    });

    expect(adminTokenButton?.disabled).toBe(false);

    const checkedAdminScopeCheckboxes = adminScopeCheckboxes.filter((checkbox) => checkbox.checked);

    await act(async () => {
      for (const checkbox of checkedAdminScopeCheckboxes) {
        checkbox.click();
      }
    });

    expect(adminTokenButton?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders SMTP validation notices with technical transport details", async () => {
    useActionData.mockReturnValue({
      formKey: "config:app_1",
      intent: "validateConfig",
      notice: {
        body: "The SMTP server could not be reached. Check host, port and network access.",
        diagnostics: [
          { label: "Error", value: "ETIMEDOUT: Connection timeout" },
          { label: "Resolved targets", value: "2001:4860:4860::8888, 203.0.114.12" },
        ],
        title: "SMTP server not reachable",
        tone: "error",
      },
      ok: false,
    });

    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    );

    await act(async () => {
      manageButtons[1]?.click();
    });

    expect(container.textContent).toContain("SMTP server not reachable");
    expect(container.textContent).toContain("Error");
    expect(container.textContent).toContain("ETIMEDOUT: Connection timeout");
    expect(container.textContent).toContain("Resolved targets");
    expect(container.textContent).toContain("2001:4860:4860::8888, 203.0.114.12");

    await act(async () => {
      root.unmount();
    });
  });
});

describe("dashboard confirmation dialog focus management", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: {
                defaultFromAddress: "sender@example.com",
                host: "smtp.example.com",
                id: "cfg_1",
                port: 587,
              },
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [
            {
              clientId: "client_1",
              createdAt: new Date("2026-06-01T00:00:00Z").toISOString(),
              id: "token_1",
              label: "CI Token",
              revokedAt: null,
              scopes: ["manageTokens"],
            },
          ],
        },
      ],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useRevalidator.mockReset();
  });

  function getButtonByText(text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === text,
    );
    if (!button) {
      throw new Error(`Expected button with text ${text}`);
    }

    return button;
  }

  // The dialog holds a confirm button with the same label, so the trigger has to
  // be selected via its submit type to stay unambiguous.
  function getTriggerByText(text: string): HTMLButtonElement {
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    ).find((node) => node.textContent === text);
    if (!button) {
      throw new Error(`Expected trigger button with text ${text}`);
    }

    return button;
  }

  async function openTokenPanel(): Promise<void> {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);

    flushSync(() => {
      root.render(<Dashboard />);
    });

    // Reveal the token list (and its rotate/revoke/delete actions).
    await act(async () => {
      getButtonByText("Manage").click();
    });
  }

  function getOpenDialog(): HTMLDialogElement | null {
    return container.querySelector<HTMLDialogElement>("dialog[open]");
  }

  it("moves focus into the dialog (cancel button) when a destructive action is confirmed", async () => {
    await openTokenPanel();

    const deleteTrigger = getTriggerByText("Delete");

    await act(async () => {
      deleteTrigger.click();
    });

    const dialog = getOpenDialog();
    expect(dialog).toBeTruthy();

    // The non-destructive cancel action receives the initial focus.
    const cancelButton = dialog?.querySelector<HTMLButtonElement>("button");
    expect(cancelButton?.textContent).toBe("Cancel");
    expect(document.activeElement).toBe(cancelButton);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    await openTokenPanel();

    const deleteTrigger = getTriggerByText("Delete");

    await act(async () => {
      deleteTrigger.click();
    });

    const dialog = getOpenDialog();
    expect(dialog).toBeTruthy();

    await act(async () => {
      // jsdom does not implement native <dialog> Escape handling, so we rely on
      // the component's explicit onKeyDown handler. A real Escape keydown that
      // bubbles from the focused element to the dialog exercises that path.
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });

    expect(getOpenDialog()).toBeNull();
    expect(document.activeElement).toBe(deleteTrigger);
  });

  it("closes when the cancel button is pressed and returns focus to the trigger", async () => {
    await openTokenPanel();

    const deleteTrigger = getTriggerByText("Delete");

    await act(async () => {
      deleteTrigger.click();
    });

    const cancelButton = getOpenDialog()?.querySelector<HTMLButtonElement>("button");
    expect(cancelButton?.textContent).toBe("Cancel");

    await act(async () => {
      cancelButton?.click();
    });

    expect(getOpenDialog()).toBeNull();
    expect(document.activeElement).toBe(deleteTrigger);
  });
});

describe("dashboard sendTestMail action", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    vi.mocked(backend.sendSystemAdminTestMail).mockReset();
  });

  it("sends a test mail to the current Pocket ID email address", async () => {
    vi.mocked(backend.sendSystemAdminTestMail).mockResolvedValue({
      job: { id: "job_1", status: "sent" } as never,
      ok: true,
    });

    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "sendTestMail");
    formData.set("formKey", "config:app_1");
    formData.set("configId", "cfg_1");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(backend.sendSystemAdminTestMail).toHaveBeenCalledWith(
      "oidc-1",
      "cfg_1",
      "admin@example.com",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      formKey: "config:app_1",
      intent: "sendTestMail",
      notice: {
        body: "A test email was sent to admin@example.com.",
        title: "Test email sent",
        tone: "success",
      },
      ok: true,
    });
  });

  it("returns a clear error when Pocket ID did not provide an email address", async () => {
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });

    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "sendTestMail");
    formData.set("formKey", "config:app_1");
    formData.set("configId", "cfg_1");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(backend.sendSystemAdminTestMail).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      formError: "Pocket ID did not provide an email address for your account.",
      formKey: "config:app_1",
      intent: "sendTestMail",
      ok: false,
    });
  });

  it("returns a failure notice when the direct test mail does not succeed", async () => {
    vi.mocked(backend.sendSystemAdminTestMail).mockResolvedValue({
      category: "network",
      code: "ETIMEDOUT",
      debug: {
        attempts: [
          {
            address: "2001:4860:4860::8888",
            code: "ETIMEDOUT",
            family: 6,
            message: "Connection timeout",
            outcome: "failed",
            phase: "send",
          },
        ],
        host: "smtp.example.com",
        minTlsVersion: "TLSv1.2",
        port: 587,
        requireTls: true,
        resolvedTargets: ["2001:4860:4860::8888"],
        secure: false,
      },
      message: "Connection timeout",
      ok: false,
      permanent: false,
    });

    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "sendTestMail");
    formData.set("formKey", "config:app_1");
    formData.set("configId", "cfg_1");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    await expect(response.json()).resolves.toMatchObject({
      formKey: "config:app_1",
      intent: "sendTestMail",
      notice: {
        body: "The SMTP server could not be reached. Check host, port and network access.",
        diagnostics: [
          { label: "Error", value: "ETIMEDOUT: Connection timeout" },
          { label: "SMTP target", value: "smtp.example.com:587" },
          { label: "Resolved targets", value: "2001:4860:4860::8888" },
          {
            label: "Transport",
            value: "secure=false, requireTls=true, minTlsVersion=TLSv1.2",
          },
          {
            label: "Attempts",
            value: "send IPv6 2001:4860:4860::8888 -> ETIMEDOUT: Connection timeout",
          },
        ],
        title: "SMTP server not reachable",
        tone: "error",
      },
      ok: false,
    });
  });
});

describe("dashboard recent jobs application link", () => {
  let container: HTMLDivElement;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let matchMediaMock: ReturnType<typeof vi.fn>;

  function mockReducedMotion(reduce: boolean): void {
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === "(prefers-reduced-motion: reduce)" ? reduce : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMediaMock,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: null,
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [],
        },
        {
          applications: [
            {
              applicationAdminId: "admin_2",
              config: null,
              id: "app_2",
              label: "Reports App",
              tokens: [],
            },
          ],
          id: "admin_2",
          label: "Admin Two",
          tokens: [],
        },
      ],
      jobs: [
        {
          applicationId: "app_2",
          attempts: 0,
          createdAt: new Date("2026-06-05T12:00:00Z").toISOString(),
          errorCategory: null,
          errorCode: null,
          id: "job_1",
          lastError: null,
          status: "pending",
          subject: "Welcome mail",
        },
      ],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
      writable: true,
    });
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useRevalidator.mockReset();
  });

  function getApplicationLinkButton(label: string): HTMLButtonElement {
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.applicationLinkButton"),
    ).find((node) => node.textContent === label);
    if (!button) throw new Error(`Expected application link button for ${label}`);
    return button;
  }

  function getApplicationCard(applicationId: string): HTMLElement {
    const card = container.querySelector<HTMLElement>(`#application-${applicationId}`);
    if (!card) throw new Error(`Expected application card for ${applicationId}`);
    return card;
  }

  function getAdminSelect(): HTMLSelectElement {
    const node = container.querySelector<HTMLSelectElement>("select:not([name])");
    if (!node) throw new Error("Expected admin filter select");
    return node;
  }

  function changeAdminFilter(select: HTMLSelectElement, value: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    descriptor?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("renders the application name as a button with an aria-label", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const button = getApplicationLinkButton("Reports App");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-label")).toBe("Open configuration for Reports App");
    expect(button.type).toBe("button");
  });

  it("opens the application card, scrolls it into view smoothly and highlights it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    expect(getApplicationCard("app_2").getAttribute("data-highlight")).toBeNull();

    act(() => {
      getApplicationLinkButton("Reports App").click();
    });

    const card = getApplicationCard("app_2");
    expect(card.getAttribute("data-highlight")).toBe("true");
    expect(card.getAttribute("tabindex")).toBe("-1");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });

    const hideDetailsButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((node) => node.textContent === "Hide details");
    expect(hideDetailsButton).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(getApplicationCard("app_2").getAttribute("data-highlight")).toBeNull();
  });

  it("uses behavior auto when prefers-reduced-motion is active", async () => {
    mockReducedMotion(true);
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    act(() => {
      getApplicationLinkButton("Reports App").click();
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
    });
  });

  it("clears the admin filter and shows the restore notice when the application is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const adminSelect = getAdminSelect();
    act(() => {
      changeAdminFilter(adminSelect, "admin_1");
    });

    expect(container.querySelector("#application-app_2")).toBeNull();

    act(() => {
      getApplicationLinkButton("Reports App").click();
    });

    expect(getApplicationCard("app_2")).toBeTruthy();
    const notice = container.querySelector<HTMLElement>(".filterResetNotice");
    expect(notice?.getAttribute("role")).toBe("status");
    expect(notice?.getAttribute("aria-live")).toBe("polite");
    expect(notice?.textContent).toContain("Filter cleared to show Reports App.");

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(container.querySelector(".filterResetNotice")).toBeNull();
  });

  it("restores the previous admin filter when the restore button is clicked", async () => {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const adminSelect = getAdminSelect();
    act(() => {
      changeAdminFilter(adminSelect, "admin_1");
    });

    act(() => {
      getApplicationLinkButton("Reports App").click();
    });

    const restoreButton = container.querySelector<HTMLButtonElement>(
      "button.filterResetNoticeButton",
    );
    expect(restoreButton).toBeTruthy();

    act(() => {
      restoreButton?.click();
    });

    expect(container.querySelector(".filterResetNotice")).toBeNull();
    expect(adminSelect.value).toBe("admin_1");
    expect(container.querySelector("#application-app_2")).toBeNull();
  });
});

describe("dashboard recent jobs reload button", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useRevalidator.mockReset();
  });

  function getReloadButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(".reloadButtonGroup button");
    if (!button) throw new Error("Expected reload button");
    return button;
  }

  function getJobsPanel(): HTMLElement {
    const heading = Array.from(container.querySelectorAll<HTMLHeadingElement>("h2")).find(
      (node) => node.textContent === "Recent jobs",
    );
    const section = heading?.closest("section");
    if (!section) throw new Error("Expected recent jobs section");
    return section;
  }

  it("renders the reload button with last-updated timestamp in idle state", async () => {
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const button = getReloadButton();
    expect(button.textContent).toBe("Refresh");
    expect(button.disabled).toBe(false);
    expect(getJobsPanel().getAttribute("aria-busy")).toBe("false");

    const timestamp = container.querySelector(".reloadTimestamp");
    expect(timestamp?.textContent).toBe("Last updated");
  });

  it("renders job timestamps in UTC for stable server and client text", async () => {
    useLoaderData.mockReturnValue({
      admins: [],
      jobs: [
        {
          applicationId: "app_1",
          attempts: 0,
          createdAt: "2026-06-01T00:00:00.000Z",
          errorCategory: null,
          errorCode: null,
          id: "job_1",
          lastError: null,
          status: "queued",
          subject: "Welcome mail",
        },
      ],
      locale: "en",
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    expect(container.textContent).toContain("Jun 1, 2026, 12:00 AM");
  });

  it("calls revalidate when the reload button is clicked", async () => {
    const revalidate = vi.fn();
    useRevalidator.mockReturnValue({ revalidate, state: "idle" });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    act(() => {
      getReloadButton().click();
    });

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows a refreshing label while loading", async () => {
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "loading" });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const button = getReloadButton();
    expect(button.textContent).toBe("Refreshing…");
    expect(button.disabled).toBe(true);
    expect(getJobsPanel().getAttribute("aria-busy")).toBe("true");

    const timestamp = container.querySelector(".reloadTimestamp");
    expect(timestamp?.textContent).toBe("Refreshing…");
  });

  it("exposes the reload group as an aria-live polite region", async () => {
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    const group = container.querySelector(".reloadButtonGroup");
    expect(group?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("dashboard rename actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    vi.mocked(backend.renameApplicationAdmin).mockReset();
    vi.mocked(backend.renameApplication).mockReset();
  });

  it("renames an application admin and returns a success notice", async () => {
    vi.mocked(backend.renameApplicationAdmin).mockReturnValue({
      createdAt: "2026-06-06T00:00:00Z",
      id: "admin_1",
      label: "Renamed Admin",
      updatedAt: "2026-06-06T00:00:01Z",
    });

    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "renameApplicationAdmin");
    formData.set("formKey", "rename-application-admin:admin_1");
    formData.set("applicationAdminId", "admin_1");
    formData.set("label", "Renamed Admin");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(backend.renameApplicationAdmin).toHaveBeenCalledWith("oidc-1", "systemAdmin", {
      applicationAdminId: "admin_1",
      label: "Renamed Admin",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      formKey: "rename-application-admin:admin_1",
      intent: "renameApplicationAdmin",
      notice: {
        body: "Renamed to Renamed Admin.",
        title: "Application admin renamed",
        tone: "success",
      },
      ok: true,
    });
  });

  it("rejects an empty label with a field error and does not call the backend", async () => {
    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "renameApplicationAdmin");
    formData.set("formKey", "rename-application-admin:admin_1");
    formData.set("applicationAdminId", "admin_1");
    formData.set("label", "");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(backend.renameApplicationAdmin).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fieldErrors: { label: expect.stringContaining("Label") },
      formKey: "rename-application-admin:admin_1",
      intent: "renameApplicationAdmin",
      ok: false,
    });
  });

  it("renames an application and returns a success notice", async () => {
    vi.mocked(backend.renameApplication).mockReturnValue({
      applicationAdminId: "admin_1",
      createdAt: "2026-06-06T00:00:00Z",
      id: "app_1",
      label: "Renamed App",
      updatedAt: "2026-06-06T00:00:01Z",
    });

    const { action } = await import("./dashboard");
    const formData = new FormData();
    formData.set("intent", "renameApplication");
    formData.set("formKey", "rename-application:app_1");
    formData.set("applicationId", "app_1");
    formData.set("label", "Renamed App");

    const response = await action({
      context: {},
      params: {},
      request: new Request("http://localhost/dashboard", {
        body: formData,
        method: "POST",
      }),
    } as never);

    expect(backend.renameApplication).toHaveBeenCalledWith("oidc-1", "systemAdmin", {
      applicationId: "app_1",
      label: "Renamed App",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      formKey: "rename-application:app_1",
      intent: "renameApplication",
      notice: {
        body: "Renamed to Renamed App.",
        title: "Application renamed",
        tone: "success",
      },
      ok: true,
    });
  });
});

describe("dashboard form pending states", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: {
                defaultFromAddress: "sender@example.com",
                host: "smtp.example.com",
                id: "cfg_1",
                port: 587,
              },
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [
            {
              clientId: "client_1",
              createdAt: new Date("2026-06-01T00:00:00Z").toISOString(),
              id: "token_1",
              label: "CI Token",
              revokedAt: null,
              scopes: ["manageTokens"],
            },
          ],
        },
      ],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useNavigation.mockReset();
    useRevalidator.mockReset();
  });

  function submittingNavigation(entries: Record<string, string>): {
    formData: FormData;
    state: string;
  } {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) {
      formData.set(key, value);
    }

    return { formData, state: "submitting" };
  }

  function getButtonByText(text: string): HTMLButtonElement {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    const match = buttons.find((node) => node.textContent === text);
    if (!match) {
      throw new Error(`Expected a button labelled ${text}`);
    }

    return match;
  }

  function getSubmitTriggerByText(text: string): HTMLButtonElement {
    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    );
    const match = triggers.find((node) => node.textContent === text);
    if (!match) {
      throw new Error(`Expected a submit trigger labelled ${text}`);
    }

    return match;
  }

  function getOpenDialog(): HTMLDialogElement {
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    if (!dialog) {
      throw new Error("Expected an open confirmation dialog");
    }

    return dialog;
  }

  async function mountDashboard(): Promise<ReturnType<typeof createRoot>> {
    const { default: Dashboard } = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Dashboard />);
    });

    return root;
  }

  async function updateTree(root: ReturnType<typeof createRoot>): Promise<void> {
    const { default: Dashboard } = await import("./dashboard");
    flushSync(() => {
      root.render(<Dashboard />);
    });
  }

  async function openAllPanels(): Promise<void> {
    const manageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).filter((node) => node.textContent === "Manage");

    await act(async () => {
      for (const button of manageButtons) {
        button.click();
      }
    });
  }

  it("disables the create-admin submit button and shows a pending label while its submission is in flight", async () => {
    useNavigation.mockReturnValue(
      submittingNavigation({
        formKey: "create-application-admin",
        intent: "createApplicationAdmin",
      }),
    );

    await mountDashboard();

    const button = getButtonByText("Creating application admin…");
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    // A different form must stay in its normal (non-pending) state.
    expect(getButtonByText("Create application")).toBeTruthy();
  });

  it("restores the create-admin submit button once the navigation settles", async () => {
    useNavigation.mockReturnValue(
      submittingNavigation({
        formKey: "create-application-admin",
        intent: "createApplicationAdmin",
      }),
    );

    const root = await mountDashboard();
    expect(getButtonByText("Creating application admin…").disabled).toBe(true);

    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    await updateTree(root);

    const button = getButtonByText("Create application admin");
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("disables the send test email button and keeps the sibling validate button active", async () => {
    const root = await mountDashboard();
    await openAllPanels();

    useNavigation.mockReturnValue(
      submittingNavigation({ formKey: "config:app_1", intent: "sendTestMail" }),
    );
    await updateTree(root);

    const sendButton = getButtonByText("Sending test email…");
    expect(sendButton.disabled).toBe(true);

    // Same formKey, different intent: validate must not be blocked.
    const validateButton = getButtonByText("Validate config");
    expect(validateButton.disabled).toBe(false);
  });

  it("restores the send test email button after the request settles", async () => {
    const root = await mountDashboard();
    await openAllPanels();

    useNavigation.mockReturnValue(
      submittingNavigation({ formKey: "config:app_1", intent: "sendTestMail" }),
    );
    await updateTree(root);
    expect(getButtonByText("Sending test email…").disabled).toBe(true);

    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    await updateTree(root);

    const sendButton = getButtonByText("Send test email");
    expect(sendButton.disabled).toBe(false);
  });

  it("shows a pending state on the confirmation dialog confirm and cancel buttons", async () => {
    const root = await mountDashboard();
    await openAllPanels();

    const rotateTrigger = getSubmitTriggerByText("Rotate secret");

    await act(async () => {
      rotateTrigger.click();
    });

    useNavigation.mockReturnValue(
      submittingNavigation({
        formKey: "application-admin-token-list:admin_1",
        intent: "rotateToken",
        tokenId: "token_1",
      }),
    );
    await updateTree(root);

    const dialog = getOpenDialog();
    const dialogButtons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
    const cancelButton = dialogButtons[0];
    const confirmButton = dialogButtons[1];

    expect(cancelButton.textContent).toBe("Cancel");
    expect(cancelButton.disabled).toBe(true);
    expect(confirmButton.textContent).toBe("Working…");
    expect(confirmButton.disabled).toBe(true);
  });
});

describe("dashboard accessibility affordances", () => {
  let container: HTMLDivElement;

  const failedJob = {
    applicationId: "app_1",
    attempts: 1,
    createdAt: new Date("2026-06-05T12:00:00Z").toISOString(),
    errorCategory: "network",
    errorCode: "ETIMEDOUT",
    id: "job_1",
    lastError: "Connection timeout",
    status: "failed",
    subject: "Welcome mail",
  };

  function baseAdmin(tokens: unknown[] = []): unknown {
    return {
      applications: [
        {
          applicationAdminId: "admin_1",
          config: null,
          id: "app_1",
          label: "Mailer App",
          tokens: [],
        },
      ],
      id: "admin_1",
      label: "Admin One",
      tokens,
    };
  }

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [baseAdmin()],
      jobs: [failedJob],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useNavigation.mockReset();
    useRevalidator.mockReset();
  });

  async function renderDashboard(): Promise<void> {
    const DashboardModule = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<DashboardModule.default />);
    });
  }

  function getButtonByText(text: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === text,
    );
    if (!match) {
      throw new Error(`Expected a button labelled ${text}`);
    }

    return match;
  }

  it("gives the admin filter select an accessible name", async () => {
    await renderDashboard();

    const select = container.querySelector<HTMLSelectElement>("select:not([name])");
    expect(select?.getAttribute("aria-label")).toBe("Filter applications by admin");
  });

  it("marks the recent jobs column headers with scope=col", async () => {
    await renderDashboard();

    const headers = [...container.querySelectorAll<HTMLTableCellElement>("thead th")];
    expect(headers).toHaveLength(5);
    for (const header of headers) {
      expect(header.getAttribute("scope")).toBe("col");
    }
  });

  it("toggles aria-expanded on the job error details button", async () => {
    await renderDashboard();

    const toggle = getButtonByText("Show error");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("job-error-job_1");

    await act(async () => {
      toggle.click();
    });

    const expandedToggle = getButtonByText("Hide error");
    expect(expandedToggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#job-error-job_1")).toBeTruthy();
  });

  it("renders an error notice as an assertive alert region", async () => {
    useActionData.mockReturnValue({
      formError: "Please fix the highlighted fields.",
      formKey: "create-application-admin",
      intent: "createApplicationAdmin",
      ok: false,
    });

    await renderDashboard();

    const alert = Array.from(container.querySelectorAll<HTMLElement>('[role="alert"]')).find(
      (node) => node.textContent?.includes("Please fix the highlighted fields."),
    );
    expect(alert).toBeTruthy();
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
  });

  it("renders a success notice as a polite status region", async () => {
    useActionData.mockReturnValue({
      formKey: "create-application-admin",
      intent: "createApplicationAdmin",
      notice: {
        body: "The application admin was created.",
        title: "Application admin created",
        tone: "success",
      },
      ok: true,
    });

    await renderDashboard();

    const status = Array.from(container.querySelectorAll<HTMLElement>('[role="status"]')).find(
      (node) => node.textContent?.includes("Application admin created"),
    );
    expect(status).toBeTruthy();
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("moves focus into the client-secret box when a token secret is issued", async () => {
    useLoaderData.mockReturnValue({
      admins: [
        baseAdmin([
          {
            clientId: "client_1",
            createdAt: new Date("2026-06-01T00:00:00Z").toISOString(),
            id: "token_1",
            label: "CI Token",
            revokedAt: null,
            scopes: ["manageTokens"],
          },
        ]),
      ],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    useActionData.mockReturnValue({
      formKey: "application-admin-token-form:admin_1",
      intent: "createApplicationAdminToken",
      notice: {
        body: "Copy the client credentials now.",
        clientId: "client_1",
        clientSecret: "s3cr3t-value",
        title: "Admin token created",
        tone: "success",
      },
      ok: true,
    });

    await renderDashboard();

    await act(async () => {
      getButtonByText("Manage").click();
    });

    const secretBox = Array.from(container.querySelectorAll<HTMLElement>(".tokenSecret")).find(
      (node) => node.textContent?.includes("client_secret: s3cr3t-value"),
    );
    expect(secretBox).toBeTruthy();
    expect(secretBox?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(secretBox);
  });
});

describe("dashboard job delete confirmation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    useActionData.mockReturnValue(undefined);
    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: null,
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [],
        },
      ],
      jobs: [
        {
          applicationId: "app_1",
          attempts: 0,
          createdAt: new Date("2026-06-05T12:00:00Z").toISOString(),
          errorCategory: null,
          errorCode: null,
          id: "job_1",
          lastError: null,
          status: "pending",
          subject: "Welcome mail",
        },
      ],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useNavigation.mockReset();
    useRevalidator.mockReset();
  });

  function getSubmitTriggerByText(text: string): HTMLButtonElement {
    const match = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    ).find((node) => node.textContent === text);
    if (!match) {
      throw new Error(`Expected a submit trigger labelled ${text}`);
    }

    return match;
  }

  it("asks for confirmation before submitting a job deletion", async () => {
    const DashboardModule = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<DashboardModule.default />);
    });

    expect(container.querySelector("dialog[open]")).toBeNull();

    const deleteTrigger = getSubmitTriggerByText("Delete");
    let submitted = false;
    deleteTrigger.closest("form")?.addEventListener("submit", () => {
      submitted = true;
    });

    await act(async () => {
      deleteTrigger.click();
    });

    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]");
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain(
      "Do you really want to delete this job? This action cannot be undone.",
    );
    // Opening the confirmation must not fire the destructive submission yet.
    expect(submitted).toBe(false);
  });
});

describe("dashboard client secret copy button", () => {
  let container: HTMLDivElement;
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    useNavigation.mockReturnValue({ formData: undefined, state: "idle" });
    useRevalidator.mockReturnValue({ revalidate: vi.fn(), state: "idle" });
    vi.mocked(requireSystemAdminUser).mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "System Admin",
      oidcSubject: "oidc-1",
    });
    useLoaderData.mockReturnValue({
      admins: [
        {
          applications: [
            {
              applicationAdminId: "admin_1",
              config: null,
              id: "app_1",
              label: "Mailer App",
              tokens: [],
            },
          ],
          id: "admin_1",
          label: "Admin One",
          tokens: [
            {
              clientId: "client_1",
              createdAt: new Date("2026-06-01T00:00:00Z").toISOString(),
              id: "token_1",
              label: "CI Token",
              revokedAt: null,
              scopes: ["manageTokens"],
            },
          ],
        },
      ],
      jobs: [],
      user: {
        email: "admin@example.com",
        label: "System Admin",
        oidcSubject: "oidc-1",
      },
    });
    useActionData.mockReturnValue({
      formKey: "application-admin-token-form:admin_1",
      intent: "createApplicationAdminToken",
      notice: {
        body: "Copy the client credentials now.",
        clientId: "client_1",
        clientSecret: "s3cr3t-value",
        title: "Admin token created",
        tone: "success",
      },
      ok: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    document.body.innerHTML = "";
    useActionData.mockReset();
    useLoaderData.mockReset();
    useNavigation.mockReset();
    useRevalidator.mockReset();
  });

  function setClipboard(writeText: (value: string) => Promise<void>): void {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
      writable: true,
    });
  }

  async function renderAndOpenTokens(): Promise<void> {
    const DashboardModule = await import("./dashboard");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<DashboardModule.default />);
    });

    const manageButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === "Manage",
    );

    await act(async () => {
      manageButton?.click();
    });
  }

  function getCopyButton(): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === "Copy client secret",
    );
    if (!match) {
      throw new Error("Expected the copy client secret button");
    }

    return match;
  }

  it("copies the client secret and confirms with accessible feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await renderAndOpenTokens();

    const copyButton = getCopyButton();

    await act(async () => {
      copyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("s3cr3t-value");
    expect(copyButton.textContent).toBe("Copied");

    const feedback = container.querySelector<HTMLElement>(".secretCopyFeedback");
    expect(feedback?.getAttribute("aria-live")).toBe("polite");
    expect(feedback?.textContent).toBe("Client secret copied to the clipboard.");
  });

  it("surfaces an error message when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    setClipboard(writeText);

    await renderAndOpenTokens();

    const copyButton = getCopyButton();

    await act(async () => {
      copyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const feedback = container.querySelector<HTMLElement>(".secretCopyFeedback");
    expect(feedback?.textContent).toBe(
      "Could not copy automatically. Please select and copy the value manually.",
    );
  });
});
