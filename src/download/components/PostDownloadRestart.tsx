import React from "react";
import { PanelSectionRow, ButtonItem, staticClasses } from "@decky/ui";
import { RestartButton } from "../../shared/components/RestartButton";
import { COLOR, SPACING } from "../../shared/styles";

interface PostDownloadRestartProps {
  onDismiss: () => void;
}

export function PostDownloadRestart({ onDismiss }: PostDownloadRestartProps) {
  return (
    <>
      <PanelSectionRow>
        <div
          className={staticClasses.Label}
          style={{ color: COLOR.success, marginBottom: SPACING.rowGap }}
        >
          Download complete!
        </div>
      </PanelSectionRow>
      <RestartButton onComplete={onDismiss} />
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onDismiss}>
          Close
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
