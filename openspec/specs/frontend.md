# Frontend Specification

> **Living document** — updating this is **critical and not optional**. Update when React components, Decky UI patterns, or hooks change.
> Last updated: 2026-06-07

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

## PlayBar Patch

Uses `routerHook.addPatch` (route patching) + `afterPatch` + `createReactTreePatcher` to inject a script-status icon into Steam's library game detail page:
- Hooks into `/library/app/:appId` route via `routerHook.addPatch`
- Finds the route renderer (`renderFunc`) in the React tree
- Patches `renderFunc` to walk the rendered tree for a component with `appid` prop
- Uses ProtonDB-style `node?.props?.appid != null` fingerprint (immune to function name minification)
- Injects `<ScriptStatusIcon>` component into the matched component's children
- Icon shows green checkmark if Lua script installed, gray download arrow if not
- Click navigates to installed panel (if installed) or download panel with appid pre-filled (if not)
- Installed appids cached in module-level Set, refreshed on download/delete events
- Cleanup via `routerHook.removePatch` in `onDismount`

## Store Page Patch

Uses `findModuleExport` + `afterPatch` to inject a button into Steam's game page React component:

- Finds the game page component's render function
- Injects `<ButtonItem>` labeled "Add via LuaTools"
- On click: calls `startDownload(appid)`, shows loading spinner
- DLC Detection: Checks app type from component props. If DLC → button disabled with tooltip
- Shows toast on download start / completion

## QAM Panels

#### MainPanel (Dashboard)
**File:** `src/MainPanel.tsx`

A status dashboard shown at the root QAM route (`/stplugin`).

**Zones:**
1. **Header** — plugin name, version number, update-available badge (uses `useUpdateStatus` hook)
2. **StatsCard** (`src/main/StatsCard.tsx`) — installed scripts count from `get_installed_apps()` callable. States: loaded count, "No scripts installed" (0), "—" (loading/error)
3. **NavTile** ×3 (`src/main/NavTile.tsx`) — styled navigation tiles with icon, title, description, and `Focusable` gamepad support:
   - Download Lua Script → `/stplugin/download`
   - Installed Scripts → `/stplugin/installed`
   - Settings → `/stplugin/settings`
4. **Footer** — `RestartButton` component, separated by divider

**Dependencies:** `useUpdateStatus`, `callable("get_installed_apps")`, `RestartButton`, `Focusable`, `Navigation`

### DownloadPanel
- Search input (appid or game name, resolved via `get_app_name`)
- Game name search dropdown (Steam `/search/suggest` proxy with debounced dropdown, shows "Installed" badge for already-installed apps)
- API source picker dropdown (hidden when `fastDownload` is ON)
- Download button
- Opens `DownloadModal` via `showModal()` on start
- States: idle only (modal handles progress/error/success)

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

### DownloadModal
- Modal for downloading an app (opened from DownloadPanel or PlayBar)
- Auto-starts download on mount via `useDownloadLifecycle` with `suppressToasts=true`
- Three states: progress (`ProgressBarWithInfo`), success (checkmark + Restart/Close), error (retry + Close)
- Auto-closes on cancel, shows Restart Steam button on completion

### RedownloadModal
- Modal for re-downloading an installed app
- Auto-starts download on mount via `useDownloadLifecycle`
- Three states: progress (ProgressBarWithInfo), success (checkmark + Restart/Close), error (retry + Close)
- Auto-closes on cancel, shows Restart Steam button on completion

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
- Accepts optional `suppressToasts?: boolean` parameter (when true, suppresses success/error toasts for modal usage)

### useRestartSteam
- Wraps `restart_steam()` callable
- Handles loading state and errors

## Decky UI Patterns

| Component | Use Case |
|-----------|----------|
| `<ToggleField>` | Boolean settings (fastDownload) |
| `<TextField>` | String settings (morrenusApiKey) |
| `<ButtonItem>` | Action buttons (refresh, restart, download) |
| `<DropdownItem>` | Dropdown selectors (API source picker) |
| `<PanelSection>` | QAM section grouping |
| `<PanelSectionRow>` | QAM row layout |
| `<ModalRoot>` + `<DialogHeader>` + `<DialogBody>` + `<DialogFooter>` | Custom modals |
| `<DialogButton>` / `<DialogButtonPrimary>` | Modal action buttons (secondary/primary) |
| `<ConfirmModal>` | Simple confirmation dialogs |
| `<ProgressBarWithInfo>` / `<ProgressBar>` | Download progress display |
| `<Spinner>` | Loading indicator |
| `<Focusable>` | **Only for raw HTML interactive elements** (wraps `<button>`, clickable `<div>`, custom controls that lack Decky-native components) |
| `<Navigation>` | QAM route navigation |
| `showModal()` | Modal opener function |
| `staticClasses` | Steam CSS class objects for custom element styling |

### Focusable Rules

- **Do** wrap raw HTML interactive elements (`<button>`, clickable `<div>`, custom input) in `<Focusable>` with `onActivate` handler and `flow-children` layout prop
- **Do NOT** wrap Decky-native components (`ButtonItem`, `ToggleField`, etc.) in Focusable — they are already focus-managed
- **Do NOT** wrap decorative/presentational elements (static text, images, icons, layout containers) in Focusable
- Use `flow-children="column"` for vertical stacking of Focusable children
- `onCancel` callback handles B button press; `onActivate` handles A button press

### Steam CSS Classes

Import typed CSS class objects from `@decky/ui` for consistent styling when building custom elements:

```tsx
import { staticClasses, quickAccessMenuClasses, gamepadDialogClasses, focusRingClasses } from "@decky/ui";

// Applies Steam's green focus animation class
<div className={quickAccessMenuClasses["ItemFocusAnim-green"]}>...</div>
```

## Related Specs

- [Backend](./backend.md) — Python modules, IPC methods
- [API Contracts](./api-contracts.md) — TypeScript types, callable signatures
- [Architecture](./architecture.md) — Overall plugin structure
