import {
  ErrorBoundary,
  Navigation,
  staticClasses,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api";
import React from "react";
import { FaDownload } from "react-icons/fa";
import { MainPanel } from "./MainPanel";
import { DownloadPanel } from "./DownloadPanel";
import { InstalledApps } from "./InstalledApps";
import { SettingsPanel } from "./SettingsPanel";
import { patchLibraryApp } from "./patches/PlayBarPatch";
import { ROUTES, PLUGIN_NAME } from "./shared/constants";

export default definePlugin(() => {
  console.log(`${PLUGIN_NAME} initializing`);

  routerHook.addRoute(ROUTES.main, MainPanel, { exact: true });
  routerHook.addRoute(ROUTES.download, () => <DownloadPanel />, { exact: true });
  routerHook.addRoute(ROUTES.installed, () => <InstalledApps />, { exact: true });
  routerHook.addRoute(ROUTES.settings, () => <SettingsPanel />, { exact: true });

  let cleanupPlayBarPatch: (() => void) | null = null;
  patchLibraryApp().then((cleanup) => {
    cleanupPlayBarPatch = cleanup;
  });

  return {
    name: PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
    content: (
      <ErrorBoundary>
        <MainPanel />
      </ErrorBoundary>
    ),
    icon: <FaDownload />,
    onDismount() {
      console.log(`${PLUGIN_NAME} unloading`);
      cleanupPlayBarPatch?.();
      routerHook.removeRoute(ROUTES.main);
      routerHook.removeRoute(ROUTES.download);
      routerHook.removeRoute(ROUTES.installed);
      routerHook.removeRoute(ROUTES.settings);
    },
  };
});
