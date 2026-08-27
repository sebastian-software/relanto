// @vitest-environment jsdom
/* eslint-disable react/no-flush-sync -- Forces synchronous React updates to assert rendered markup deterministically. */

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useLoaderData = vi.fn();

vi.mock("react-router", async () => {
  const React = await import("react");

  return {
    Form: ({ children, ...props }: React.ComponentPropsWithoutRef<"form">): React.JSX.Element =>
      React.createElement("form", props, children),
    useLoaderData: (): unknown => useLoaderData() as unknown,
  };
});

vi.mock("../lib/i18n/tag", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<number | string>): string =>
    strings.reduce((message, part, index) => message + part + String(values.at(index) ?? ""), ""),
}));

vi.mock("./login.css", () => ({
  card: "card",
  errorText: "errorText",
  eyebrow: "eyebrow",
  lead: "lead",
  page: "page",
  pitch: "pitch",
  submit: "submit",
  title: "title",
}));

// The component never touches the server helpers, but importing the module pulls
// them in, so stub them to keep the view test free of server-only dependencies.
vi.mock("../lib/server/oidc.server", () => ({ buildLoginUrl: vi.fn() }));
vi.mock("../lib/server/session.server", () => ({
  commitSession: vi.fn(),
  getSession: vi.fn(),
}));

describe("login view", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useLoaderData.mockReset();
  });

  async function render(data: { issuerConfigured: boolean; loginError?: string }): Promise<void> {
    useLoaderData.mockReturnValue(data);
    const { default: Login } = await import("./login");
    const root = createRoot(container);
    flushSync(() => {
      root.render(<Login />);
    });
  }

  function getSubmit(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!button) {
      throw new Error("Expected the continue submit button");
    }

    return button;
  }

  it("disables the continue button and applies the themed button class when OIDC is not configured", async () => {
    await render({ issuerConfigured: false });

    const button = getSubmit();
    expect(button.disabled).toBe(true);
    expect(button.className).toBe("submit");
    // Styling now lives in a stylesheet instead of inline raw color values.
    expect(button.getAttribute("style")).toBeNull();
  });

  it("enables the continue button when OIDC is configured", async () => {
    await render({ issuerConfigured: true });

    expect(getSubmit().disabled).toBe(false);
  });

  it("shows the Relanto Mailer eyebrow", async () => {
    await render({ issuerConfigured: true });

    const eyebrowEl = container.querySelector(".eyebrow");
    expect(eyebrowEl?.textContent).toBe("Relanto Mailer");
  });

  it("shows the product pitch sentence below the heading", async () => {
    await render({ issuerConfigured: true });

    const pitchEl = container.querySelector(".pitch");
    expect(pitchEl?.textContent).toBe("Self-hosted email delivery for your applications.");
  });
});
