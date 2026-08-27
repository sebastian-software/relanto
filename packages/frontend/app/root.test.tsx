// @vitest-environment jsdom
/* eslint-disable react/no-flush-sync -- These tests force synchronous React updates to assert document metadata deterministically. */

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import frontendPackage from "../package.json";
import {
  getBuildLabel,
  getCopyrightLabel,
  getShortGitHash,
} from "./lib/server/build-metadata.server";

const useLocation = vi.fn();
const useRouteLoaderData = vi.fn();

vi.mock("react-router", async () => {
  const React = await import("react");

  return {
    Form: ({ children, ...props }: React.ComponentPropsWithoutRef<"form">): React.JSX.Element =>
      React.createElement("form", props, children),
    isRouteErrorResponse: (): boolean => false,
    Links: (): React.JSX.Element =>
      React.createElement("link", {
        "data-application-link": "true",
        href: "/assets/application.css",
        rel: "stylesheet",
      }),
    Meta: (): null => null,
    Outlet: (): null => null,
    Scripts: (): null => null,
    ScrollRestoration: (): null => null,
    useLocation,
    useRouteLoaderData,
  };
});

vi.mock("./lib/server/auth.server", () => ({
  getOptionalSystemAdminUser: vi.fn(),
}));

vi.mock("./lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: vi.fn(),
}));

vi.mock("./lib/i18n/detectLocale.server", () => ({
  resolveLocaleFromRequest: vi.fn(),
}));

vi.mock("./lib/i18n", () => ({
  activateServerI18n: vi.fn(),
  getLocaleLabel: (locale: string) => locale.toUpperCase(),
}));

vi.mock("./lib/i18n/tag", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<number | string>) =>
    strings.reduce((message, part, index) => message + part + String(values.at(index) ?? ""), ""),
}));

vi.mock("./root.css", () => ({
  appEyebrow: "appEyebrow",
  appFooter: "appFooter",
  appFooterCopyright: "appFooterCopyright",
  appFooterMeta: "appFooterMeta",
  appFooterPlate: "appFooterPlate",
  appHeader: "appHeader",
  appHeaderActions: "appHeaderActions",
  appIdentity: "appIdentity",
  appUserName: "appUserName",
  errorCard: "errorCard",
  errorDetails: "errorDetails",
  errorLayout: "errorLayout",
  errorTitle: "errorTitle",
  ghostButton: "ghostButton",
  globalThemeClass: "globalThemeClass",
  localeButton: "localeButton",
  localeButtonActive: "localeButtonActive",
  localeSwitcher: "localeSwitcher",
}));

describe("build metadata", () => {
  it("formats the footer build label as version plus short hash", () => {
    expect(getBuildLabel({ RELANTO_GIT_SHORT_SHA: "86ebcd0f1234567" })).toBe(
      `v${frontendPackage.version}-86ebcd0`,
    );
  });

  it("falls back to the first seven characters of GITHUB_SHA", () => {
    expect(getShortGitHash({ GITHUB_SHA: "1234567890abcdef" })).toBe("1234567");
  });

  it("keeps the copyright year fixed at 2026 for 2026", () => {
    expect(getCopyrightLabel(2026)).toBe("Copyright 2026 Sebastian Software GmbH");
  });

  it("extends the copyright range once the current year moves forward", () => {
    expect(getCopyrightLabel(2027)).toBe("Copyright 2026-2027 Sebastian Software GmbH");
  });
});

