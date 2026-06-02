import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";
import type { Settings } from "../shared/types";
import { SETTINGS_KEYS } from "../shared/constants";
import { SPACING, BORDER } from "../shared/styles";
import { PageLayout } from "../shared/components/PageLayout";

const getSettings = callable<[], Settings>("get_settings");
const setSetting = callable<[string, any], void>("set_setting");
const refreshApiManifest = callable<[], { name: string; url: string }[]>("refresh_api_manifest");

export function SettingsPanel() {
  const [fastDownload, setFastDownload] = useState(false);
  const [apiKey, setApiKey] = useState("");

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
    </PageLayout>
  );
}
