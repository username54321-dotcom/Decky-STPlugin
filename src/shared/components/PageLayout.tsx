import { PanelSection, Navigation, Focusable } from "@decky/ui";
import React from "react";
import { ROUTES } from "../constants";

interface PageLayoutProps {
  title: string;
  showBack?: boolean;
  children: React.ReactNode;
}

export function PageLayout({ title, children, showBack }: PageLayoutProps) {
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
      {showBack ? (
        <>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
            <Focusable onActivate={() => Navigation.Navigate(ROUTES.main)}>
              <div
                style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "4px" }}
                onClick={() => Navigation.Navigate(ROUTES.main)}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }}>←</span>
                <span style={{ fontSize: "13px", color: "var(--gpSystemLighterGrey)" }}>Back</span>
              </div>
            </Focusable>
            <span style={{ marginLeft: "16px", fontWeight: "bold", fontSize: "14px" }}>
              {title}
            </span>
          </div>
          <PanelSection>{children}</PanelSection>
        </>
      ) : (
        <PanelSection title={title}>{children}</PanelSection>
      )}
    </div>
  );
}
