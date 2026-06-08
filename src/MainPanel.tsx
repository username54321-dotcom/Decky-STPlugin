import React, { useState, useEffect } from "react";
import {
  PanelSection,
  Navigation,
} from "@decky/ui";
import { callable } from "@decky/api";
import { FaDownload, FaBox, FaCog } from "react-icons/fa";
import { PLUGIN_NAME, ROUTES } from "./shared/constants";
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";
import { RestartButton } from "./shared/components/RestartButton";
import { NavTile } from "./main/NavTile";
import { StatsCard } from "./main/StatsCard";
import { HEADER, FOOTER } from "./main/styles";
import { SPACING } from "./shared/styles";
import type { InstalledApp } from "./shared/types";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

export function MainPanel() {
  const { status: updateStatus } = useUpdateStatus();
  const [installedCount, setInstalledCount] = useState<number | null>(null);

  useEffect(() => {
    getInstalledApps()
      .then((apps) => setInstalledCount(apps.length))
      .catch((err) => {
        console.error("MainPanel: failed to fetch installed apps", err);
        setInstalledCount(null);
      });
  }, []);

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <div style={HEADER.container}>
        <div style={HEADER.titleRow}>
          <span style={HEADER.title}>{PLUGIN_NAME}</span>
          <span style={HEADER.version}>
            v{updateStatus.currentVersion}
            {updateStatus.available && (
              <span style={HEADER.updateBadge}>{" "}\u2B06 Update Available</span>
            )}
          </span>
        </div>
        <span style={HEADER.subtitle}>Lua Script Manager</span>
      </div>

      <StatsCard installedCount={installedCount} />

      <PanelSection title="Quick Actions">
        <NavTile
          icon={<FaDownload />}
          title="Download Lua Script"
          description="Search & install scripts"
          route={ROUTES.download}
        />
        <NavTile
          icon={<FaBox />}
          title="Installed Scripts"
          description="Manage & re-download"
          route={ROUTES.installed}
        />
        <NavTile
          icon={<FaCog />}
          title="Settings"
          description="Configure plugin options"
          route={ROUTES.settings}
        />
      </PanelSection>

      <div style={FOOTER.container}>
        <RestartButton />
      </div>
    </div>
  );
}
