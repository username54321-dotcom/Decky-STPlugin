import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";
import type { Settings } from "./shared/types";
import { SETTINGS_KEYS } from "./shared/constants";
import { SPACING, BORDER } from "./shared/styles";
import { PageLayout } from "./shared/components/PageLayout";
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";

const getSettings = callable<[], Settings>("get_settings");
const setSetting = callable<[string, any], void>("set_setting");
const refreshApiManifest = callable<[], { name: string; url: string }[]>("refresh_api_manifest");

export function SettingsPanel() {
  const [fastDownload, setFastDownload] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const { status: updateStatus, checkUpdate, install } = useUpdateStatus();

  useEffect(() => {
    getSettings().then((s) => {
      setFastDownload(s.fastDownload);
      setApiKey(s.morrenusApiKey);
    });
  }, []);

  const handleFastDownload = async (checked: boolean) => {
    setFastDownload(checked);
    await setSetting(SETTINGS_KEYS.fastDownload, checked);
  };

  const handleApiKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    await setSetting(SETTINGS_KEYS.apiKey, value);
  };

  const handleRefresh = async () => {
    const sources = await refreshApiManifest();
    toaster.toast({
      title: "STPlugin",
      body: `Loaded ${sources.length} API sources`,
    });
  };

  return (
    <PageLayout title="Settings">
      <PanelSectionRow>
        <ToggleField
          label="Fast Download"
          description="Skip source picker — auto-select first working API source"
          checked={fastDownload}
          onChange={handleFastDownload}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
      </PanelSectionRow>

      <PanelSectionRow>
        <TextField
          label="Morrenus API Key"
          description="Optional"
          value={apiKey}
          onChange={handleApiKeyChange}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
      </PanelSectionRow>

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleRefresh}>
          <FaSync style={{ marginRight: "4px" }} />
          Refresh API Sources
        </ButtonItem>
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Plugin Updates</div>
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ fontSize: "12px", color: "#8b929a" }}>
          Current Version: {updateStatus.currentVersion}
        </div>
      </PanelSectionRow>

      {updateStatus.checkedAt && (
        <PanelSectionRow>
          <div style={{ fontSize: "12px", color: "#8b929a" }}>
            Last Checked: {new Date(updateStatus.checkedAt * 1000).toLocaleString()}
          </div>
        </PanelSectionRow>
      )}

      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={checkUpdate}
          disabled={updateStatus.installing}
        >
          {updateStatus.installing ? "Installing..." : "Check for Updates"}
        </ButtonItem>
      </PanelSectionRow>

      {updateStatus.available && updateStatus.latestVersion && (
        <PanelSectionRow>
          <div style={{
            background: "rgba(0, 255, 0, 0.1)",
            border: "1px solid rgba(0, 255, 0, 0.3)",
            borderRadius: "4px",
            padding: "8px",
            marginBottom: "8px",
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              Update Available: v{updateStatus.latestVersion}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {updateStatus.releaseUrl && (
                <ButtonItem
                  onClick={() => {
                    window.open(updateStatus.releaseUrl!, "_blank");
                  }}
                >
                  View Release
                </ButtonItem>
              )}
              <ButtonItem
                layout="below"
                onClick={install}
                disabled={updateStatus.installing}
              >
                {updateStatus.installing ? "Installing..." : "Install Now"}
              </ButtonItem>
            </div>
          </div>
        </PanelSectionRow>
      )}
    </PageLayout>
  );
}
