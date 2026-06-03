import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaGamepad } from "react-icons/fa";
import { GameSearchDropdown } from "./download/components/GameSearchDropdown";
import { useDebouncedSearch } from "./download/hooks/useDebouncedSearch";
import type { GameSearchResult } from "./shared/types";
import type { ApiSource } from "./shared/types";
import { CARD } from "./shared/styles";

const getApiSources = callable<[], ApiSource[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");

interface DownloadFormProps {
  onStart: (appid: number, source?: string, imgUrl?: string) => void;
}

export function DownloadForm({ onStart }: DownloadFormProps) {
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedImg, setSelectedImg] = useState("");
  const [imgError, setImgError] = useState(false);

  const { results: searchResults, searching } = useDebouncedSearch(searchQuery);

  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchOpen(searchResults.length > 0);
    }
  }, [searchResults, searchQuery]);

  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      setFastDownload(false);
    });
  }, []);

  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSelectedImg(result.img);
    setImgError(false);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleStart = () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    const source = fastDownload ? "" : selectedSource;
    onStart(id, source, selectedImg);
    setSelectedImg("");
  };

  return (
    <>
      <PanelSectionRow>
        <TextField
          label="Game Name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </PanelSectionRow>
      {searchOpen && (
        <PanelSectionRow>
          <GameSearchDropdown
            results={searchResults}
            onSelect={handleSearchSelect}
          />
        </PanelSectionRow>
      )}
      {!searchOpen && searchQuery.trim() && searchResults.length === 0 && !searching && (
        <PanelSectionRow>
          <div
            className={staticClasses.Label}
            style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}
          >
            No results found
          </div>
        </PanelSectionRow>
      )}
      {resolvedName && !searchOpen && (
        <PanelSectionRow>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
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
                  src={selectedImg || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appidInput}/capsule_sm_120.jpg`}
                  alt={resolvedName}
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
            <div
              className={staticClasses.Label}
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {resolvedName}
            </div>
          </div>
        </PanelSectionRow>
      )}
      {!fastDownload && sources.length > 0 && (
        <PanelSectionRow>
          <DropdownItem
            label="API Source"
            description="Choose a download source or leave as Auto"
            rgOptions={[
              { data: "", label: "Auto (try all)" },
              ...sources.map((s) => ({ data: s.name, label: s.name })),
            ]}
            selectedOption={selectedSource}
            onChange={(opt) => setSelectedSource(opt.data as string)}
          />
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleStart}
          disabled={!appidInput}
        >
          Start Download
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