describe("root layout", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    useRouteLoaderData.mockReturnValue({
      buildLabel: `v${frontendPackage.version}-86ebcd0`,
      copyrightLabel: "Copyright 2026 Sebastian Software GmbH",
      locale: "en",
      operatorAssets: {
        enabled: false,
        faviconHref: "/favicon.svg",
        logoHref: null,
        stylesheetHref: null,
      },
      user: {
        label: "System Admin",
      },
    });
    useLocation.mockReturnValue({
      hash: "",
      pathname: "/dashboard",
      search: "",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    useLocation.mockReset();
    useRouteLoaderData.mockReset();
  });

  it("renders the footer with copyright and build metadata", async () => {
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>content</main>
        </Layout>,
      );
    });

    expect(container.textContent).toContain("Copyright 2026 Sebastian Software GmbH");
    expect(container.textContent).toContain(`v${frontendPackage.version}-86ebcd0`);

    flushSync(() => {
      root.unmount();
    });
  });

  it("shows the product pitch as header subtitle for unauthenticated visitors", async () => {
    useRouteLoaderData.mockReturnValue({
      buildLabel: `v${frontendPackage.version}-86ebcd0`,
      copyrightLabel: "Copyright 2026 Sebastian Software GmbH",
      locale: "en",
      operatorAssets: {
        enabled: false,
        faviconHref: "/favicon.svg",
        logoHref: null,
        stylesheetHref: null,
      },
      user: null,
    });
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>content</main>
        </Layout>,
      );
    });

    const subtitle = container.querySelector(".appUserName");
    expect(subtitle?.textContent).toBe("Self-hosted email delivery for your applications.");

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders exactly one generic SVG favicon and no operator links when disabled", async () => {
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>content</main>
        </Layout>,
      );
    });

    const svgFavicons = document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    const operatorLinks = [
      ...document.head.querySelectorAll<HTMLLinkElement>('link[href^="/operator-assets/"]'),
    ];

    expect(svgFavicons).toHaveLength(1);
    expect(svgFavicons.item(0).getAttribute("href")).toBe("/favicon.svg");
    expect(operatorLinks).toStrictEqual([]);

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders only the operator SVG favicon and places its stylesheet after Links", async () => {
    useRouteLoaderData.mockReturnValue({
      buildLabel: `v${frontendPackage.version}-86ebcd0`,
      copyrightLabel: "Copyright 2026 Sebastian Software GmbH",
      locale: "en",
      operatorAssets: {
        enabled: true,
        faviconHref: "/operator-assets/favicon.svg",
        logoHref: "/operator-assets/logo-software.svg",
        stylesheetHref: "/operator-assets/theme.css",
      },
      user: null,
    });
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>content</main>
        </Layout>,
      );
    });

    const links = [...document.head.querySelectorAll<HTMLLinkElement>("link")];
    const svgFavicons = document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    const applicationLinksIndex = links.findIndex(
      (link) => link.dataset.applicationLink === "true",
    );
    const operatorStylesheetIndex = links.findIndex(
      (link) => link.getAttribute("href") === "/operator-assets/theme.css",
    );

    expect(svgFavicons).toHaveLength(1);
    expect(svgFavicons.item(0).getAttribute("href")).toBe("/operator-assets/favicon.svg");
    expect(document.head.querySelector('link[href="/favicon.svg"]')).toBeNull();
    expect(operatorStylesheetIndex).toBeGreaterThan(applicationLinksIndex);

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders with fallback metadata when route errors have no loader data", async () => {
    useRouteLoaderData.mockReturnValue(undefined);
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>not found</main>
        </Layout>,
      );
    });

    expect(container.textContent).toContain("not found");
    expect(container.textContent).toContain("Relanto Mailer");
    expect(container.textContent).toContain("dev");
    const svgFavicons = document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    expect(svgFavicons).toHaveLength(1);
    expect(svgFavicons.item(0).getAttribute("href")).toBe("/favicon.svg");
    expect(document.head.querySelector('link[href^="/operator-assets/"]')).toBeNull();

    flushSync(() => {
      root.unmount();
    });
  });

  it("marks the active locale button with aria-pressed and aria-current", async () => {
    const { Layout } = await import("./root");
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <Layout>
          <main>content</main>
        </Layout>,
      );
    });

    const localeButtons = [
      ...container.querySelectorAll<HTMLButtonElement>('button[name="locale"]'),
    ];
    const activeButton = localeButtons.find((button) => button.value === "en");
    const inactiveButton = localeButtons.find((button) => button.value === "de");

    expect(activeButton?.getAttribute("aria-pressed")).toBe("true");
    expect(activeButton?.getAttribute("aria-current")).toBe("true");
    expect(inactiveButton?.getAttribute("aria-pressed")).toBe("false");
    expect(inactiveButton?.getAttribute("aria-current")).toBeNull();

    flushSync(() => {
      root.unmount();
    });
  });
});
