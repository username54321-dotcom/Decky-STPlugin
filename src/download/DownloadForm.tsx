import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect, useCallback } from "react";
import { GameSearchDropdown } from "./GameSearchDropdown";
import { useDebouncedSearch } from "./hooks/useDebouncedSearch";
import type { GameSearchResult } from "../shared/types";
import type { ApiSource } from "../shared/types";

const getAppName = callable<[number], string>("get_app_name");
const getApiSources = callable<[], ApiSource[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");

interface DownloadFormProps {
  onStart: (appid: number, source?: string) => void;
}

export function DownloadForm({ onStart }: DownloadFormProps) {
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [inputMode, setInputMode] = useState<"appid" | "search">("appid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { results: searchResults, searching } = useDebouncedSearch(searchQuery, inputMode);

  useEffect(() => {
    if (inputMode === "search" && searchQuery.trim()) {
      setSearchOpen(searchResults.length > 0);
    }
  }, [searchResults, inputMode, searchQuery]);

  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      setFastDownload(false);
    });
  }, []);

  const resolveName = useCallback(async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) {
      setResolvedName("");
      return;
    }
    const name = await getAppName(id);
    setResolvedName(name);
  }, [appidInput]);

  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleModeChange = (mode: "appid" | "search") => {
    if (mode === "appid") {
      setSearchOpen(false);
      setSearchQuery("");
    } else {
      setAppidInput("");
      setResolvedName("");
    }
    setInputMode(mode);
  };

  const handleStart = () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    const source = fastDownload ? "" : selectedSource;
    onStart(id, source);
  };

  return (
    <>
      <PanelSectionRow>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <ButtonItem
            layout="below"
            onClick={() => handleModeChange("appid")}
            disabled={inputMode === "appid"}
          >
            App ID
          </ButtonItem>
          <ButtonItem
            layout="below"
            onClick={() => handleModeChange("search")}
            disabled={inputMode === "search"}
          >
            Search
          </ButtonItem>
        </div>
      </PanelSectionRow>

      {inputMode === "appid" && (
        <>
          <PanelSectionRow>
            <TextField
              label="App ID"
              value={appidInput}
              onChange={(e) => setAppidInput(e.target.value)}
              onBlur={resolveName}
            />
          </PanelSectionRow>
          {resolvedName && (
            <PanelSectionRow>
              <div className={staticClasses.Label}>{resolvedName}</div>
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
        </>
      )}

      {inputMode === "search" && (
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
              <div className={staticClasses.Label}>{resolvedName}</div>
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
        </>
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
