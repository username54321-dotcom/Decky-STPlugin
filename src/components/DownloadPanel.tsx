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
import { FaDownload, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useState, useEffect, useCallback } from "react";

const getAppName = callable<[number], string>("get_app_name");
const startDownload = callable<[number, string?], string>("start_download");
const cancelDownload = callable<[string], void>("cancel_download");
const getApiSources = callable<[], { name: string; url: string }[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");

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

  const isDownloading =
    downloadState &&
    !["done", "error", "cancelled"].includes(downloadState.phase);

  return (
    <PanelSection title="Download Lua Script">
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
    </PanelSection>
  );
}
