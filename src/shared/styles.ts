export const SPACING = {
  /** Top padding to clear the QAM header bar on all panels */
  panelTopPadding: "8px",
  /** Max width of the centered content block (mx-auto effect) for sub-pages */
  pageMaxWidth: "340px",
  /** Top padding for sub-page content blocks (48px to clear Steam GamepadUI top bar) */
  pageTopPadding: "48px",
  /** Bottom padding for sub-page content blocks */
  pageBottomPadding: "16px",
  /** Gap between major content sections */
  sectionGap: "16px",
  /** Gap within a section row */
  rowGap: "4px",
  /** Gap between controls in a horizontal group */
  controlsGap: "8px",
  /** Vertical margin for divider lines */
  dividerMargin: "12px",
};

export const BORDER = {
  /** Subtle divider line between sections */
  divider: "1px solid var(--gpBackgroundLight)",
  /** Card/border radius (matches Steam's 3px convention) */
  cardRadius: "3px",
};

export const COLOR = {
  success: "var(--gpSystemGreen)",
  warning: "var(--gpSystemYellow)",
  muted: "var(--gpSystemLighterGrey)",
  backgroundMedium: "var(--gpBackgroundMedium)",
  backgroundLight: "var(--gpBackgroundLight)",
  backgroundHard: "var(--gpBackgroundHard)",
};
