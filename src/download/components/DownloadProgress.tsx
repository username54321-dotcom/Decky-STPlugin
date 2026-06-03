import React from "react";
import { PanelSectionRow, ButtonItem, ProgressBarWithInfo } from "@decky/ui";
import type { DownloadProgress as DownloadProgressType } from "../../shared/types";

interface DownloadProgressProps {
  state: DownloadProgressType;
  onCancel: () => void;
}

export function DownloadProgress({ state, onCancel }: DownloadProgressProps) {
  const isActive = !["done", "error", "cancelled"].includes(state.phase);
  const isIndeterminate = state.percent <= 0 || state.phase === "fetching";

  return (
    <>
      <PanelSectionRow>
        <ProgressBarWithInfo
          nProgress={isIndeterminate ? undefined : state.percent}
          indeterminate={isIndeterminate}
          sOperationText={state.message}
          nTransitionSec={0.5}
          bottomSeparator="none"
          childrenContainerWidth="max"
        />
      </PanelSectionRow>
      {isActive && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onCancel}>
            Cancel Download
          </ButtonItem>
        </PanelSectionRow>
      )}
    </>
  );
}
