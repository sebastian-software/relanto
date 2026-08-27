/* cspell:ignore sonarjs wordmark */
/* eslint-disable max-lines, sonarjs/no-duplicate-string -- Vanilla Extract style contracts keep repeated tokens close to the component styles. */
import { keyframes, style, styleVariants } from "@vanilla-extract/css";

import {
  emptyState,
  field,
  shell,
  statusPillVariants,
  tableCell,
  tableRow,
} from "../styles/primitives.css";
import { themeVariables } from "../styles/theme.css";

// Re-export shared layout, table and status primitives so that importing
// component code and test mocks continue to reference ./dashboard.css unchanged.
export { emptyState, field, shell, tableCell, tableRow };

// The main dashboard uses the brand variant of the status pill (job statuses).
export const statusPill = statusPillVariants.default;

const borderStrong = `1px solid ${themeVariables.color.line}`;

export const hero = style({
  "@media": {
    "screen and (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
  },
  backdropFilter: "blur(18px)",
  background: [
    "linear-gradient(135deg, rgba(255, 253, 250, 0.92), rgba(239, 232, 216, 0.84))",
    "radial-gradient(circle at 12% 16%, rgba(184, 135, 54, 0.18), transparent 30%)",
    "radial-gradient(circle at 100% 0%, rgba(48, 76, 103, 0.2), transparent 36%)",
  ].join(", "),
  border: borderStrong,
  borderRadius: "2rem",
  boxShadow: `0 28px 80px ${themeVariables.color.shadow}`,
  display: "grid",
  gap: themeVariables.space[6],
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(18rem, 0.8fr)",
  overflow: "hidden",
  padding: themeVariables.space[8],
  position: "relative",
});

export const heroCopy = style({
  display: "grid",
  gap: themeVariables.space[5],
});

export const eyebrow = style({
  color: "var(--relanto-color-base)",
  fontSize: "0.86rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  margin: 0,
  textTransform: "uppercase",
});

export const heroTitle = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.accent,
  fontSize: "clamp(2.7rem, 7vw, 6.2rem)",
  fontWeight: 700,
  letterSpacing: "-0.055em",
  lineHeight: 0.88,
  margin: 0,
  maxWidth: "12ch",
  overflowWrap: "anywhere",
});

export const heroBody = style({
  color: themeVariables.color.inkSoft,
  fontSize: "1.04rem",
  lineHeight: 1.8,
  margin: 0,
  maxWidth: "42rem",
});

export const heroMeta = style({
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
  marginTop: themeVariables.space[3],
});

export const metaBadge = style({
  backdropFilter: "blur(12px)",
  background: "rgba(255, 255, 255, 0.74)",
  border: borderStrong,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.ink,
  padding: "0.7rem 1rem",
});

export const heroVisual = style({
  alignItems: "stretch",
  background:
    "linear-gradient(160deg, rgba(14, 22, 37, 0.98), rgba(23, 36, 58, 0.94) 55%, rgba(48, 76, 103, 0.9))",
  borderRadius: "1.6rem",
  display: "grid",
  minHeight: "22rem",
  overflow: "hidden",
  padding: themeVariables.space[6],
  position: "relative",
});

export const heroVisualGlow = style({
  background:
    "radial-gradient(circle at 20% 20%, rgba(184, 135, 54, 0.46), transparent 30%), radial-gradient(circle at 80% 80%, rgba(244, 239, 226, 0.22), transparent 24%)",
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
});

export const heroLogoWrap = style({
  alignItems: "center",
  display: "grid",
  justifyItems: "center",
  position: "relative",
  zIndex: 1,
});

export const heroLogoPanel = style({
  background: "rgba(255, 253, 250, 0.96)",
  borderRadius: "1.5rem",
  boxShadow: "0 22px 48px rgba(0, 0, 0, 0.24)",
  padding: themeVariables.space[5],
  width: "min(100%, 22rem)",
});

export const heroLogo = style({
  display: "block",
  height: "auto",
  width: "100%",
});

export const heroWordmark = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.accent,
  fontSize: "clamp(3rem, 8vw, 5.4rem)",
  fontWeight: 700,
  letterSpacing: "-0.055em",
  lineHeight: 1,
  margin: 0,
  padding: `${themeVariables.space[6]} ${themeVariables.space[4]}`,
  textAlign: "center",
});

export const statGrid = style({
  "@media": {
    "screen and (max-width: 860px)": {
      gridTemplateColumns: "1fr",
    },
  },
  display: "grid",
  gap: themeVariables.space[4],
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
});

