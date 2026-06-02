import { addEventListener, removeEventListener, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

/**
 * Register a listener for store page download events emitted by the
 * Python StoreInjector backend. The backend manages CDP injection and
 * sends events via decky.emit("stplugin_store_download", appidStr).
 */
export function registerStoreButtonPatch() {
  const listener = addEventListener<[string]>(
    "stplugin_store_download",
    (appidStr) => {
      const appid = parseInt(appidStr, 10);
      if (isNaN(appid)) return;
      startDownload(appid).then(() => {
        toaster.toast({
          title: "STPlugin",
          body: `Downloading Lua for App ${appid}...`,
        });
      }).catch((err: any) => {
        toaster.toast({ title: "Error", body: err?.message || "Download failed" });
      });
    }
  );

  return {
    unpatch: () => {
      removeEventListener("stplugin_store_download", listener);
    },
  };
}
