# Frontend Specification

> **Living document** — update this when React components, Decky UI patterns, or hooks change.
> Last updated: 2026-06-05

## Overview

The frontend is TypeScript + React, using Decky's `@decky/api` and `@decky/ui` libraries. It runs inside Steam's CEF (Chromium Embedded Framework).

## Plugin Entry (`src/index.tsx`)

```typescript
definePlugin(() => {
  // IPC bindings
  const getSteamPath = callable<[], string>("get_steam_path");
  const getAppName = callable<[number], string>("get_app_name");
  const startDownload = callable<[number, string?], string>("start_download");
  // ... more bindings

  // QAM routes
  routerHook.addRoute("/", MainPanel);
  routerHook.addRoute("/download", DownloadPanel);
  routerHook.addRoute("/installed", InstalledApps);
  routerHook.addRoute("/settings", SettingsPanel);

  // Store page patch
  registerStoreButtonPatch();

  return { name: "STPlugin" };
});
```

## Store Page Patch

Uses `findModuleExport` + `afterPatch` to inject a button into Steam's game page React component:

- Finds the game page component's render function
- Injects `<ButtonItem>` labeled "Add via LuaTools"
- On click: calls `startDownload(appid)`, shows loading spinner
- DLC Detection: Checks app type from component props. If DLC → button disabled with tooltip
- Shows toast on download start / completion

## QAM Panels

### DownloadPanel
- Search input (appid or game name, resolved via `get_app_name`)
- Game name search dropdown (Steam `/search/suggest` proxy with debounced dropdown)
- API source picker dropdown (hidden when `fastDownload` is ON)
- Download button
- Progress section (visible during download):
  - Progress bar (percentage)
  - Phase text ("Downloading...", "Extracting...", "Installing...", "Done")
  - Cancel button
- Post-download restart prompt
- States: idle → downloading → extracting → installing → done / error / cancelled

### InstalledApps
- List fetched via `get_installed_apps()`
- Each entry: app name + appid + [Re-download] + [Delete]
- Delete removes the `.lua` file from `stplug-in/`
- Skeleton loading state

### SettingsPanel
- `<ToggleField>` — fastDownload
- `<TextField>` — morrenusApiKey
- `<ButtonItem>` — "Refresh API Sources" → calls `refresh_api_manifest()`
- `<ButtonItem>` — "Restart Steam" → calls `restart_steam()`

## Shared Components

### PageLayout
- Consistent QAM panel wrapper
- Title, content area, navigation

### RestartButton
- Reusable button for Steam restart
- Shows confirmation dialog
- Calls `restart_steam()` via callable

## Hooks

### useDebouncedSearch
- Debounces search input (300ms default)
- Calls Steam `/search/suggest` proxy
- Returns results array and loading state

### useDownloadLifecycle
- Manages download state machine
- Subscribes to `download_progress` events
- Returns phase, percent, message, error

### useRestartSteam
- Wraps `restart_steam()` callable
- Handles loading state and errors

## Decky UI Patterns

| Component | Use Case |
|-----------|----------|
| `<ToggleField>` | Boolean settings (fastDownload) |
| `<TextField>` | String settings (morrenusApiKey) |
| `<ButtonItem>` | Action buttons (refresh, restart, download) |
| `<PanelSection>` | QAM section grouping |
| `<PanelSectionRow>` | QAM row layout |

## Related Specs

- [Backend](./backend.md) — Python modules, IPC methods
- [API Contracts](./api-contracts.md) — TypeScript types, callable signatures
- [Architecture](./architecture.md) — Overall plugin structure