export const statCard = style({
  background: "rgba(255, 255, 255, 0.82)",
  border: borderStrong,
  borderRadius: "1.5rem",
  boxShadow: `0 18px 48px ${themeVariables.color.shadow}`,
  display: "grid",
  gap: "0.35rem",
  padding: themeVariables.space[5],
});

export const statLabel = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase",
});

export const statValue = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.body,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  fontWeight: 700,
  letterSpacing: "-0.05em",
  lineHeight: 0.9,
  margin: 0,
});

export const statHint = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.94rem",
  lineHeight: 1.6,
  margin: 0,
});

export const actionFeedback = style({
  backdropFilter: "blur(16px)",
  background: "rgba(2, 10, 14, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "1.25rem",
  boxShadow: "0 28px 60px rgba(0, 0, 0, 0.22)",
  color: "#fffdfa",
  overflowX: "auto",
  padding: themeVariables.space[5],
  whiteSpace: "pre-wrap",
});

export const twinGrid = style({
  "@media": {
    "screen and (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
  },
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[5],
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
});

export const panel = style({
  alignSelf: "start",
  backdropFilter: "blur(18px)",
  background: themeVariables.color.panel,
  border: borderStrong,
  borderRadius: "1.75rem",
  boxShadow: `0 22px 50px ${themeVariables.color.shadow}`,
  overflow: "hidden",
});

export const panelHeader = style({
  alignItems: "center",
  borderBottom: "1px solid rgba(48, 76, 103, 0.1)",
  display: "flex",
  gap: themeVariables.space[4],
  justifyContent: "space-between",
  padding: `${themeVariables.space[5]} ${themeVariables.space[6]}`,
});

export const panelKicker = style({
  color: "var(--relanto-color-base)",
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  margin: 0,
  textTransform: "uppercase",
});

export const panelTitle = style({
  fontFamily: themeVariables.font.body,
  fontSize: "clamp(1.6rem, 3vw, 2.3rem)",
  fontWeight: 700,
  hyphens: "auto",
  letterSpacing: "-0.04em",
  lineHeight: 0.95,
  margin: "0.3rem 0 0",
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const panelBody = style({
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[5],
  padding: themeVariables.space[6],
});

export const panelBodyDense = style({
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[4],
  padding: themeVariables.space[6],
});

export const formGrid = style({
  display: "grid",
  gap: themeVariables.space[4],
});

export const inlineSplit = style({
  "@media": {
    "screen and (max-width: 720px)": {
      gridTemplateColumns: "1fr",
    },
  },
  display: "grid",
  gap: themeVariables.space[4],
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
});

export const fieldLabel = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

export const control = style({
  appearance: "none",
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(48, 76, 103, 0.2)",
  borderRadius: "1rem",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.68)",
  color: themeVariables.color.ink,
  minHeight: "3.2rem",
  outline: "none",
  padding: "0.95rem 1rem",
  selectors: {
    "&:disabled": {
      background: "rgba(244, 247, 248, 0.92)",
      color: "rgba(23, 36, 58, 0.46)",
      cursor: "not-allowed",
      transform: "none",
    },
    "&:focus": {
      borderColor: "var(--relanto-color-bright)",
      boxShadow: "0 0 0 4px rgba(184, 135, 54, 0.18)",
      transform: "translateY(-1px)",
    },
  },
  transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
  width: "100%",
});

export const controlInvalid = style({
  borderColor: "rgba(159, 36, 52, 0.35)",
  boxShadow: "0 0 0 4px rgba(159, 36, 52, 0.1)",
});

export const selectControl = style([
  control,
  {
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, rgba(23,36,58,0.64) 50%), linear-gradient(135deg, rgba(23,36,58,0.64) 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 22px) calc(50% - 2px), calc(100% - 16px) calc(50% - 2px)",
    backgroundRepeat: "no-repeat",
    backgroundSize: "6px 6px, 6px 6px",
    paddingRight: "2.8rem",
  },
]);

export const fieldHint = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.92rem",
  lineHeight: 1.6,
  margin: 0,
});

export const fieldError = style({
  color: "#9f2434",
  fontSize: "0.92rem",
  fontWeight: 700,
  lineHeight: 1.5,
  margin: 0,
});

export const fieldsetReset = style({
  border: 0,
  margin: 0,
  minWidth: 0,
  padding: 0,
});

export const checkboxField = style({
  alignItems: "center",
  background: "rgba(255,255,255,0.8)",
  border: "1px solid rgba(48, 76, 103, 0.12)",
  borderRadius: "1rem",
  display: "inline-flex",
  gap: "0.75rem",
  minHeight: "3.2rem",
  padding: "0.85rem 1rem",
});

