import { style } from "@vanilla-extract/css";

import { themeVariables } from "../styles/theme.css";

export const page = style({
  alignItems: "center",
  display: "grid",
  minHeight: "100vh",
  padding: themeVariables.space[8],
  placeItems: "center",
});

export const card = style({
  background: themeVariables.color.mist,
  border: `1px solid ${themeVariables.color.accent}`,
  borderRadius: themeVariables.radius.md,
  maxWidth: "34rem",
  padding: themeVariables.space[8],
  width: "100%",
});

export const eyebrow = style({
  color: "var(--relanto-color-base)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase",
});

export const title = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.display,
  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
  fontWeight: 700,
  lineHeight: 0.95,
  margin: `${themeVariables.space[3]} 0 0`,
});

export const pitch = style({
  color: themeVariables.color.inkSoft,
  fontSize: "1.05rem",
  lineHeight: 1.6,
  marginTop: themeVariables.space[3],
});

export const lead = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.7,
  marginTop: themeVariables.space[4],
});

export const errorText = style({
  color: "#9f2434",
  lineHeight: 1.7,
  marginTop: themeVariables.space[4],
});

export const submit = style({
  background: "var(--relanto-color-base)",
  border: 0,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.canvasTop,
  cursor: "pointer",
  fontWeight: 700,
  marginTop: themeVariables.space[6],
  padding: "0.9rem 1.25rem",
  selectors: {
    "&:disabled": {
      background: themeVariables.color.inkSoft,
      cursor: "not-allowed",
      opacity: 0.55,
    },
  },
  transition: "opacity 180ms ease",
});
