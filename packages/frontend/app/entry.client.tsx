import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { DEFAULT_LOCALE, getClientBootstrapLocale, syncClientI18n } from "./lib/i18n";

const palamedesGlobal = globalThis as {
  __PALAMEDES_LOCALE__?: string;
} & typeof globalThis;

const locale = getClientBootstrapLocale(palamedesGlobal.__PALAMEDES_LOCALE__ ?? DEFAULT_LOCALE);
await syncClientI18n(locale);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
