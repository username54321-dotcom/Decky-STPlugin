import { findModuleExport, afterPatch } from "@decky/ui";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import React, { useState } from "react";

const startDownload = callable<[number, string?], string>("start_download");
const getSettings = callable<[], { fastDownload: boolean }>("get_settings");

export function registerStoreButtonPatch() {
  const StoreGamePage = findModuleExport((e: any) =>
    e?.toString?.()?.includes("StoreGamePage") ||
    e?.toString?.()?.includes("appdetails")
  );

  if (!StoreGamePage) {
    console.warn("[STPlugin] Could not find store game page component");
    return;
  }

  const unpatch = afterPatch(
    StoreGamePage,
    "type",
    (_props: any, _ret: any) => {
      if (!_ret?.props) return _ret;

      const appid = _ret.props.appid || _ret.props.nAppID || _ret.props.unAppID;
      if (!appid) return _ret;

      const isDLC =
        _ret.props.bIsDlc ||
        _ret.props.eAppType === "DLC" ||
        _ret.props.strDLCName;

      const children = _ret.props.children;
      if (Array.isArray(children)) {
        children.push(
          <StoreButton
            key="stplugin-download-btn"
            appid={appid}
            isDLC={!!isDLC}
          />
        );
      }

      return _ret;
    }
  );

  console.log("[STPlugin] Store button patch registered");

  return unpatch;
}

function StoreButton({ appid, isDLC }: { appid: number; isDLC: boolean }) {
  const [downloading, setDownloading] = useState(false);

  const handleClick = async () => {
    if (isDLC || downloading) return;

    setDownloading(true);
    try {
      const taskId = await startDownload(appid);
      toaster.toast({
        title: "STPlugin",
        body: `Downloading Lua for App ${appid}...`,
      });

      interface Progress {
        task_id: string;
        phase: string;
        message?: string;
        appid?: number;
      }
      const listener = addEventListener<[string, Progress]>(
        "download_progress",
        (eventTaskId: string, progress: Progress) => {
          if (eventTaskId !== taskId) return;
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Lua installed for App ${progress.appid || appid}`,
            });
            removeEventListener("download_progress", listener);
            setDownloading(false);
          } else if (progress.phase === "error") {
            toaster.toast({
              title: "Download Failed",
              body: progress.message || "Unknown error",
            });
            removeEventListener("download_progress", listener);
            setDownloading(false);
          }
        }
      );
    } catch (err: any) {
      toaster.toast({ title: "Error", body: err?.message || "Download failed" });
      setDownloading(false);
    }
  };

  if (isDLC) {
    return (
      <button
        disabled
        title="Lua scripts cannot be installed for DLC"
        style={{ opacity: 0.5, cursor: "not-allowed" }}
      >
        DLC — Cannot Install
      </button>
    );
  }

  return (
    <button onClick={handleClick} disabled={downloading}>
      {downloading ? "Downloading..." : "Add via LuaTools"}
    </button>
  );
}