export const checkboxInput = style({
  accentColor: "var(--relanto-color-base)",
  flexShrink: 0,
  height: "1rem",
  margin: 0,
  width: "1rem",
});

export const checkboxRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
});

export const checkboxCard = style({
  alignItems: "center",
  background: "rgba(255,255,255,0.72)",
  border: borderStrong,
  borderRadius: "999px",
  display: "inline-flex",
  gap: "0.55rem",
  padding: "0.65rem 0.9rem",
});

export const sectionStack = style({
  display: "grid",
  gap: themeVariables.space[5],
});

export const feedbackCard = style({
  backdropFilter: "blur(10px)",
  background: "linear-gradient(180deg, rgba(240, 250, 247, 0.98), rgba(232, 245, 239, 0.94))",
  border: "1px solid rgba(18, 122, 82, 0.18)",
  borderRadius: "1.2rem",
  boxShadow: "0 14px 34px rgba(18, 122, 82, 0.08)",
  display: "grid",
  gap: themeVariables.space[3],
  padding: themeVariables.space[4],
});

export const feedbackTitle = style({
  color: themeVariables.color.ink,
  fontSize: "0.96rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
});

export const feedbackBody = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.65,
  margin: 0,
});

export const formNotice = style({
  borderRadius: "1.2rem",
  display: "grid",
  gap: themeVariables.space[3],
  padding: themeVariables.space[4],
});

export const formNoticeVariants = styleVariants({
  error: {
    background: "linear-gradient(180deg, rgba(255, 246, 246, 0.98), rgba(255, 238, 239, 0.94))",
    border: "1px solid rgba(159, 36, 52, 0.16)",
    boxShadow: "0 14px 34px rgba(159, 36, 52, 0.08)",
  },
  info: {
    background: "linear-gradient(180deg, rgba(241, 248, 252, 0.98), rgba(233, 243, 247, 0.94))",
    border: "1px solid rgba(48, 76, 103, 0.16)",
    boxShadow: "0 14px 34px rgba(23, 36, 58, 0.1)",
  },
  success: {
    background: "linear-gradient(180deg, rgba(240, 250, 247, 0.98), rgba(232, 245, 239, 0.94))",
    border: "1px solid rgba(18, 122, 82, 0.18)",
    boxShadow: "0 14px 34px rgba(18, 122, 82, 0.08)",
  },
});

export const formNoticeTitle = style({
  color: themeVariables.color.ink,
  fontSize: "0.96rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
});

export const formNoticeBody = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.65,
  margin: 0,
});

export const formNoticeDiagnostics = style({
  display: "grid",
  gap: themeVariables.space[3],
  margin: 0,
  padding: 0,
});

export const formNoticeDiagnosticRow = style({
  display: "grid",
  gap: themeVariables.space[3],
});

export const formNoticeDiagnosticLabel = style({
  color: themeVariables.color.ink,
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  margin: 0,
  textTransform: "uppercase",
});

export const formNoticeDiagnosticValue = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.55,
  margin: 0,
  overflowWrap: "anywhere",
});

export const principalList = style({
  display: "grid",
  gap: themeVariables.space[3],
  listStyle: "none",
  margin: 0,
  padding: 0,
});

export const principalItem = style({
  alignItems: "start",
  background: "rgba(255,255,255,0.8)",
  border: "1px solid rgba(48, 76, 103, 0.12)",
  borderRadius: "1.15rem",
  display: "grid",
  gap: themeVariables.space[3],
  padding: themeVariables.space[4],
});

export const principalInfo = style({
  display: "grid",
  gap: "0.35rem",
});

export const principalLabel = style({
  color: themeVariables.color.ink,
  fontWeight: 700,
});

export const principalMeta = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.92rem",
  lineHeight: 1.6,
});

export const configGrid = style({
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[5],
});

export const configCard = style({
  alignSelf: "start",
  background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247, 251, 252, 0.84))",
  border: borderStrong,
  borderRadius: "1.5rem",
  boxShadow: "0 16px 42px rgba(23, 36, 58, 0.1)",
  display: "grid",
  gap: themeVariables.space[5],
  overflow: "hidden",
  padding: themeVariables.space[6],
});

export const configHeader = style({
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
    },
  },
  alignItems: "flex-start",
  display: "flex",
  gap: themeVariables.space[4],
  justifyContent: "space-between",
});

export const recordSummary = style({
  "@media": {
    "screen and (max-width: 720px)": {
      gridTemplateColumns: "1fr",
    },
  },
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[4],
  gridTemplateColumns: "minmax(0, 1fr) auto",
});

export const recordSummaryHeader = style({
  display: "grid",
  gap: themeVariables.space[3],
});

