import React, { useState } from "react";
import { Focusable, Navigation } from "@decky/ui";
import { NAV_TILE } from "./styles";

export interface NavTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

export function NavTile({ icon, title, description, route }: NavTileProps) {
  const [isHighlighted, setIsHighlighted] = useState(false);

  const containerStyle: React.CSSProperties = {
    ...NAV_TILE.container,
    background: isHighlighted ? "var(--gpBackgroundLight)" : "transparent",
    transition: "background 0.15s",
  };

  return (
    <Focusable
      onActivate={() => Navigation.Navigate(route)}
      style={containerStyle}
      onMouseEnter={() => setIsHighlighted(true)}
      onMouseLeave={() => setIsHighlighted(false)}
      onFocus={() => setIsHighlighted(true)}
      onBlur={() => setIsHighlighted(false)}
    >
      <span style={NAV_TILE.icon}>{icon}</span>
      <div style={NAV_TILE.textBlock}>
        <span style={NAV_TILE.title}>{title}</span>
        <span style={NAV_TILE.description}>{description}</span>
      </div>
    </Focusable>
  );
}
