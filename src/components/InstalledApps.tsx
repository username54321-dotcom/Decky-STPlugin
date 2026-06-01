import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaDownload, FaTrash, FaRedo } from "react-icons/fa";

const getInstalledApps = callable<[], { appid: number; name: string }[]>("get_installed_apps");
const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

interface InstalledApp {
  appid: number;
  name: string;
}

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);

  const loadApps = async () => {
    try {
      const result = await getInstalledApps();
      setApps(result);
    } catch {
      console.warn("[STPlugin] Failed to load installed apps");
      setApps([]);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = async (appid: number) => {
    const ok = await deleteApp(appid);
    if (ok) {
      toaster.toast({ title: "STPlugin", body: `Removed Lua for App ${appid}` });
      await loadApps();
    } else {
      toaster.toast({ title: "Error", body: "Failed to remove Lua file" });
    }
  };

  const handleRedownload = async (appid: number) => {
    const taskId = await startDownload(appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading App ${appid}...` });
  };

  if (apps.length === 0) {
    return (
      <PanelSection title="Installed Scripts">
        <PanelSectionRow>
          <div className={staticClasses.Label}>No Lua scripts installed yet.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Installed Scripts">
      {apps.map((app) => (
        <PanelSectionRow key={app.appid}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>
              {app.name || `App ${app.appid}`}
            </span>
            <ButtonItem onClick={() => handleRedownload(app.appid)}>
              <FaRedo />
            </ButtonItem>
            <ButtonItem onClick={() => handleDelete(app.appid)}>
              <FaTrash />
            </ButtonItem>
          </div>
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}
