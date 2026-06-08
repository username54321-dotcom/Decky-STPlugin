import React from "react";
import { ButtonItem, Navigation } from "@decky/ui";

export interface NavTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

export function NavTile({ icon, title, description, route }: NavTileProps) {
  return (
    <ButtonItem layout="below" onClick={() => Navigation.Navigate(route)}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            fontSize: "22px",
            color: "var(--gpSystemLighterGrey)",
            flexShrink: 0,
            width: "28px",
            textAlign: "center",
          }}
        >
          {icon}
        </span>
        <div>
          <div style={{ fontWeight: "bold" }}>{title}</div>
          <div style={{ fontSize: "12px", color: "var(--gpSystemLighterGrey)" }}>
            {description}
          </div>
        </div>
      </div>
    </ButtonItem>
  );
}
