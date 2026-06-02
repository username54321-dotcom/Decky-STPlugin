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
import { RestartButton } from "./shared/components/RestartButton";
import { ROUTES, PLUGIN_NAME } from "./shared/constants";
import { DownloadPanel } from "./download/DownloadPanel";
import { InstalledApps } from "./installed/InstalledApps";
import { SettingsPanel } from "./settings/SettingsPanel";

function MainPanel() {
  return (
    <PanelSection title={PLUGIN_NAME}>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.download)}
        >
          Download Lua Script
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.installed)}
        >
          Installed Scripts
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.settings)}
        >
          Settings
        </ButtonItem>
      </PanelSectionRow>

      <RestartButton />
    </PanelSection>
  );
}

export default definePlugin(() => {
  console.log(`${PLUGIN_NAME} initializing`);

  routerHook.addRoute(ROUTES.main, MainPanel, { exact: true });
  routerHook.addRoute(ROUTES.download, () => <DownloadPanel />, { exact: true });
  routerHook.addRoute(ROUTES.installed, () => <InstalledApps />, { exact: true });
  routerHook.addRoute(ROUTES.settings, () => <SettingsPanel />, { exact: true });

  return {
    name: PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
    content: <MainPanel />,
    icon: <FaDownload />,
    onDismount() {
      console.log(`${PLUGIN_NAME} unloading`);
      routerHook.removeRoute(ROUTES.main);
      routerHook.removeRoute(ROUTES.download);
      routerHook.removeRoute(ROUTES.installed);
      routerHook.removeRoute(ROUTES.settings);
    },
  };
});
