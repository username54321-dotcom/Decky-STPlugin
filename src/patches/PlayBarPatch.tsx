import React, { useEffect, useState } from "react";
import {
  afterPatch,
  createReactTreePatcher,
  findInReactTree,
  Navigation,
} from "@decky/ui";
import { callable, addEventListener, removeEventListener, routerHook } from "@decky/api";


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

  const textStyle: React.CSSProperties = {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "8px",
    padding: "2px 4px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.5px",
    color: installed ? "#5cb85c" : "#a0a0a0",
    background: installed ? "rgba(92, 184, 92, 0.15)" : "rgba(150, 150, 150, 0.15)",
    transition: "background 0.15s ease",
  };

  return (
    <div
      key="stplugin-status"
      onClick={handleClick}
      style={textStyle}
      title={installed ? "Lua script installed — click to manage" : "No Lua script — click to download"}
    >
      ST
    </div>
  );
}

export async function patchLibraryApp(): Promise<() => void> {
  await refreshCache();

  const downloadListener = addEventListener(
    "download_progress",
    (_taskId: string, data: any) => {
      if (data?.phase === "done" && data?.appid) {
        addAppid(data.appid);
      }
    }
  );

  const patchRef = routerHook.addPatch(
    "/library/app/:appId",
    (tree: any) => {
      const routeProps = findInReactTree(tree, (x: any) => x?.renderFunc);
      if (!routeProps) {
        console.warn("[STPlugin] Could not find route renderer in tree — PlayBar icon disabled");
        return tree;
      }

      const handler = createReactTreePatcher(
        [
          (subtree: any) =>
            findInReactTree(subtree, (node: any) => node?.props?.appid != null),
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
      );

      afterPatch(routeProps, "renderFunc", handler);
      return tree;
    }
  );

  console.log("[STPlugin] PlayBar route patch registered");

  return () => {
    routerHook.removePatch("/library/app/:appId", patchRef);
    removeEventListener("download_progress", downloadListener);
    console.log("[STPlugin] PlayBar route patch unregistered");
  };
}

export { refreshCache, removeAppid };
