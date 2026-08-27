/* cspell:ignore glassmorphism */
import { style, styleVariants } from "@vanilla-extract/css";

import { themeVariables } from "./theme.css";

// Shared border token used across table and empty-state primitives.
const borderStrong = `1px solid ${themeVariables.color.line}`;

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

// Shared page-wrapper: max-width centering with consistent gap and padding.
// dashboard.css used gap:space[8]; dashboard.api-failures.css used gap:space[6].
// Unified to space[8] for consistent visual breathing room between sections.
export const shell = style({
  "@media": {
    "screen and (max-width: 720px)": {
      padding: `0 ${themeVariables.space[4]} ${themeVariables.space[10]}`,
    },
  },
  display: "grid",
  gap: themeVariables.space[8],
  margin: "0 auto",
  maxWidth: "96rem",
  padding: `0 ${themeVariables.space[6]} ${themeVariables.space[12]}`,
});

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

// Vertical label+input wrapper.
// dashboard.css used display:grid/gap:"0.45rem" (hardcoded);
// dashboard.api-failures.css used display:flex/flexDirection:column/gap:space[3].
// Unified to flex/column/space[3]: theme-token-aligned and slightly more
// accessible thanks to the larger gap between label and input.
//
// NOTE: `control` is intentionally NOT extracted here. The main dashboard uses
// a glass-effect variant (background, box-shadow, focus ring, transitions) —
// sometimes called glassmorphism — while api-failures uses a plain utility style.
// Merging them would either degrade the dashboard visuals or over-style the
// filter inputs. Each route keeps its own `control` definition.
export const field = style({
  display: "flex",
  flexDirection: "column",
  gap: themeVariables.space[3],
});

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

// tableCell references tableRow for its border-bottom selector,
// so both primitives must reside in the same file to preserve the cross-reference.

export const tableRow = style({});

// Unified cell padding: theme-token-based space[3]/space[4] from api-failures.
// Border uses borderStrong; dashboard.css previously used a lighter value
// which was slightly below the shared token value.
export const tableCell = style({
  padding: `${themeVariables.space[3]} ${themeVariables.space[4]}`,
  selectors: {
    [`${tableRow}:not(:last-child) &`]: {
      borderBottom: borderStrong,
    },
  },
  verticalAlign: "top",
});

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

// Two semantic variants shared across the dashboard views:
// "default" – teal/brand, used for job-status indicators on the main dashboard.
// "error"   – red, used for HTTP error-status codes on the api-failures page.
// Each route stylesheet re-exports the relevant variant under the name statusPill
// so component code and test mocks are unchanged.
export const statusPillVariants = styleVariants({
  default: {
    background: "rgba(184, 135, 54, 0.14)",
    border: "1px solid rgba(184, 135, 54, 0.24)",
    borderRadius: themeVariables.radius.pill,
    color: "var(--relanto-color-base)",
    display: "inline-flex",
    fontSize: "0.82rem",
    fontWeight: 700,
    lineHeight: 1,
    padding: "0.55rem 0.8rem",
    textTransform: "uppercase",
  },
  error: {
    background: "rgba(190, 60, 80, 0.16)",
    borderRadius: themeVariables.radius.pill,
    color: "rgba(120, 30, 40, 1)",
    display: "inline-block",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: `0 ${themeVariables.space[3]}`,
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

// Unified empty-state panel.
// dashboard.css:         dashed border, semi-transparent bg, space[4] padding, left-aligned.
// dashboard.api-failures.css: mist bg, no border, space[8] padding, centered.
// Unified: mist background + dashed border + space[6] padding (mid-point) + centered text.
export const emptyState = style({
  background: themeVariables.color.mist,
  border: "1px dashed rgba(48, 76, 103, 0.2)",
  borderRadius: themeVariables.radius.sm,
  color: themeVariables.color.inkSoft,
  lineHeight: 1.7,
  padding: themeVariables.space[6],
  textAlign: "center",
});
