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

export const FOOTER = {
  container: {
    marginTop: SPACING.sectionGap,
    paddingTop: SPACING.rowGap,
    borderTop: BORDER.divider,
  } as React.CSSProperties,
};