export const appIdBadge = style({
  alignItems: "center",
  background:
    "linear-gradient(135deg, rgba(23, 36, 58, 0.07), rgba(184, 135, 54, 0.15), rgba(255, 253, 250, 0.74))",
  border: "1px solid rgba(48, 76, 103, 0.18)",
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.ink,
  display: "inline-flex",
  fontFamily:
    '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", monospace',
  fontSize: "0.82rem",
  fontWeight: 700,
  gap: "0.55rem",
  letterSpacing: "0.04em",
  maxWidth: "fit-content",
  padding: "0.48rem 0.8rem",
  textTransform: "uppercase",
});

export const recordSummaryMeta = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.6,
  margin: 0,
});

export const configName = style({
  fontFamily: themeVariables.font.body,
  fontSize: "clamp(1.7rem, 3vw, 2.3rem)",
  fontWeight: 700,
  letterSpacing: "-0.04em",
  lineHeight: 0.92,
  margin: 0,
});

export const configMeta = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.6,
  margin: "0.35rem 0 0",
});

export const subGrid = style({
  "@media": {
    "screen and (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
  },
  alignItems: "start",
  display: "grid",
  gap: themeVariables.space[5],
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
});

export const subPanel = style({
  alignContent: "start",
  alignSelf: "start",
  background: "rgba(255,255,255,0.58)",
  border: "1px solid rgba(48, 76, 103, 0.12)",
  borderRadius: "1.3rem",
  display: "grid",
  gap: themeVariables.space[4],
  padding: themeVariables.space[5],
});

export const subTitle = style({
  color: themeVariables.color.ink,
  fontSize: "1.08rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
});

export const tokenList = style({
  display: "grid",
  gap: themeVariables.space[3],
  listStyle: "none",
  margin: 0,
  padding: 0,
});

export const tokenItem = style({
  "@media": {
    "screen and (max-width: 820px)": {
      gridTemplateColumns: "1fr",
    },
  },
  alignItems: "start",
  background: "rgba(241, 247, 249, 0.95)",
  border: "1px solid rgba(48, 76, 103, 0.12)",
  borderRadius: "1.15rem",
  display: "grid",
  gap: themeVariables.space[4],
  gridTemplateColumns: "minmax(0, 1fr) auto",
  padding: themeVariables.space[4],
});

export const tokenInfo = style({
  display: "grid",
  gap: "0.4rem",
});

export const tokenLabel = style({
  fontWeight: 700,
});

export const tokenMeta = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.92rem",
  lineHeight: 1.6,
});

export const tokenStatus = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.84rem",
  fontWeight: 700,
  lineHeight: 1.5,
});

export const tokenSecret = style({
  background: "rgba(2, 10, 14, 0.96)",
  borderRadius: "1rem",
  display: "grid",
  gap: themeVariables.space[3],
  padding: themeVariables.space[4],
});

export const tokenSecretValue = style({
  color: "#f5fbfd",
  fontSize: "0.92rem",
  overflowWrap: "anywhere",
});

export const secretCopy = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
});

export const secretCopyFeedback = style({
  color: "#c9ecf6",
  fontSize: "0.86rem",
  fontWeight: 600,
});

export const actionRow = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.65rem",
  justifyContent: "flex-end",
});

export const modalCard = style({
  // The blur/dark overlay that used to be a separate backdrop element is now
  // rendered by the native <dialog> top layer via the ::backdrop pseudo.
  "::backdrop": {
    backdropFilter: "blur(8px)",
    background: "rgba(2, 10, 14, 0.52)",
  },
  background: "rgba(255, 255, 255, 0.98)",
  border: borderStrong,
  borderRadius: "1.5rem",
  boxShadow: "0 28px 80px rgba(0, 0, 0, 0.24)",
  display: "none",
  gap: themeVariables.space[4],
  // Centre the modal dialog inside the browser top layer.
  inset: 0,
  margin: "auto",
  maxWidth: "min(100%, 32rem)",
  padding: themeVariables.space[6],
  selectors: {
    "&[open]": {
      display: "grid",
    },
  },
  width: "min(100%, 32rem)",
});

export const modalTitle = style({
  color: themeVariables.color.ink,
  fontSize: "1.12rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
});

export const modalBody = style({
  color: themeVariables.color.inkSoft,
  lineHeight: 1.7,
  margin: 0,
});

export const modalActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
  justifyContent: "flex-end",
});

