import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
  ControlsList,
  ConfirmModal,
  showModal,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaTrash, FaRedo } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";
import { SPACING, BORDER, COLOR } from "../shared/styles";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");
const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);

  const loadApps = async () => {
    try {
      const result = await getInstalledApps();
      setApps(result);
    } catch {
      console.warn("[STPlugin] Failed to load installed apps");
      setApps([]);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = (appid: number, name: string) => {
    showModal(
      <ConfirmModal
        strTitle="Delete Script?"
        strDescription={`Delete ${name || `App ${appid}`}? This cannot be undone.`}
        strOKButtonText="Delete"
        strCancelButtonText="Cancel"
        bDestructiveWarning={true}
        onOK={async () => {
          const ok = await deleteApp(appid);
          if (ok) {
            toaster.toast({ title: "STPlugin", body: `Removed ${name || `App ${appid}`}` });
            await loadApps();
          } else {
            toaster.toast({ title: "Error", body: "Failed to remove Lua file" });
          }
        }}
      />
    );
  };

  const handleRedownload = async (appid: number) => {
    const taskId = await startDownload(appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading App ${appid}...` });
  };

  if (apps.length === 0) {
    return (
      <div style={{ paddingTop: SPACING.panelTopPadding }}>
        <PanelSection title="Installed Scripts">
          <PanelSectionRow>
            <div className={staticClasses.Label} style={{ color: COLOR.muted }}>
              No Lua scripts installed yet.
            </div>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <PanelSection title="Installed Scripts">
        {apps.map((app, index) => (
          <React.Fragment key={app.appid}>
            <PanelSectionRow>
              <div style={{ display: "flex", alignItems: "center", gap: SPACING.controlsGap }}>
                <span
                  className={staticClasses.Label}
                  style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {app.name || `App ${app.appid}`}
                </span>
                <ControlsList spacing="standard">
                  <ButtonItem onClick={() => handleRedownload(app.appid)}>
                    <FaRedo />
                  </ButtonItem>
                  <ButtonItem onClick={() => handleDelete(app.appid, app.name)}>
                    <FaTrash />
                  </ButtonItem>
                </ControlsList>
              </div>
            </PanelSectionRow>
            {index < apps.length - 1 && (
              <PanelSectionRow>
                <div style={{ borderTop: BORDER.divider, margin: `0 0 ${SPACING.rowGap} 0` }} />
              </PanelSectionRow>
            )}
          </React.Fragment>
        ))}
      </PanelSection>
    </div>
  );
}
