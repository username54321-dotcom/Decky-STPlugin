import React from "react";
import { PanelSectionRow, ButtonItem } from "@decky/ui";
import type { DownloadProgress as DownloadProgressType } from "../shared/types";

interface DownloadProgressProps {
  state: DownloadProgressType;
  onCancel: () => void;
}

export function DownloadProgress({ state, onCancel }: DownloadProgressProps) {
  const isActive = !["done", "error", "cancelled"].includes(state.phase);

  return (
    <PanelSectionRow>
      <div>
        <div>
          {state.phase}: {state.message}
        </div>
        {state.percent > 0 && <div>Progress: {state.percent}%</div>}
        {isActive && (
          <ButtonItem layout="below" onClick={onCancel}>
            Cancel
          </ButtonItem>
        )}
      </div>
    </PanelSectionRow>
  );
}
