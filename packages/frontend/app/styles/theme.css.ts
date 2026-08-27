import { createGlobalTheme, globalStyle } from "@vanilla-extract/css";

export const themeVariables = createGlobalTheme(":root", {
  color: {
    accent: "var(--relanto-color-bright)",
    accentSoft: "rgba(184, 135, 54, 0.16)",
    canvasBottom: "var(--relanto-color-paper)",
    canvasTop: "#fffdfa",
    ink: "var(--relanto-color-night)",
    inkSoft: "rgba(23, 36, 58, 0.72)",
    line: "rgba(48, 76, 103, 0.18)",
    mist: "rgba(239, 232, 216, 0.78)",
    panel: "rgba(255, 253, 250, 0.86)",
    panelStrong: "#fffdfa",
    shadow: "rgba(23, 36, 58, 0.16)",
  },
  font: {
    accent: "var(--relanto-font-accent)",
    body: "var(--relanto-font-body)",
    display: "var(--relanto-font-display)",
  },
  radius: {
    lg: "2rem",
    md: "1.5rem",
    pill: "999px",
    sm: "1rem",
  },
  space: {
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
  },
});

// Inform browser-native controls (scrollbars, form widgets, date pickers) that
// this UI is light-themed. Without this, some browsers apply dark-mode styles
// to native controls even when the surrounding page is visually light.
globalStyle(":root", {
  colorScheme: "light",
});
