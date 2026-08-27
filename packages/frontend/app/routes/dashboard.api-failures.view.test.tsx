// @vitest-environment jsdom
/* eslint-disable react/no-flush-sync -- Forces synchronous React updates to assert rendered markup deterministically. */

import type { ApiRequestFailure } from "@relanto/backend";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  };
});

vi.mock("../lib/i18n/tag", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<number | string>) =>
    strings.reduce((message, part, index) => message + part + String(values.at(index) ?? ""), ""),
}));

vi.mock("./dashboard.api-failures.css", () => ({
  buttonRow: "buttonRow",
  control: "control",
  emptyState: "emptyState",
  failuresTable: "failuresTable",
  field: "field",
  fieldLabel: "fieldLabel",
  filterForm: "filterForm",
  meta: "meta",
  primaryButton: "primaryButton",
  reasonBadge: "reasonBadge",
  reasonMessage: "reasonMessage",
  secondaryButton: "secondaryButton",
  statusPill: "statusPill",
  tableCell: "tableCell",
  tableHead: "tableHead",
  tableHeaderCell: "tableHeaderCell",
  tableRow: "tableRow",
  tableWrap: "tableWrap",
}));

describe("api failures FailureTable", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks every column header with scope=col", async () => {
    const { FailureTable } = await import("./dashboard.api-failures.view");
    const failures: ApiRequestFailure[] = [
      {
        applicationId: "app_1",
        clientId: "client_1",
        createdAt: "2026-06-05T12:00:00.000Z",
        httpStatus: 401,
        id: "fail_1",
        reasonCategory: "auth_invalid",
        reasonMessage: "Authentication failed",
        requestMethod: "POST",
        requestPath: "/api/send",
      },
    ];

    const root = createRoot(container);
    flushSync(() => {
      root.render(<FailureTable failures={failures} locale="en" />);
    });

    const headers = [...container.querySelectorAll("th")];
    expect(headers).toHaveLength(7);
    for (const header of headers) {
      expect(header.getAttribute("scope")).toBe("col");
    }

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders failure timestamps in UTC for stable server and client text", async () => {
    const { FailureTable } = await import("./dashboard.api-failures.view");
    const failures: ApiRequestFailure[] = [
      {
        applicationId: "app_1",
        clientId: "client_1",
        createdAt: "2026-06-05T12:00:00.000Z",
        httpStatus: 401,
        id: "fail_1",
        reasonCategory: "auth_invalid",
        reasonMessage: "Authentication failed",
        requestMethod: "POST",
        requestPath: "/api/send",
      },
    ];

    const root = createRoot(container);
    flushSync(() => {
      root.render(<FailureTable failures={failures} locale="en" />);
    });

    expect(container.textContent).toContain("Jun 5, 2026, 12:00:00 PM");

    flushSync(() => {
      root.unmount();
    });
  });
});
