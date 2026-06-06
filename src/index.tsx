import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api";
import React, { useState } from "react";
import { FaDownload } from "react-icons/fa";
import { RestartButton } from "./shared/components/RestartButton";
import { patchLibraryApp } from "./patches/PlayBarPatch";
import { ROUTES, PLUGIN_NAME } from "./shared/constants";
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";
import { UpdateInstalledModal } from "./update/components/UpdateInstalledModal";
import { DownloadPanel } from "./DownloadPanel";
import { InstalledApps } from "./InstalledApps";
import { SettingsPanel } from "./SettingsPanel";
import { SPACING, BORDER } from "./shared/styles";

function MainPanel() {
  const { status: updateStatus, install } = useUpdateStatus();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      {updateStatus.available && updateStatus.latestVersion && !bannerDismissed && (
        <div style={{
          background: "rgba(0, 255, 0, 0.1)",
          border: "1px solid rgba(0, 255, 0, 0.3)",
          borderRadius: "4px",
          padding: "12px",
          margin: "8px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <span style={{ fontWeight: "bold" }}>Update Available: v{updateStatus.latestVersion}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {updateStatus.releaseUrl && (
              <ButtonItem
                onClick={() => {
                  window.open(updateStatus.releaseUrl!, "_blank");
                }}
              >
                View
              </ButtonItem>
            )}
            <ButtonItem
              onClick={async () => {
                const installed = await install();
                if (installed && updateStatus.latestVersion) {
                  showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
                }
              }}
              disabled={updateStatus.installing}
            >
              {updateStatus.installing ? "Installing..." : "Install"}
            </ButtonItem>
            <ButtonItem
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </ButtonItem>
          </div>
        </div>
      )}

      <PanelSection title={PLUGIN_NAME}>
        <PanelSectionRow>
          <div
            className={staticClasses.Label}
            style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px", marginBottom: SPACING.sectionGap }}
          >
            Lua script downloader for Steam games
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <ControlsList spacing="standard">
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.download)}
            >
              Download Lua Script
            </ButtonItem>
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.installed)}
            >
              Installed Scripts
            </ButtonItem>
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.settings)}
            >
              Settings
            </ButtonItem>
          </ControlsList>
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
        </PanelSectionRow>

        <RestartButton />
      </PanelSection>
    </div>
  );
}

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
