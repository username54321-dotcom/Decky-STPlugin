import {
  PanelSection,
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";

const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");
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
    await setSetting("fastDownload", checked);
  };

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    await setSetting("morrenusApiKey", value);
  };

  const handleRefresh = async () => {
    const sources = await refreshApiManifest();
    toaster.toast({
      title: "STPlugin",
      body: `Loaded ${sources.length} API sources`,
    });
  };

  return (
    <PanelSection title="Settings">
      <PanelSectionRow>
        <ToggleField
          label="Fast Download"
          description="Skip source picker — auto-select first working API source"
          checked={fastDownload}
          onChange={handleFastDownload}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Morrenus API Key (optional)"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleRefresh}>
          <FaSync /> Refresh API Sources
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