export const button = style({
  alignItems: "center",
  background: "linear-gradient(135deg, var(--relanto-color-base), #1e3851)",
  border: 0,
  borderRadius: "999px",
  boxShadow: "0 14px 24px rgba(23, 36, 58, 0.2)",
  color: "#f7fcfe",
  cursor: "pointer",
  display: "inline-flex",
  fontWeight: 700,
  gap: "0.4rem",
  justifyContent: "center",
  minHeight: "3rem",
  padding: "0.8rem 1.15rem",
  selectors: {
    "&:disabled": {
      boxShadow: "none",
      cursor: "not-allowed",
      opacity: 0.5,
      transform: "none",
    },
    "&:hover": {
      boxShadow: "0 18px 30px rgba(23, 36, 58, 0.26)",
      transform: "translateY(-1px)",
    },
  },
  transition: "transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease",
});

export const buttonVariants = styleVariants({
  neutral: [
    button,
    {
      background: "rgba(255,255,255,0.9)",
      border: "1px solid rgba(48, 76, 103, 0.16)",
      boxShadow: "none",
      color: themeVariables.color.ink,
    },
  ],
  primary: [button],
  secondary: [
    button,
    {
      background: "linear-gradient(135deg, rgba(184, 135, 54, 0.2), rgba(48, 76, 103, 0.14))",
      border: "1px solid rgba(48, 76, 103, 0.16)",
      boxShadow: "none",
      color: themeVariables.color.ink,
    },
  ],
  subtle: [
    button,
    {
      background: "rgba(241, 247, 249, 0.9)",
      border: "1px solid rgba(48, 76, 103, 0.14)",
      boxShadow: "none",
      color: themeVariables.color.inkSoft,
      minHeight: "2.75rem",
      padding: "0.7rem 1rem",
    },
  ],
});

export const jobsWrap = style({
  overflowX: "auto",
});

export const jobsTable = style({
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: "52rem",
  width: "100%",
});

export const tableHead = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textAlign: "left",
  textTransform: "uppercase",
});

export const tableHeaderCell = style({
  borderBottom: "1px solid rgba(48, 76, 103, 0.14)",
  padding: "0 0 1rem",
});

const configCardPulse = keyframes({
  "0%": {
    outlineColor: "transparent",
    outlineOffset: "0px",
  },
  "100%": {
    outlineColor: "transparent",
    outlineOffset: "0px",
  },
  "20%": {
    outlineColor: themeVariables.color.accent,
    outlineOffset: "6px",
  },
});

export const configCardHighlight = style({
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      selectors: {
        '&[data-highlight="true"]': {
          animation: "none",
          outlineColor: themeVariables.color.accent,
          outlineOffset: "4px",
        },
      },
    },
  },
  outlineColor: "transparent",
  outlineStyle: "solid",
  outlineWidth: "2px",
  scrollMarginTop: themeVariables.space[6],

  selectors: {
    "&:focus": {
      outlineColor: themeVariables.color.accent,
    },
    "&:focus:not(:focus-visible)": {
      outlineColor: "transparent",
    },
    '&[data-highlight="true"]': {
      animationDuration: "1100ms",
      animationFillMode: "forwards",
      animationName: configCardPulse,
      animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
  },
});

export const applicationLinkButton = style({
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  padding: 0,
  selectors: {
    "&:focus-visible": {
      borderRadius: "2px",
      outline: `2px solid ${themeVariables.color.accent}`,
      outlineOffset: "2px",
    },
    "&:hover": {
      textDecorationStyle: "solid",
    },
  },
  textAlign: "left",
  textDecorationLine: "underline",
  textDecorationStyle: "dotted",
  textDecorationThickness: "1px",
  textUnderlineOffset: "3px",
});

export const filterResetNotice = style({
  alignItems: "center",
  background: themeVariables.color.accentSoft,
  border: `1px solid ${themeVariables.color.line}`,
  borderRadius: themeVariables.radius.sm,
  color: themeVariables.color.ink,
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
  justifyContent: "space-between",
  marginBottom: themeVariables.space[4],
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
});

export const filterResetNoticeButton = style({
  background: "transparent",
  border: "none",
  color: "var(--relanto-color-base)",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 600,
  padding: 0,
  selectors: {
    "&:focus-visible": {
      borderRadius: "2px",
      outline: `2px solid ${themeVariables.color.accent}`,
      outlineOffset: "2px",
    },
    "&:hover": {
      textDecorationStyle: "solid",
    },
  },
  textDecorationLine: "underline",
  textDecorationThickness: "1px",
  textUnderlineOffset: "3px",
});

export const reloadButtonGroup = style({
  alignItems: "center",
  display: "flex",
  gap: themeVariables.space[3],
});

export const reloadTimestamp = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.85rem",
  fontVariantNumeric: "tabular-nums",
});
