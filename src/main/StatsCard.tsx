import React from "react";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import { FaCubes } from "react-icons/fa";
import { STATS_CARD } from "./styles";

export interface StatsCardProps {
  installedCount: number | null;
}

export function StatsCard({ installedCount }: StatsCardProps) {
  let countText: string;
  if (installedCount === null) {
    countText = "\u2014";
  } else if (installedCount === 0) {
    countText = "No scripts installed";
  } else {
    countText = `${installedCount} script${installedCount === 1 ? "" : "s"} installed`;
  }

  return (
    <PanelSection>
      <PanelSectionRow>
        <div style={STATS_CARD.container}>
          <FaCubes style={STATS_CARD.icon} />
          <span style={STATS_CARD.count}>{countText}</span>
        </div>
      </PanelSectionRow>
    </PanelSection>
  );
}
