import React, { useState } from "react";
import { staticClasses, Focusable } from "@decky/ui";
import type { GameSearchResult } from "../../shared/types";
import { COLOR, BORDER } from "../../shared/styles";

export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
}

export function GameSearchDropdown({ results, onSelect }: GameSearchDropdownProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (results.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          padding: "12px 16px",
          color: COLOR.muted,
          fontSize: "14px",
          backgroundColor: COLOR.backgroundMedium,
          border: `1px solid ${COLOR.backgroundLight}`,
          borderTop: "none",
          borderBottomLeftRadius: BORDER.cardRadius,
          borderBottomRightRadius: BORDER.cardRadius,
        }}
      >
        No results found
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        maxHeight: "320px",
        overflowY: "auto",
        backgroundColor: COLOR.backgroundMedium,
        border: `1px solid ${COLOR.backgroundLight}`,
        borderTop: "none",
        borderBottomLeftRadius: BORDER.cardRadius,
        borderBottomRightRadius: BORDER.cardRadius,
      }}
    >
      {results.map((result, i) => (
        <Focusable key={result.id} onActivate={() => onSelect(result)}>
          <div
            onClick={() => onSelect(result)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: `1px solid ${COLOR.backgroundLight}`,
              backgroundColor: hoveredIndex === i ? COLOR.backgroundHard : "transparent",
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {result.img ? (
              <img
                src={result.img}
                alt={result.name}
                style={{
                  width: "120px",
                  height: "45px",
                  objectFit: "cover",
                  borderRadius: BORDER.cardRadius,
                  flexShrink: 0,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  width: "120px",
                  height: "45px",
                  backgroundColor: COLOR.backgroundHard,
                  borderRadius: BORDER.cardRadius,
                  flexShrink: 0,
                }}
              />
            )}
            <span
              className={staticClasses.Label}
              style={{
                fontSize: "14px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.name}
            </span>
          </div>
        </Focusable>
      ))}
    </div>
  );
}
