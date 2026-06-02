import React from "react";
import { staticClasses } from "@decky/ui";

export interface GameSearchResult {
  id: number;
  name: string;
  img: string;
}

export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
  onClose: () => void;
}

export function GameSearchDropdown({ results, onSelect, onClose }: GameSearchDropdownProps) {
  if (results.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          padding: "12px 16px",
          color: "var(--gpSystemLighterGrey)",
          fontSize: "14px",
          backgroundColor: "var(--gpBackgroundMedium)",
          border: "1px solid var(--gpBackgroundLight)",
          borderTop: "none",
          borderBottomLeftRadius: "3px",
          borderBottomRightRadius: "3px",
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
        backgroundColor: "var(--gpBackgroundMedium)",
        border: "1px solid var(--gpBackgroundLight)",
        borderTop: "none",
        borderBottomLeftRadius: "3px",
        borderBottomRightRadius: "3px",
      }}
    >
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid var(--gpBackgroundLight)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--gpBackgroundHard)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
        >
          {result.img ? (
            <img
              src={result.img}
              alt={result.name}
              style={{
                width: "120px",
                height: "45px",
                objectFit: "cover",
                borderRadius: "3px",
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
                backgroundColor: "var(--gpBackgroundHard)",
                borderRadius: "3px",
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
      ))}
    </div>
  );
}
