import React, { useEffect, useState, useCallback } from "react";
import {
  ModalRoot,
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogButton,
  ProgressBarWithInfo,
  staticClasses,
} from "@decky/ui";
import { FaCheckCircle, FaExclamationTriangle, FaGamepad } from "react-icons/fa";
import { useDownloadLifecycle } from "../hooks/useDownloadLifecycle";
import { useRestartSteam } from "../../shared/hooks/useRestartSteam";
import { COLOR, CARD } from "../../shared/styles";

interface DownloadModalProps {
  appid: number;
  name?: string;
  imgUrl?: string;
  source?: string;
  onClose: () => void;
}

export function DownloadModal({ appid, name, imgUrl, source, onClose }: DownloadModalProps) {
  const { confirmRestart } = useRestartSteam();
  const download = useDownloadLifecycle(() => {}, true);
  const [startError, setStartError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    download.start(appid, source).catch((err: any) => {
      setStartError(String(err));
    });
  }, [appid, source]);

  useEffect(() => {
    if (download.state?.phase === "cancelled") {
      onClose();
    }
  }, [download.state?.phase, onClose]);

  const handleRestart = useCallback(() => {
    confirmRestart();
    onClose();
  }, [confirmRestart, onClose]);

  const handleRetry = useCallback(() => {
    setStartError(null);
    download.start(appid, source).catch((err: any) => {
      setStartError(String(err));
    });
  }, [appid, source, download]);

  const isActive = download.isActive && download.state?.phase !== "cancelled";
  const isDone = !download.isActive && download.state?.phase === "done";
  const isError =
    startError !== null ||
    (!download.isActive && download.state?.phase === "error");
  const errorMessage =
    startError || download.state?.error || "Unknown error";

  return (
    <ModalRoot closeModal={onClose}>
      <DialogHeader>
        Download {name || `App ${appid}`}
      </DialogHeader>
      <DialogBody>
        {(name || imgUrl) && !imgError && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ flexShrink: 0, width: CARD.capsuleWidth, height: CARD.capsuleHeight }}>
              <img
                src={imgUrl || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_sm_120.jpg`}
                alt={name || String(appid)}
                loading="lazy"
                onError={() => setImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
              />
            </div>
            <div
              className={staticClasses.Label}
              style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {name || `App ${appid}`}
            </div>
          </div>
        )}

        {imgError && name && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
            <div
              style={{
                flexShrink: 0,
                width: CARD.capsuleWidth,
                height: CARD.capsuleHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--gpBackgroundMedium)",
                borderRadius: "4px",
              }}
            >
              <FaGamepad style={{ color: "var(--gpSystemLighterGrey)", fontSize: "20px" }} />
            </div>
            <div
              className={staticClasses.Label}
              style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {name}
            </div>
          </div>
        )}

        {isActive && download.state && (
          <ProgressBarWithInfo
            nProgress={
              download.state.percent > 0 ? download.state.percent : undefined
            }
            indeterminate={download.state.percent <= 0}
            sOperationText={download.state.message}
            nTransitionSec={0.5}
            bottomSeparator="none"
            childrenContainerWidth="max"
          />
        )}

        {isDone && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 0",
            }}
          >
            <FaCheckCircle
              style={{ color: COLOR.success, fontSize: "16px", flexShrink: 0 }}
            />
            <span className={staticClasses.Label}>
              Download complete!{" "}
              {name || `App ${appid}`}
              .lua installed.
            </span>
          </div>
        )}

        {isError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "rgba(255, 0, 0, 0.1)",
              borderRadius: "4px",
              border: "1px solid var(--gpSystemRed)",
            }}
          >
            <FaExclamationTriangle
              style={{
                color: "var(--gpSystemRed)",
                fontSize: "16px",
                flexShrink: 0,
              }}
            />
            <span
              className={staticClasses.Label}
              style={{ color: "var(--gpSystemRed)" }}
            >
              {errorMessage}
            </span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {isActive && (
          <DialogButton onClick={download.cancel}>Cancel</DialogButton>
        )}

        {isDone && (
          <>
            <DialogButton onClick={handleRestart}>
              Restart Steam
            </DialogButton>
            <DialogButton onClick={onClose}>Close</DialogButton>
          </>
        )}

        {isError && (
          <>
            <DialogButton onClick={handleRetry}>Retry</DialogButton>
            <DialogButton onClick={onClose}>Close</DialogButton>
          </>
        )}
      </DialogFooter>
    </ModalRoot>
  );
}
