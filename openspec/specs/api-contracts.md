# API Contracts Specification

> **Living document** — updating this is **critical and not optional**. Update when TypeScript types, callable signatures, or events change.
> Last updated: 2026-06-05

## Overview

This document defines the contract between the TypeScript frontend and Python backend, including:
- `callable<>()` signatures for all IPC methods
- TypeScript interfaces for data structures
- Event contracts for real-time communication

## Callable Signatures

```typescript
// Steam
const getSteamPath = callable<[], string>("get_steam_path");
const getAppName = callable<[number], string>("get_app_name");

// Download pipeline
const startDownload = callable<[number, string?, string?], string>("start_download");  // appid, source?, img_url?
const cancelDownload = callable<[string], void>("cancel_download");
const startDownloadFromUrl = callable<[string, number], string>("start_download_from_url");

// Installed apps
const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");
const deleteApp = callable<[number], boolean>("delete_app");
const discoverInstalledApps = callable<[], { success: boolean; discovered?: number; error?: string }>("discover_installed_apps");

// API manifest
const getApiSources = callable<[], ApiSource[]>("get_api_sources");
const refreshApiManifest = callable<[], ApiSource[]>("refresh_api_manifest");

// Settings
const getSettings = callable<[], Settings>("get_settings");
const setSetting = callable<[string, any], void>("set_setting");

// Steam restart
const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

// Game search
const searchGames = callable<[string], GameSearchResult[]>("search_games");

// Auto-update
const checkForUpdates = callable<[], UpdateInfo>("check_for_updates");
const installUpdate = callable<[string], { success: boolean }>("install_update");
```

## TypeScript Interfaces

All defined in `src/shared/types.ts`.

### GameSearchResult
```typescript
interface GameSearchResult {
  id: number;
  name: string;
  img: string;
}
```

### ApiSource
```typescript
interface ApiSource {
  name: string;
  url: string;
}
```

### DownloadProgress
```typescript
interface DownloadProgress {
  task_id: string;
  phase: string;           // "fetching_apis" | "downloading" | "extracting" | "installing" | "done" | "error" | "cancelled"
  percent: number;         // 0-100
  message: string;         // Human-readable
  appid?: number;          // On done: the installed app
  error?: string;          // On error: description
}
```

### InstalledApp
```typescript
interface InstalledApp {
  appid: number;
  name: string;
  img_url?: string;        // Capsule image URL (saved from search/download)
}
```

### DiscoverProgress
```typescript
interface DiscoverProgress {
  step: "scanning" | "processing" | "done" | "error";
  current: number;
  total: number;
  appid?: number;
  app_name?: string;
  img_url?: string;
  message: string;
  error?: string;
}
```

### Settings
```typescript
interface Settings {
  fastDownload: boolean;
  morrenusApiKey: string;
}
```

### UpdateInfo
```typescript
interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string | null;
  release_url: string | null;
  asset_url: string | null;
  checked_at: number | null;
}
```

### UpdateStatus (frontend state wrapper)
```typescript
interface UpdateStatus {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  assetUrl: string | null;
  checkedAt: number | null;
  installing: boolean;
}
```

## Event Contracts

### download_progress

Emitted by backend during download pipeline execution.

```typescript
// Subscribe (frontend)
addEventListener("download_progress", (event: DownloadProgress) => {
  // Update UI based on event.phase, event.percent, event.message
});

// Emit (Python backend)
decky.emit("download_progress", task_id, {
  phase: "downloading",
  percent: 45,
  message: "Downloading from Morrenus..."
});
```

### discover_progress

Emitted by backend during `discover_installed_apps()` scan.

```typescript
// Subscribe (frontend)
addEventListener("discover_progress", (event: DiscoverProgress) => {
  // Update scan progress UI based on event.step, event.current, event.total
});

// Emit (Python backend)
decky.emit("discover_progress", {
  step: "scanning",
  current: 5,
  total: 20,
  message: "Found MyGame.lua"
});
```

### update_available

Emitted by backend's background update checker when a new plugin version is available.

```typescript
// Subscribe (frontend)
addEventListener("update_available", (event: UpdateInfo) => {
  // Notify user about available update
});
```

## Type Definitions File

All TypeScript interfaces are defined in `src/shared/types.ts` and imported where needed.

## Related Specs

- [Backend](./backend.md) — Python modules, IPC methods
- [Frontend](./frontend.md) — React components, IPC consumption
- [Architecture](./architecture.md) — Overall plugin structure
