import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
  callable,
  toaster,
} from "@decky/api";
import React, { useState } from "react";
import { FaDownload } from "react-icons/fa";

import { DownloadPanel } from "./components/DownloadPanel";
import { InstalledApps } from "./components/InstalledApps";
import { SettingsPanel } from "./components/SettingsPanel";

const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

function MainPanel() {
  const [restartState, setRestartState] = useState<"idle" | "confirming" | "restarting">("idle");

  const handleRestartClick = () => {
    if (restartState === "idle") {
      setRestartState("confirming");
    }
  };

  const handleRestartCancel = () => {
    setRestartState("idle");
  };

  const handleRestartConfirm = async () => {
    setRestartState("restarting");
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setRestartState("idle");
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setRestartState("idle");
    }
  };

  return (
    <PanelSection title="STPlugin">
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/download")}
        >
          Download Lua Script
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/installed")}
        >
          Installed Scripts
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/settings")}
        >
          Settings
        </ButtonItem>
      </PanelSectionRow>

      {/* Restart Steam — with inline confirmation */}
      <PanelSectionRow>
        {restartState === "confirming" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div className={staticClasses.Label} style={{ color: "var(--gpSystemYellow)", marginBottom: "4px" }}>
              Restart Steam?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <ButtonItem layout="below" onClick={handleRestartCancel}>
                Cancel
              </ButtonItem>
              <ButtonItem layout="below" onClick={handleRestartConfirm}>
                Yes, restart
              </ButtonItem>
            </div>
          </div>
        ) : (
          <ButtonItem
            layout="below"
            onClick={handleRestartClick}
            disabled={restartState === "restarting"}
          >
            {restartState === "restarting" ? "Restarting..." : "Restart Steam"}
          </ButtonItem>
        )}
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => {
  console.log("STPlugin initializing");

  routerHook.addRoute("/stplugin", MainPanel, { exact: true });
  routerHook.addRoute("/stplugin/download", () => <DownloadPanel />, { exact: true });
  routerHook.addRoute("/stplugin/installed", () => <InstalledApps />, { exact: true });
  routerHook.addRoute("/stplugin/settings", () => <SettingsPanel />, { exact: true });

  return {
    name: "STPlugin",
    titleView: <div className={staticClasses.Title}>STPlugin</div>,
    content: <MainPanel />,
    icon: <FaDownload />,
    onDismount() {
      console.log("STPlugin unloading");
      routerHook.removeRoute("/stplugin");
      routerHook.removeRoute("/stplugin/download");
      routerHook.removeRoute("/stplugin/installed");
      routerHook.removeRoute("/stplugin/settings");
    },
  };
});
