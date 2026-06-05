import React, { useEffect, useState } from "react";
import {
  afterPatch,
  createReactTreePatcher,
  findModuleExport,
  findInReactTree,
  Navigation,
} from "@decky/ui";
import { callable, addEventListener, removeEventListener } from "@decky/api";
import { FaCheck, FaDownload } from "react-icons/fa";
import { ROUTES } from "../shared/constants";
import { setPendingAppid } from "../shared/navigationState";
import type { InstalledApp } from "../shared/types";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

let _installedAppids: Set<number> = new Set();

async function refreshCache(): Promise<void> {
  try {
    const apps = await getInstalledApps();
    _installedAppids = new Set(apps.map((a) => a.appid));
  } catch {
    console.warn("[STPlugin] Failed to refresh installed apps cache");
  }
}

function addAppid(appid: number): void {
  _installedAppids.add(appid);
}

function removeAppid(appid: number): void {
  _installedAppids.delete(appid);
}

function ScriptStatusIcon({ appid }: { appid: number }) {
  const [installed, setInstalled] = useState(_installedAppids.has(appid));

  useEffect(() => {
    setInstalled(_installedAppids.has(appid));
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (installed) {
      Navigation.Navigate(ROUTES.installed);
    } else {
      setPendingAppid(appid);
      Navigation.Navigate(ROUTES.download);
    }
  };

  const iconStyle: React.CSSProperties = {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    marginLeft: "8px",
    borderRadius: "4px",
    background: installed ? "rgba(92, 184, 92, 0.15)" : "rgba(150, 150, 150, 0.15)",
    transition: "background 0.15s ease",
  };

  return (
    <div
      key="stplugin-status"
      onClick={handleClick}
      style={iconStyle}
      title={installed ? "Lua script installed — click to manage" : "No Lua script — click to download"}
    >
      {installed ? (
        <FaCheck style={{ color: "#5cb85c", fontSize: "12px" }} />
      ) : (
        <FaDownload style={{ color: "#a0a0a0", fontSize: "12px" }} />
      )}
    </div>
  );
}

const PLAY_BAR_FINGERPRINTS = [
  "PlayBar",
  "PlayButton",
  "GameActions",
  "AppActions",
];

let _unpatch: any = null;

export async function registerPlayBarPatch(): Promise<() => void> {
  await refreshCache();

  const downloadListener = addEventListener(
    "download_progress",
    (_taskId: string, data: any) => {
      if (data?.phase === "done" && data?.appid) {
        addAppid(data.appid);
      }
    }
  );

  const LibraryApp = findModuleExport((e: any) =>
    e?.toString?.()?.includes("LibraryApp")
  );

  if (!LibraryApp) {
    console.warn("[STPlugin] Could not find LibraryApp module — PlayBar icon disabled");
    return () => {
      removeEventListener("download_progress", downloadListener);
    };
  }

  _unpatch = afterPatch(
    LibraryApp,
    "type",
    createReactTreePatcher(
      [
        (tree: any) =>
          findInReactTree(tree, (node: any) => {
            const str = node?.type?.toString?.() || "";
            return PLAY_BAR_FINGERPRINTS.some((fp) => str.includes(fp));
          }),
      ],
      (args: any[]) => {
        const [props, ret] = args;
        const appid = props?.appid ?? props?.nAppID ?? props?.appId;
        if (!appid || !ret?.props?.children) return ret;

        const children = Array.isArray(ret.props.children)
          ? ret.props.children
          : [ret.props.children];
        const alreadyInjected = children.some(
          (c: any) => c?.key === "stplugin-status"
        );
        if (alreadyInjected) return ret;

        ret.props.children = [
          ...children,
          <ScriptStatusIcon key="stplugin-status" appid={Number(appid)} />,
        ];
        return ret;
      },
      "LibraryApp:PlayBar"
    )
  );

  console.log("[STPlugin] PlayBar patch registered");

  return () => {
    _unpatch?.();
    _unpatch = null;
    removeEventListener("download_progress", downloadListener);
    console.log("[STPlugin] PlayBar patch unregistered");
  };
}

export { refreshCache, removeAppid };
