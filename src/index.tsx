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
} from "@decky/api";
import React from "react";
import { FaDownload } from "react-icons/fa";

import { DownloadPanel } from "./components/DownloadPanel";
import { InstalledApps } from "./components/InstalledApps";
import { SettingsPanel } from "./components/SettingsPanel";

function MainPanel() {
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
