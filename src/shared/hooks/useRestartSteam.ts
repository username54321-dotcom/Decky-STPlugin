import { useState, useCallback } from "react";
import { callable, toaster } from "@decky/api";

const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

export function useRestartSteam(onComplete?: () => void) {
  const [isRestarting, setIsRestarting] = useState(false);

  const confirmRestart = useCallback(async () => {
    setIsRestarting(true);
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
        onComplete?.();
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setIsRestarting(false);
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setIsRestarting(false);
    }
  }, [onComplete]);

  return { isRestarting, confirmRestart };
}
