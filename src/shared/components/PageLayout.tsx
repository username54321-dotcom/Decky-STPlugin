import { PanelSection } from "@decky/ui";
import React from "react";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <div
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        paddingTop: "72px",
        paddingBottom: "16px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <PanelSection title={title}>
        {children}
      </PanelSection>
    </div>
  );
}
