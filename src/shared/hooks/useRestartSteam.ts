import { useState, useCallback } from "react";
import { callable, toaster } from "@decky/api";
import type { RestartState } from "../types";

const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

export function useRestartSteam(onComplete?: () => void) {
  const [restartState, setRestartState] = useState<RestartState>("idle");

  const handleRestart = useCallback(async () => {
    if (restartState === "idle") {
      setRestartState("confirming");
      return;
    }

    if (restartState === "confirming") {
      setRestartState("restarting");
      try {
        const result = await restartSteam();
        if (result.success) {
          toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
          onComplete?.();
        } else {
          toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
          setRestartState("idle");
        }
      } catch (err: any) {
        toaster.toast({ title: "Restart Failed", body: String(err) });
        setRestartState("idle");
      }
    }
  }, [restartState, onComplete]);

  const handleCancel = useCallback(() => {
    setRestartState("idle");
  }, []);

  return { restartState, handleRestart, handleCancel };
}
