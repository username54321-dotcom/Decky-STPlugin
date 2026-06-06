import React from "react";
import { ConfirmModal } from "@decky/ui";
import { useRestartSteam } from "../../shared/hooks/useRestartSteam";

interface UpdateInstalledModalProps {
  version: string;
}

export function UpdateInstalledModal({ version }: UpdateInstalledModalProps) {
  const { confirmRestart } = useRestartSteam();

  return (
    <ConfirmModal
      strTitle="Update Installed"
      strDescription={`STPlugin v${version} has been installed.\n\nRestart Steam to apply the changes.`}
      strOKButtonText="Restart Steam"
      strCancelButtonText="Later"
      onOK={confirmRestart}
    />
  );
}
