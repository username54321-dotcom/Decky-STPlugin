import React from "react";
import { CARD } from "../../shared/styles";

export function SkeletonCard() {
  return (
    <div
        style={{
          background: CARD.background,
          border: CARD.border,
          borderRadius: CARD.borderRadius,
          padding: CARD.padding,
          display: "flex",
          gap: CARD.padding,
          alignItems: "flex-start",
        }}
      >
        {/* Capsule placeholder */}
        <div
          style={{
            flexShrink: 0,
            width: CARD.capsuleWidth,
            height: CARD.capsuleHeight,
            background: "var(--gpBackgroundMedium)",
            borderRadius: "4px",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />

        {/* Text placeholders */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              height: "14px",
              width: "70%",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "10px",
              width: "40%",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.2s",
            }}
          />
        </div>

        {/* Button placeholders */}
        <div style={{ flexShrink: 0, display: "flex", gap: "8px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.4s",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.6s",
            }}
          />
        </div>
      </div>
  );
}
