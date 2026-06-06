export const SPACING = {
  /** Top padding to clear the QAM header bar on all panels */
  panelTopPadding: "8px",
  /** Top padding for sub-page content blocks (clears Steam GamepadUI top bar + extra breathing room) */
  pageTopPadding: "72px",
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

export const BUTTON = {
  base: {
    flex: 1,
    minWidth: 0,
    padding: "8px 16px",
    borderRadius: "4px",
    color: "white",
    fontSize: "14px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  secondary: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    cursor: "pointer",
  } as React.CSSProperties,
  primary: {
    background: "rgba(0, 255, 0, 0.2)",
    border: "1px solid rgba(0, 255, 0, 0.3)",
    cursor: "pointer",
  } as React.CSSProperties,
  disabled: {
    background: "rgba(255, 255, 255, 0.05)",
    cursor: "not-allowed",
    opacity: 0.6,
  } as React.CSSProperties,
} as const;

export const CARD = {
  background: "var(--gpBackgroundLight)",
  border: "1px solid var(--gpBackgroundMedium)",
  borderRadius: "8px",
  padding: "12px",
  gap: "8px",
  hoverBackground: "var(--gpBackgroundMedium)",
  capsuleWidth: "120px",
  capsuleHeight: "45px",
};
