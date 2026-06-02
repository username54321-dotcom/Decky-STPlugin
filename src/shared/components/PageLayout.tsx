import { PanelSection } from "@decky/ui";
import React from "react";
import { SPACING } from "../styles";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <div
      style={{
        maxWidth: SPACING.pageMaxWidth,
        marginLeft: "auto",
        marginRight: "auto",
        paddingTop: SPACING.pageTopPadding,
        paddingBottom: SPACING.pageBottomPadding,
      }}
    >
      <PanelSection title={title}>
        {children}
      </PanelSection>
    </div>
  );
}
