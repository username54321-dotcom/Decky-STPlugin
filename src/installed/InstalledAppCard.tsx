import { ButtonItem, staticClasses, ControlsList, ConfirmModal, showModal } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState } from "react";
import { FaTrash, FaRedo, FaGamepad, FaExclamationTriangle } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";
import { CARD, SPACING } from "../shared/styles";

const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

interface InstalledAppCardProps {
  app: InstalledApp;
  onDelete: (appid: number) => void;
}

export function InstalledAppCard({ app, onDelete }: InstalledAppCardProps) {
  const [imgError, setImgError] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const capsuleUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${app.appid}/capsule_231x87.jpg`;

  const handleDelete = () => {
    showModal(
      <ConfirmModal
        strTitle="Delete Script?"
        strDescription={`Delete ${app.name || `App ${app.appid}`}? This cannot be undone.`}
        strOKButtonText="Delete"
        strCancelButtonText="Cancel"
        bDestructiveWarning={true}
        onOK={async () => {
          const ok = await deleteApp(app.appid);
          if (ok) {
            toaster.toast({ title: "STPlugin", body: `Deleted ${app.name || `App ${app.appid}`}` });
            onDelete(app.appid);
          } else {
            toaster.toast({ title: "Error", body: "Failed to delete script" });
          }
        }}
      />
    );
  };

  const handleRedownload = async () => {
    setDownloadError(false);
    try {
      await startDownload(app.appid);
      toaster.toast({ title: "STPlugin", body: `Re-downloading ${app.name || `App ${app.appid}`}...` });
    } catch {
      setDownloadError(true);
      toaster.toast({ title: "Error", body: "Failed to re-download script" });
    }
  };

  return (
    <div
      style={{
        background: CARD.background,
        border: downloadError ? "1px solid var(--gpSystemRed)" : CARD.border,
        borderRadius: CARD.borderRadius,
        padding: CARD.padding,
        display: "flex",
        gap: CARD.padding,
        alignItems: "flex-start",
      }}
    >
      {/* Capsule Image */}
      <div style={{ flexShrink: 0, width: CARD.capsuleWidth, height: CARD.capsuleHeight }}>
        {imgError ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
            }}
          >
            <FaGamepad style={{ color: "var(--gpSystemLighterGrey)", fontSize: "20px" }} />
          </div>
        ) : (
          <img
            src={capsuleUrl}
            alt={app.name || `App ${app.appid}`}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "4px",
            }}
          />
        )}
      </div>

      {/* App Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={staticClasses.Label}
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {app.name || `App ${app.appid}`}
        </div>
        <div
          style={{
            color: "var(--gpSystemLighterGrey)",
            fontSize: "12px",
            marginTop: "2px",
          }}
        >
          App ID: {app.appid}
        </div>
        {downloadError && (
          <div
            style={{
              color: "var(--gpSystemRed)",
              fontSize: "12px",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaExclamationTriangle style={{ fontSize: "10px" }} />
            Download failed — click to retry
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ flexShrink: 0, display: "flex", gap: SPACING.controlsGap }}>
        <ButtonItem layout="below" onClick={handleRedownload}>
          <FaRedo />
        </ButtonItem>
        <ButtonItem layout="below" onClick={handleDelete}>
          <FaTrash />
        </ButtonItem>
      </div>
    </div>
  );
}
