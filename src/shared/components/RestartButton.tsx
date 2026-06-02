import React, { useState } from "react";
import { PanelSectionRow, ButtonItem, ConfirmModal, showModal } from "@decky/ui";
import { useRestartSteam } from "../hooks/useRestartSteam";

interface RestartButtonProps {
  onComplete?: () => void;
}

export function RestartButton({ onComplete }: RestartButtonProps) {
  const { isRestarting, confirmRestart } = useRestartSteam(onComplete);

  const handleClick = () => {
    showModal(
      <ConfirmModal
        strTitle="Restart Steam?"
        strDescription="Steam will close and restart. Any running games will be terminated."
        strOKButtonText="Restart Steam"
        strCancelButtonText="Cancel"
        onOK={() => confirmRestart()}
      />
    );
  };

  return (
    <PanelSectionRow>
      <ButtonItem
        layout="below"
        onClick={handleClick}
        disabled={isRestarting}
      >
        {isRestarting ? "Restarting..." : "Restart Steam"}
      </ButtonItem>
    </PanelSectionRow>
  );
}
