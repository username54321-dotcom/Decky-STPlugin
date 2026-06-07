import { useState, useEffect, useCallback } from "react";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import type { UpdateInfo, UpdateStatus } from "../../shared/types";

const checkForUpdates = callable<[], UpdateInfo | { error: string }>("check_for_updates");
const installUpdate = callable<[string], { success: boolean }>("install_update");
const getPluginVersion = callable<[], string>("get_plugin_version");

export function useUpdateStatus() {
    const [status, setStatus] = useState<UpdateStatus>({
        available: false,
        currentVersion: "0.1.0",
        latestVersion: null,
        releaseUrl: null,
        assetUrl: null,
        checkedAt: null,
        installing: false,
    });

    useEffect(() => {
        getPluginVersion()
            .then(version => {
                setStatus(prev => ({ ...prev, currentVersion: version }));
            })
            .catch(() => {
                // Silently keep the hardcoded fallback
            });
    }, []);

    useEffect(() => {
        const handleUpdateAvailable = (info: {
            current_version: string;
            latest_version: string;
            release_url: string;
            asset_url: string;
            checked_at?: number;
        }) => {
            setStatus(prev => ({
                ...prev,
                available: true,
                currentVersion: info.current_version,
                latestVersion: info.latest_version,
                releaseUrl: info.release_url,
                assetUrl: info.asset_url,
                checkedAt: info.checked_at ?? prev.checkedAt,
            }));
            toaster.toast({
                title: "STPlugin",
                body: `Update v${info.latest_version} available — Open plugin to install`,
            });
        };

        const handleUpdateInstalled = () => {
            setStatus(prev => ({
                ...prev,
                available: false,
                installing: false,
            }));
            toaster.toast({
                title: "STPlugin",
                body: "Update installed! Restart Steam to apply.",
            });
        };

        const unlistenAvailable = addEventListener<[{ current_version: string; latest_version: string; release_url: string; asset_url: string; checked_at?: number }]>(
            "update_available",
            handleUpdateAvailable
        );
        const unlistenInstalled = addEventListener<[]>(
            "update_installed",
            handleUpdateInstalled
        );

        return () => {
            removeEventListener("update_available", unlistenAvailable);
            removeEventListener("update_installed", unlistenInstalled);
        };
    }, []);

    const checkUpdate = useCallback(async () => {
        try {
            const result = await checkForUpdates();
            if ("error" in result) {
                toaster.toast({ title: "Update Check Failed", body: result.error });
                return;
            }

            setStatus(prev => ({
                ...prev,
                available: result.available,
                currentVersion: result.current_version,
                latestVersion: result.latest_version,
                releaseUrl: result.release_url,
                assetUrl: result.asset_url,
                checkedAt: result.checked_at,
            }));

            if (!result.available) {
                toaster.toast({ title: "STPlugin", body: "You're up to date!" });
            }
        } catch (err) {
            toaster.toast({ title: "Update Check Failed", body: String(err) });
        }
    }, []);

    const install = useCallback(async (): Promise<boolean> => {
        if (!status.assetUrl) return false;

        setStatus(prev => ({ ...prev, installing: true }));
        try {
            const result = await installUpdate(status.assetUrl);
            if (result.success) {
                setStatus(prev => ({
                    ...prev,
                    available: false,
                    installing: false,
                }));
                return true;
            } else {
                toaster.toast({ title: "Installation Failed", body: "Try manual install." });
                setStatus(prev => ({ ...prev, installing: false }));
                return false;
            }
        } catch (err) {
            toaster.toast({ title: "Installation Failed", body: String(err) });
            setStatus(prev => ({ ...prev, installing: false }));
            return false;
        }
    }, [status.assetUrl]);

    return { status, checkUpdate, install };
}
