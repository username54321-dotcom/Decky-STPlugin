import React from "react";
import { PanelSectionRow, ButtonItem, staticClasses } from "@decky/ui";
import { useRestartSteam } from "../hooks/useRestartSteam";

interface RestartButtonProps {
  onComplete?: () => void;
}

export function RestartButton({ onComplete }: RestartButtonProps) {
  const { restartState, handleRestart, handleCancel } = useRestartSteam(onComplete);

  return (
    <PanelSectionRow>
      {restartState === "confirming" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            className={staticClasses.Label}
            style={{ color: "var(--gpSystemYellow)", marginBottom: "4px" }}
          >
            Restart Steam?
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <ButtonItem layout="below" onClick={handleCancel}>
              Cancel
            </ButtonItem>
            <ButtonItem layout="below" onClick={handleRestart}>
              Yes, restart
            </ButtonItem>
          </div>
        </div>
      ) : (
        <ButtonItem
          layout="below"
          onClick={handleRestart}
          disabled={restartState === "restarting"}
        >
          {restartState === "restarting" ? "Restarting..." : "Restart Steam"}
        </ButtonItem>
      )}
    </PanelSectionRow>
  );
}
