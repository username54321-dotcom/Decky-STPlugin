import { useState, useEffect, useCallback, useRef } from "react";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import type { DownloadProgress } from "../../shared/types";

const startDownload = callable<[number, string?, string?], string>("start_download");
const cancelDownload = callable<[string], void>("cancel_download");

export function useDownloadLifecycle(onComplete: () => void, suppressToasts?: boolean) {
  const [state, setState] = useState<DownloadProgress | null>(null);
  const [isActive, setIsActive] = useState(false);
  const currentTaskIdRef = useRef<string>("");

  useEffect(() => {
    const handleProgress = (taskId: string, progress: DownloadProgress) => {
      if (taskId !== currentTaskIdRef.current) return;

      setState(progress);

      if (progress.phase === "done") {
        setIsActive(false);
        if (!suppressToasts) {
          toaster.toast({
            title: "STPlugin",
            body: `Installed Lua for App ${progress.appid}`,
          });
        }
        onComplete();
      } else if (progress.phase === "error") {
        setIsActive(false);
        if (!suppressToasts) {
          toaster.toast({
            title: "Download Failed",
            body: progress.message || "Unknown error",
          });
        }
      } else if (progress.phase === "cancelled") {
        setIsActive(false);
      }
    };

    const unlisten = addEventListener<[string, DownloadProgress]>(
      "download_progress",
      handleProgress
    );

    return () => {
      removeEventListener("download_progress", unlisten);
    };
  }, [currentTaskIdRef.current, onComplete]);

  const start = useCallback(async (appid: number, source?: string, imgUrl?: string) => {
    const taskId = await startDownload(appid, source, imgUrl);
    currentTaskIdRef.current = taskId;
    setIsActive(true);
    setState({
      task_id: taskId,
      phase: "fetching_apis",
      percent: 0,
      message: "Starting...",
    });
  }, []);

  const cancel = useCallback(async () => {
    if (currentTaskIdRef.current) {
      await cancelDownload(currentTaskIdRef.current);
      setIsActive(false);
      setState({
        task_id: currentTaskIdRef.current,
        phase: "cancelled",
        percent: 0,
        message: "Cancelled",
      });
      currentTaskIdRef.current = "";
    }
  }, []);

  return { isActive, state, start, cancel };
}
