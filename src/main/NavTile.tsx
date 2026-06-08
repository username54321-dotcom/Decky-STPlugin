import React from "react";
import { Focusable, Navigation } from "@decky/ui";
import { NAV_TILE } from "./styles";

export interface NavTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

export function NavTile({ icon, title, description, route }: NavTileProps) {
  return (
    <Focusable
      onActivate={() => Navigation.Navigate(route)}
      style={NAV_TILE.container}
    >
      <span style={NAV_TILE.icon}>{icon}</span>
      <div style={NAV_TILE.textBlock}>
        <span style={NAV_TILE.title}>{title}</span>
        <span style={NAV_TILE.description}>{description}</span>
      </div>
    </Focusable>
  );
}
