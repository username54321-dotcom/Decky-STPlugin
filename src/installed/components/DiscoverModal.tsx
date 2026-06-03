import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  callable,
  addEventListener,
  removeEventListener,
} from "@decky/api";
import {
  ModalRoot,
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogButton,
  ProgressBar,
  Spinner,
  staticClasses,
} from "@decky/ui";
import { FaGamepad, FaCheckCircle, FaExclamationTriangle, FaSearch } from "react-icons/fa";
import type { DiscoverProgress } from "../../shared/types";
import { COLOR, CARD } from "../../shared/styles";

const discoverInstalledApps = callable<[], { success: boolean; discovered?: number; error?: string }>(
  "discover_installed_apps"
);

interface DiscoveredApp {
  appid: number;
  name: string;
  img_url: string;
}

interface DiscoverModalProps {
  onComplete: () => void;
  onClose: () => void;
}

export function DiscoverModal({ onComplete, onClose }: DiscoverModalProps) {
  const [progress, setProgress] = useState<DiscoverProgress | null>(null);
  const [apps, setApps] = useState<DiscoveredApp[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [visible, setVisible] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    const handler = (event: DiscoverProgress) => {
      setProgress(event);

      if (event.step === "processing" && event.app_name) {
        setApps((prev) => {
          const exists = prev.some((a) => a.appid === event.appid);
          if (exists) return prev;
          return [
            ...prev,
            {
              appid: event.appid!,
              name: event.app_name!,
              img_url: event.img_url || "",
            },
          ];
        });
      }

      if (event.step === "done" || event.step === "error") {
        setIsRunning(false);
      }
    };

    const unlisten = addEventListener<[DiscoverProgress]>("discover_progress", handler);
    return () => {
      removeEventListener("discover_progress", unlisten);
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    discoverInstalledApps().catch(() => {
      setIsRunning(false);
    });
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    onComplete();
  }, [onClose, onComplete]);

  const handleRetry = useCallback(() => {
    setApps([]);
    setProgress(null);
    setIsRunning(true);
    discoverInstalledApps().catch(() => {
      setIsRunning(false);
    });
  }, []);

  if (!visible) return null;

  const isError = progress?.step === "error";
  const isDone = progress?.step === "done";
  const isScanning = progress?.step === "scanning";

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <ModalRoot closeModal={handleClose}>
      <DialogHeader>Discover Installed Scripts</DialogHeader>
      <DialogBody>
        <div style={{ marginBottom: "12px" }}>
          {isScanning && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Spinner width={16} height={16} />
              <span className={staticClasses.Label}>
                Scanning directory...
              </span>
            </div>
          )}
          {progress?.step === "processing" && progress && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Spinner width={16} height={16} />
                <span className={staticClasses.Label}>
                  Processing {progress.current}/{progress.total}
                </span>
              </div>
              <ProgressBar nProgress={progressPercent / 100} />
            </div>
          )}
          {isDone && progress && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCheckCircle style={{ color: COLOR.success, fontSize: "16px" }} />
              <span className={staticClasses.Label}>
                Discovered {progress.total} scripts
              </span>
            </div>
          )}
          {isError && progress && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "rgba(255, 0, 0, 0.1)",
                borderRadius: CARD.borderRadius,
                border: "1px solid var(--gpSystemRed)",
              }}
            >
              <FaExclamationTriangle style={{ color: "var(--gpSystemRed)", fontSize: "16px" }} />
              <span className={staticClasses.Label} style={{ color: "var(--gpSystemRed)" }}>
                {progress.error || "An error occurred"}
              </span>
            </div>
          )}
        </div>

        {apps.length > 0 && (
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {apps.map((app) => (
              <div
                key={app.appid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 8px",
                  background: CARD.background,
                  borderRadius: CARD.borderRadius,
                }}
              >
                {app.img_url ? (
                  <img
                    src={app.img_url}
                    alt={app.name}
                    style={{
                      width: "80px",
                      height: "30px",
                      objectFit: "cover",
                      borderRadius: "2px",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "80px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: COLOR.backgroundHard,
                      borderRadius: "2px",
                      flexShrink: 0,
                    }}
                  >
                    <FaGamepad style={{ color: COLOR.muted, fontSize: "14px" }} />
                  </div>
                )}
                <span
                  className={staticClasses.Label}
                  style={{
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {app.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {apps.length === 0 && !isError && !isDone && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "24px 0",
            }}
          >
            <FaSearch style={{ fontSize: "24px", color: COLOR.muted }} />
            <span style={{ color: COLOR.muted, fontSize: "13px" }}>
              Looking for Lua scripts...
            </span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {isDone && (
          <DialogButton onClick={handleClose}>
            Done
          </DialogButton>
        )}
        {isError && (
          <>
            <DialogButton onClick={handleRetry}>
              Retry
            </DialogButton>
            <DialogButton onClick={handleClose}>
              Close
            </DialogButton>
          </>
        )}
        {isRunning && (
          <DialogButton disabled>
            Processing...
          </DialogButton>
        )}
      </DialogFooter>
    </ModalRoot>
  );
}
