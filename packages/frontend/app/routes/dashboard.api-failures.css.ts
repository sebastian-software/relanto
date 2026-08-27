import { style } from "@vanilla-extract/css";

import {
  emptyState,
  field,
  shell,
  statusPillVariants,
  tableCell,
  tableRow,
} from "../styles/primitives.css";
import { themeVariables } from "../styles/theme.css";

// Re-export shared layout, table and form primitives so that importing
// component code and test mocks continue to reference ./dashboard.api-failures.css unchanged.
export { emptyState, field, shell, tableCell, tableRow };

// The api-failures view uses the red/error variant of the status pill (HTTP error codes).
export const statusPill = statusPillVariants.error;

const borderStrong = `1px solid ${themeVariables.color.line}`;

export const headerRow = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[4],
  justifyContent: "space-between",
  paddingTop: themeVariables.space[8],
});

export const eyebrow = style({
  color: themeVariables.color.inkSoft,
  fontFamily: themeVariables.font.body,
  fontSize: "0.8125rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase",
});

export const title = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.display,
  fontSize: "2rem",
  fontWeight: 700,
  margin: `${themeVariables.space[3]} 0 0`,
});

export const backLink = style({
  alignItems: "center",
  border: borderStrong,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.ink,
  display: "inline-flex",
  fontFamily: themeVariables.font.body,
  fontSize: "0.875rem",
  fontWeight: 500,
  gap: themeVariables.space[3],
  padding: `${themeVariables.space[3]} ${themeVariables.space[5]}`,
  textDecoration: "none",
});

export const panel = style({
  background: themeVariables.color.panel,
  border: borderStrong,
  borderRadius: themeVariables.radius.md,
  display: "flex",
  flexDirection: "column",
  gap: themeVariables.space[6],
  padding: themeVariables.space[6],
});

export const filterForm = style({
  alignItems: "flex-end",
  display: "grid",
  gap: themeVariables.space[4],
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
});

export const fieldLabel = style({
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.body,
  fontSize: "0.8125rem",
  fontWeight: 600,
});

export const control = style({
  background: themeVariables.color.panelStrong,
  border: borderStrong,
  borderRadius: themeVariables.radius.sm,
  color: themeVariables.color.ink,
  fontFamily: themeVariables.font.body,
  fontSize: "0.9375rem",
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
});

export const buttonRow = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: themeVariables.space[3],
});

export const primaryButton = style({
  background: themeVariables.color.ink,
  border: "none",
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.panelStrong,
  cursor: "pointer",
  fontFamily: themeVariables.font.body,
  fontSize: "0.875rem",
  fontWeight: 600,
  padding: `${themeVariables.space[3]} ${themeVariables.space[5]}`,
});

export const secondaryButton = style({
  background: themeVariables.color.panelStrong,
  border: borderStrong,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.ink,
  cursor: "pointer",
  fontFamily: themeVariables.font.body,
  fontSize: "0.875rem",
  fontWeight: 500,
  padding: `${themeVariables.space[3]} ${themeVariables.space[5]}`,
  textDecoration: "none",
});

export const tableWrap = style({
  overflowX: "auto",
});

export const failuresTable = style({
  borderCollapse: "collapse",
  fontFamily: themeVariables.font.body,
  fontSize: "0.875rem",
  minWidth: "960px",
  width: "100%",
});

export const tableHead = style({
  background: themeVariables.color.mist,
  textAlign: "left",
});

export const tableHeaderCell = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
  textTransform: "uppercase",
});

export const reasonBadge = style({
  background: themeVariables.color.accentSoft,
  borderRadius: themeVariables.radius.pill,
  color: themeVariables.color.ink,
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: `0 ${themeVariables.space[3]}`,
});

export const meta = style({
  color: themeVariables.color.inkSoft,
  fontSize: "0.75rem",
});

export const reasonMessage = style({
  color: themeVariables.color.ink,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
