import { ButtonItem, staticClasses } from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaBoxOpen, FaExclamationTriangle, FaSync } from "react-icons/fa";
import type { InstalledApp } from "./shared/types";
import { CARD, SPACING } from "./shared/styles";
import { PageLayout } from "./shared/components/PageLayout";
import { InstalledAppCard } from "./installed/components/InstalledAppCard";
import { SkeletonCard } from "./installed/components/SkeletonCard";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

type PageState = "loading" | "loaded" | "error";

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [state, setState] = useState<PageState>("loading");

  const loadApps = async () => {
    setState("loading");
    try {
      const result = await getInstalledApps();
      setApps(result);
      setState("loaded");
    } catch (err) {
      console.warn("[STPlugin] Failed to load installed apps:", err);
      setState("error");
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDeleteSuccess = (appid: number) => {
    setApps((prev) => prev.filter((app) => app.appid !== appid));
  };

  // Loading state
  if (state === "loading") {
    return (
      <PageLayout title="Installed Scripts">
        <style>{`@keyframes skeleton-pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: CARD.gap }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <PageLayout title="Installed Scripts">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            gap: "16px",
            textAlign: "center",
          }}
        >
          <FaExclamationTriangle
            style={{ fontSize: "32px", color: "var(--gpSystemYellow)" }}
          />
          <div className={staticClasses.Label}>
            Failed to load installed scripts.
          </div>
          <ButtonItem onClick={loadApps}>
            <FaSync style={{ marginRight: "8px" }} />
            Retry
          </ButtonItem>
        </div>
      </PageLayout>
    );
  }

  // Empty state
  if (apps.length === 0) {
    return (
      <PageLayout title="Installed Scripts">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            gap: "12px",
            textAlign: "center",
          }}
        >
          <FaBoxOpen
            style={{ fontSize: "40px", color: "var(--gpSystemLighterGrey)" }}
          />
          <div className={staticClasses.Label}>
            No Lua scripts installed yet.
          </div>
          <div style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}>
            Download one from the Search tab.
          </div>
        </div>
      </PageLayout>
    );
  }

  // Loaded state with cards
  return (
    <PageLayout title="Installed Scripts">
      <div style={{ display: "flex", flexDirection: "column", gap: CARD.gap }}>
        {apps.map((app) => (
          <InstalledAppCard
            key={app.appid}
            app={app}
            onDelete={handleDeleteSuccess}
          />
        ))}
      </div>
    </PageLayout>
  );
}
