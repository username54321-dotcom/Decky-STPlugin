import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  SingleDropdownOption,
  Navigation,
  staticClasses,
} from "@decky/ui";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import React, { useState, useEffect, useCallback } from "react";
import { FaDownload, FaTrash, FaArrowLeft } from "react-icons/fa";
import { GameSearchDropdown } from "./GameSearchDropdown";
import type { GameSearchResult } from "./GameSearchDropdown";

const getAppName = callable<[number], string>("get_app_name");
const startDownload = callable<[number, string?], string>("start_download");
const cancelDownload = callable<[string], void>("cancel_download");
const getApiSources = callable<[], { name: string; url: string }[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");
const searchGames = callable<[string], GameSearchResult[]>("search_games");
const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

interface ApiSource {
  name: string;
  url: string;
}

interface DownloadProgress {
  task_id: string;
  phase: string;
  percent: number;
  message: string;
  appid?: number;
  error?: string;
}

export function DownloadPanel() {
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadProgress | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState("");
  const [inputMode, setInputMode] = useState<"appid" | "search">("appid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [restartConfirming, setRestartConfirming] = useState(false);

  const handlePostDownloadRestart = async () => {
    if (!restartConfirming) {
      setRestartConfirming(true);
      return;
    }
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
        setShowRestartPrompt(false);
        setRestartConfirming(false);
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setRestartConfirming(false);
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setRestartConfirming(false);
    }
  };

  const dismissRestartPrompt = () => {
    setShowRestartPrompt(false);
    setRestartConfirming(false);
  };

  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      setFastDownload(false);
    });
  }, []);

  useEffect(() => {
    const listener = addEventListener<[string, DownloadProgress]>(
      "download_progress",
      (taskId, progress) => {
        if (taskId === currentTaskId) {
          setDownloadState(progress);
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Installed Lua for App ${progress.appid}`,
            });
            setShowRestartPrompt(true);
          } else if (progress.phase === "error") {
            toaster.toast({
              title: "Download Failed",
              body: progress.message || "Unknown error",
            });
          }
        }
      }
    );
    return () => removeEventListener("download_progress", listener);
  }, [currentTaskId]);

  useEffect(() => {
    if (inputMode !== "search" || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchGames(searchQuery.trim());
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch {
        setSearchResults([]);
        setSearchOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, inputMode]);

  const resolveName = useCallback(async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) {
      setResolvedName("");
      return;
    }
    const name = await getAppName(id);
    setResolvedName(name);
  }, [appidInput]);

  const handleStart = async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    setShowRestartPrompt(false);
    setRestartConfirming(false);

    const source = fastDownload ? "" : selectedSource;
    const taskId = await startDownload(id, source);
    setCurrentTaskId(taskId);
    setDownloadState({
      task_id: taskId,
      phase: "fetching_apis",
      percent: 0,
      message: "Starting...",
    });
  };

  const handleCancel = async () => {
    if (currentTaskId) {
      await cancelDownload(currentTaskId);
      setDownloadState({
        task_id: currentTaskId,
        phase: "cancelled",
        percent: 0,
        message: "Cancelled",
      });
    }
  };

  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSearchOpen(false);
    setSearchResults([]);
  };

  const handleModeChange = (mode: "appid" | "search") => {
    if (mode === "appid") {
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    } else {
      setAppidInput("");
      setResolvedName("");
    }
    setInputMode(mode);
  };

  const isDownloading =
    downloadState &&
    !["done", "error", "cancelled"].includes(downloadState.phase);

  return (
    <PanelSection title="Download Lua Script">
      {/* Mode toggle */}
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

      {/* App ID input */}
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

      {/* Search input */}
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
                onClose={() => setSearchOpen(false)}
              />
            </PanelSectionRow>
          )}
          {!searchOpen && searchQuery.trim() && searchResults.length === 0 && (
            <PanelSectionRow>
              <div className={staticClasses.Label} style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}>
                No results found
              </div>
            </PanelSectionRow>
          )}
          {/* Show resolved name after selection */}
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

      {/* Start Download button (visible in both modes) */}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleStart}
          disabled={!!(!appidInput || isDownloading)}
        >
          {isDownloading ? "Downloading..." : "Start Download"}
        </ButtonItem>
      </PanelSectionRow>
      {downloadState && (
        <PanelSectionRow>
          <div>
            <div>
              {downloadState.phase}: {downloadState.message}
            </div>
            {downloadState.percent > 0 && (
              <div>Progress: {downloadState.percent}%</div>
            )}
            {isDownloading && (
              <ButtonItem layout="below" onClick={handleCancel}>
                Cancel
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
      )}

      {/* Post-download restart prompt */}
      {showRestartPrompt && !isDownloading && (
        <PanelSectionRow>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div className={staticClasses.Label} style={{ color: "var(--gpSystemGreen)" }}>
              Download complete!
            </div>
            {restartConfirming ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className={staticClasses.Label} style={{ color: "var(--gpSystemYellow)" }}>
                  Restart Steam to apply changes?
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <ButtonItem layout="below" onClick={dismissRestartPrompt}>
                    Cancel
                  </ButtonItem>
                  <ButtonItem layout="below" onClick={handlePostDownloadRestart}>
                    Yes, restart
                  </ButtonItem>
                </div>
              </div>
            ) : (
              <ButtonItem layout="below" onClick={handlePostDownloadRestart}>
                Restart Steam to apply
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
