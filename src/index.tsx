import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Field,
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
        <PanelSection title="Update Available">
          <PanelSectionRow>
            <Field
              label={`v${updateStatus.latestVersion}`}
              description="A new version of STPlugin is available"
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              disabled={updateStatus.installing}
              onClick={async () => {
                const installed = await install();
                if (installed && updateStatus.latestVersion) {
                  showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
                }
              }}
            >
              {updateStatus.installing ? "Installing..." : "Install Update"}
            </ButtonItem>
          </PanelSectionRow>
          {updateStatus.releaseUrl && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() => window.open(updateStatus.releaseUrl!, "_blank")}
              >
                View Release
              </ButtonItem>
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setBannerDismissed(true)}>
              Dismiss
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
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
