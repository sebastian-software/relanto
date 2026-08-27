import { globalStyle, style } from "@vanilla-extract/css";

import { themeVariables } from "./styles/theme.css";

export const globalThemeClass = style({});

globalStyle("html", {
  background: themeVariables.color.canvasTop,
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.body,
});

globalStyle("body", {
  background: `linear-gradient(180deg, ${themeVariables.color.canvasTop} 0%, ${themeVariables.color.canvasBottom} 100%)`,
  color: themeVariables.color.ink,
  margin: 0,
  minHeight: "100vh",
});

globalStyle("body::before", {
  background: [
    `radial-gradient(circle at top left, rgba(255, 255, 255, 0.95), transparent 32%)`,
    `radial-gradient(circle at 80% 18%, rgba(184, 135, 54, 0.18), transparent 22%)`,
    `radial-gradient(circle at 18% 78%, rgba(48, 76, 103, 0.1), transparent 28%)`,
  ].join(", "),
  content: '""',
  inset: 0,
  pointerEvents: "none",
  position: "fixed",
  zIndex: 0,
});

globalStyle("body::after", {
  backgroundImage:
    "linear-gradient(rgba(48, 76, 103, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(48, 76, 103, 0.04) 1px, transparent 1px)",
  backgroundPosition: "-1px -1px",
  backgroundSize: "24px 24px",
  content: '""',
  inset: 0,
  maskImage: "linear-gradient(180deg, rgba(0, 0, 0, 0.45), transparent 85%)",
  pointerEvents: "none",
  position: "fixed",
  zIndex: 0,
});

globalStyle("body > *", {
  position: "relative",
  zIndex: 1,
});

globalStyle("*, *::before, *::after", {
  boxSizing: "border-box",
});

globalStyle("img", {
  display: "block",
  maxWidth: "100%",
});

globalStyle("a", {
  color: "inherit",
  textDecoration: "none",
});

globalStyle("button, input, textarea, select", {
  font: "inherit",
});

export const errorLayout = style({
  display: "grid",
  minHeight: "100vh",
  padding: themeVariables.space[8],
  placeItems: "center",
});

export const appHeader = style({
  "@media": {
    "screen and (max-width: 720px)": {
      padding: `${themeVariables.space[4]} ${themeVariables.space[4]}`,
    },
  },
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  margin: "0 auto",
  maxWidth: "96rem",
  padding: `${themeVariables.space[4]} ${themeVariables.space[6]}`,
});

export const appIdentity = style({
  display: "grid",
  gap: "0.15rem",
});

export const appHeaderActions = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
  justifyContent: "flex-end",
});

export const appEyebrow = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.74rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  margin: 0,
  textTransform: "uppercase",
});

export const appUserName = style({
  color: themeVariables.color.ink,
  fontWeight: 700,
  margin: 0,
});

export const appFooter = style({
  "@media": {
    "screen and (max-width: 720px)": {
      padding: `${themeVariables.space[4]} ${themeVariables.space[4]} ${themeVariables.space[6]}`,
    },
  },
  margin: `${themeVariables.space[8]} auto 0`,
  maxWidth: "96rem",
  padding: `${themeVariables.space[4]} ${themeVariables.space[6]} ${themeVariables.space[8]}`,
  width: "100%",
});

export const appFooterPlate = style({
  "::before": {
    background: `linear-gradient(90deg, transparent 0%, ${themeVariables.color.accentSoft} 20%, rgba(255, 255, 255, 0.66) 50%, ${themeVariables.color.accentSoft} 80%, transparent 100%)`,
    content: '""',
    height: "1px",
    left: themeVariables.space[4],
    opacity: 0.9,
    position: "absolute",
    right: themeVariables.space[4],
    top: 0,
  },
  "@media": {
    "screen and (max-width: 720px)": {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: themeVariables.space[3],
    },
  },
  alignItems: "center",
  backdropFilter: "blur(10px)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.76) 0%, rgba(244, 239, 226, 0.58) 100%)",
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.md,
  boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 18px 40px rgba(23, 36, 58, 0.08)`,
  color: themeVariables.color.inkSoft,
  display: "flex",
  fontSize: "0.84rem",
  gap: themeVariables.space[4],
  justifyContent: "space-between",
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
  position: "relative",
  width: "100%",
});

export const appFooterCopyright = style({
  letterSpacing: "0.01em",
  lineHeight: 1.5,
  margin: 0,
});

export const appFooterMeta = style({
  background: "rgba(48, 76, 103, 0.08)",
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.pill,
  fontFamily: themeVariables.font.body,
  fontWeight: 700,
  letterSpacing: "0.04em",
  lineHeight: 1,
  margin: 0,
  padding: "0.55rem 0.85rem",
  whiteSpace: "nowrap",
});

export const localeSwitcher = style({
  background: "rgba(255, 255, 255, 0.72)",
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.pill,
  display: "inline-flex",
  gap: "0.35rem",
  padding: "0.3rem",
});

export const localeButton = style({
  background: "transparent",
  border: 0,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.inkSoft,
  cursor: "pointer",
  fontSize: "0.84rem",
  fontWeight: 700,
  minHeight: "2.2rem",
  minWidth: "3rem",
  padding: "0.45rem 0.8rem",
  selectors: {
    "&:hover": {
      color: themeVariables.color.ink,
    },
  },
});

export const localeButtonActive = style([
  localeButton,
  {
    background: themeVariables.color.ink,
    boxShadow: `0 8px 20px ${themeVariables.color.shadow}`,
    color: "#ffffff",
  },
]);

export const ghostButton = style({
  background: "rgba(255, 255, 255, 0.88)",
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.pill,
  boxShadow: `0 10px 24px ${themeVariables.color.shadow}`,
  color: themeVariables.color.ink,
  cursor: "pointer",
  fontWeight: 700,
  minHeight: "2.75rem",
  padding: "0.65rem 1rem",
});

export const errorCard = style({
  backdropFilter: "blur(16px)",
  background: themeVariables.color.mist,
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.lg,
  boxShadow: `0 30px 80px ${themeVariables.color.shadow}`,
  padding: themeVariables.space[10],
  width: "min(100%, 42rem)",
});

export const errorTitle = style({
  fontFamily: themeVariables.font.body,
  fontSize: "clamp(2.5rem, 8vw, 5rem)",
  fontWeight: 700,
  letterSpacing: "-0.04em",
  lineHeight: 0.92,
  margin: 0,
});

export const errorDetails = style({
  color: themeVariables.color.inkSoft,
  fontSize: "1rem",
  lineHeight: 1.7,
  margin: `${themeVariables.space[5]} 0 0`,
});

export const errorPre = style({
  background: "rgba(23, 23, 23, 0.88)",
  borderRadius: themeVariables.radius.md,
  color: "#fff7ef",
  fontSize: "0.875rem",
  marginTop: themeVariables.space[6],
  overflowX: "auto",
  padding: themeVariables.space[5],
});
