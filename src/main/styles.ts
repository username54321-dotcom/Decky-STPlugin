import { SPACING, BORDER, COLOR, CARD } from "../shared/styles";

export const HEADER = {
  container: {
    padding: `0 ${SPACING.panelTopPadding}`,
    marginBottom: SPACING.sectionGap,
  } as React.CSSProperties,
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  title: {
    fontSize: "18px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  version: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
  subtitle: {
    fontSize: "12px",
    color: COLOR.muted,
    marginTop: "2px",
  } as React.CSSProperties,
  updateBadge: {
    fontSize: "11px",
    color: COLOR.success,
    fontWeight: "bold" as const,
  } as React.CSSProperties,
};

export const STATS_CARD = {
  container: {
    background: COLOR.backgroundLight,
    border: `1px solid ${COLOR.backgroundMedium}`,
    borderRadius: BORDER.cardRadius,
    padding: CARD.padding,
    marginBottom: SPACING.sectionGap,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,
  icon: {
    fontSize: "20px",
    color: COLOR.muted,
  } as React.CSSProperties,
  count: {
    fontSize: "15px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  label: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
};

export const NAV_TILE = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: BORDER.cardRadius,
    cursor: "pointer",
  } as React.CSSProperties,
  icon: {
    fontSize: "22px",
    color: COLOR.muted,
    flexShrink: 0,
    width: "28px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  textBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    flex: 1,
  } as React.CSSProperties,
  title: {
    fontSize: "14px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  description: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
  divider: {
    borderTop: BORDER.divider,
    margin: 0,
  } as React.CSSProperties,
};

export const FOOTER = {
  container: {
    marginTop: SPACING.sectionGap,
    paddingTop: SPACING.rowGap,
    borderTop: BORDER.divider,
  } as React.CSSProperties,
};
