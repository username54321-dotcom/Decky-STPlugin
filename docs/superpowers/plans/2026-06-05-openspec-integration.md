# OpenSpec Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create OpenSpec living specification structure and migrate scattered specs into focused component docs.

**Architecture:** Create `openspec/` directory with 4 component specs distilled from existing 20 spec files. Update AGENTS.md to reference new structure. Archive old specs.

**Tech Stack:** Markdown, file system operations

---

## File Structure

```
Decky-STPlugin/
├── openspec/                          ← CREATE
│   ├── project.md                     ← CREATE
│   ├── specs/                         ← CREATE
│   │   ├── architecture.md            ← CREATE
│   │   ├── backend.md                 ← CREATE
│   │   ├── frontend.md                ← CREATE
│   │   └── api-contracts.md           ← CREATE
│   ├── changes/                       ← CREATE (empty)
│   └── archive/                       ← CREATE (empty)
├── AGENTS.md                          ← MODIFY
└── docs/superpowers/specs/            ← MOVE files to archive/
```

---

### Task 1: Create OpenSpec Directory Structure

**Files:**
- Create: `openspec/` (directory)
- Create: `openspec/specs/` (directory)
- Create: `openspec/changes/` (directory)
- Create: `openspec/archive/` (directory)

- [ ] **Step 1: Create openspec directory**

```bash
mkdir -p openspec/specs openspec/changes openspec/archive
```

- [ ] **Step 2: Verify directories exist**

```bash
ls -la openspec/
```

Expected output:
```
total 0
drwxr-xr-x  5 user  group  160 Jun  5 10:00 .
drwxr-xr-x 12 user  group  384 Jun  5 10:00 ..
drwxr-xr-x  2 user  group   64 Jun  5 10:00 archive
drwxr-xr-x  2 user  group   64 Jun  5 10:00 changes
drwxr-xr-x  2 user  group   64 Jun  5 10:00 specs
```

- [ ] **Step 3: Commit**

```bash
git add openspec/
git commit -m "chore: create openspec directory structure"
```

---

### Task 2: Create `openspec/project.md`

**Files:**
- Create: `openspec/project.md`
- Reference: `AGENTS.md`, `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md`

- [ ] **Step 1: Read source files for content**

Read `AGENTS.md` sections: Project Objective, Target Platform, Feature Scope, Key Differences
Read `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` sections: 1, 2

- [ ] **Step 2: Create openspec/project.md**

```markdown
# Decky-STPlugin

> **Living document** — update this when project conventions, scope, or platform rules change.
> Last updated: 2026-06-05

## Objective

Port **LTSteamPlugin** (a Millennium desktop Steam plugin) to **Decky Loader** (Steam Deck plugin framework).

## Target Platform

**Primary: Windows Decky Loader**

### Windows-First Principles
- Steam path detection: Try Windows registry (`HKCU\Software\Valve\Steam\SteamPath`) first, fall back to env vars or known paths
- File paths: Use `pathlib.Path` exclusively — never hardcode `/` or `\`
- Process management: Windows `.cmd` scripts acceptable; Linux alternatives as fallback only
- Registry: Only for Steam path detection; no other registry dependencies

## Feature Scope

| Status | Features |
|--------|----------|
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection, game name search (Steam suggest proxy + dropdown UI), Steam restart button (main menu + post-download prompt) |
| ❌ **DROP** | Game fixes system, 11 themes, 31 locales (English only), SteamDB browser extension, key donation, games database, playable warning |
| ⏸️ **DEFER** | In-plugin update check (GitHub), non-English locales, additional settings |

## Key Differences: Millennium → Decky

| Concern | Millennium | Decky |
|---------|-----------|-------|
| Frontend | Vanilla JS IIFE | TypeScript + React (TSX) |
| UI injection | `document.querySelector` + DOM | React module patching (`afterPatch`, `createReactTreePatcher`) |
| Backend IPC | `Millennium.callServerMethod()` | `callable()` (TS) / async methods on Plugin class (Python) |
| Events | `PluginUtils.Logger` bridge | `decky.emit()` → `addEventListener()` |
| Settings | Custom JSON persistence | `decky.DECKY_PLUGIN_SETTINGS_DIR` |
| Logging | Custom Logger singleton | `decky.logger` |
| Bundler | None (raw JS) | Rollup via `@decky/rollup` |
| Package manager | None | `pnpm` |

## Conventions

- All new code uses Decky conventions (`@decky/api`, `@decky/ui`, Python `Plugin` class with `async` methods, `decky` module)
- No direct DOM manipulation in GamepadUI — use Decky's module patching
- YAGNI — only port features in the KEEP list
- English hardcoded strings only (no i18n)
```

- [ ] **Step 3: Verify file created**

```bash
wc -l openspec/project.md
```

Expected: ~60 lines

- [ ] **Step 4: Commit**

```bash
git add openspec/project.md
git commit -m "docs: create openspec/project.md with project overview"
```

---

### Task 3: Create `openspec/specs/architecture.md`

**Files:**
- Create: `openspec/specs/architecture.md`
- Reference: `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` (sections 1-3)

- [ ] **Step 1: Read source file**

Read `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` sections 1-3 (Objective, Scope, Architecture)

- [ ] **Step 2: Create openspec/specs/architecture.md**

```markdown
# Architecture Specification

> **Living document** — update this when file structure, component relationships, or data flow change.
> Last updated: 2026-06-05

## Overview

The plugin has three layers:
- **Frontend** (TypeScript/React) — QAM panels, store page button, IPC consumption
- **Backend** (Python) — Plugin class, download pipeline, API manifest, Steam paths
- **IPC** (callable) — TypeScript `callable<>()` ↔ Python `async` methods

## File Structure

```
Decky-STPlugin/
├── src/                           # TypeScript/React frontend
│   ├── index.tsx                  # definePlugin() entry + QAM router + IPC bindings
│   ├── DownloadPanel.tsx          # QAM download panel
│   ├── DownloadForm.tsx           # Download form with search
│   ├── InstalledApps.tsx          # QAM installed apps panel
│   ├── SettingsPanel.tsx          # QAM settings panel
│   ├── download/
│   │   ├── components/
│   │   │   ├── DownloadProgress.tsx
│   │   │   ├── GameSearchDropdown.tsx
│   │   │   └── PostDownloadRestart.tsx
│   │   └── hooks/
│   │       ├── useDebouncedSearch.ts
│   │       └── useDownloadLifecycle.ts
│   ├── installed/
│   │   └── components/
│   │       ├── InstalledAppCard.tsx
│   │       └── SkeletonCard.tsx
│   └── shared/
│       ├── types.ts               # TypeScript interfaces
│       ├── styles.ts              # Shared styles
│       ├── constants.ts           # Constants
│       ├── components/
│       │   ├── PageLayout.tsx
│       │   └── RestartButton.tsx
│       └── hooks/
│           └── useRestartSteam.ts
├── backend/                       # Python modules
│   ├── downloads.py               # Download pipeline
│   ├── api_manifest.py            # API source management
│   └── steam_paths.py             # Steam directory resolution
├── main.py                        # Plugin class — all backend RPC methods
├── plugin.json                    # Decky manifest
├── package.json                   # pnpm + @decky deps
├── tsconfig.json                  # TypeScript config
└── rollup.config.js               # @decky/rollup preset
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEAM CLIENT (CEF)                            │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  Store Page Patch     │    │  Quick Access Menu (QAM)     │   │
│  │  (React tree patch)   │    │                              │   │
│  │  "Add via LuaTools"   │    │  Download / Installed /      │   │
│  │  button on game page  │    │  Settings panels             │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  ═══════════════════ IPC (callable) ═══════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  main.py — Python Plugin class (RPC router)               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ downloads.py │  │ api_manifest │  │ steam_paths.py  │   │   │
│  │  │              │  │   .py        │  │                 │   │   │
│  │  │ Download     │  │ Fetch JSON   │  │ Registry → env  │   │   │
│  │  │ pipeline     │  │ Normalize    │  │ → known paths   │   │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Download Flow
1. Frontend calls `startDownload(appid)` via `callable<>()`
2. Backend creates task, returns `task_id`
3. Backend runs pipeline: resolve name → download → validate → extract → install → track
4. Backend emits `download_progress` events at each phase
5. Frontend updates UI based on events

### Progress Events
```typescript
interface DownloadProgress {
  task_id: string;
  phase: "fetching_apis" | "downloading" | "extracting" | "installing" | "done" | "error" | "cancelled";
  percent: number;  // 0-100
  message: string;
  appid?: number;
  error?: string;
}
```

## Testing Strategy

| Layer | Approach |
|-------|----------|
| Backend unit | Mock HTTP, mock registry/env, mock GitHub |
| Backend integration | Real small app, verify `.lua` written to temp dir |
| Frontend | Manual testing on Windows Decky (Steam's CEF runtime required) |
| E2E | Manual: store → button → download → QAM → verify |
```

- [ ] **Step 3: Verify file created**

```bash
wc -l openspec/specs/architecture.md
```

Expected: ~100 lines

- [ ] **Step 4: Commit**

```bash
git add openspec/specs/architecture.md
git commit -m "docs: create openspec/specs/architecture.md"
```

---

### Task 4: Create `openspec/specs/backend.md`

**Files:**
- Create: `openspec/specs/backend.md`
- Reference: `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` (sections 4, 6, 7)

- [ ] **Step 1: Read source file**

Read `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` sections 4, 6, 7

- [ ] **Step 2: Create openspec/specs/backend.md**

```markdown
# Backend Specification

> **Living document** — update this when backend architecture, IPC methods, or Python modules change.
> Last updated: 2026-06-05

## Overview

The backend is a Python `Plugin` class in `main.py` that delegates to three modules:
- `backend/downloads.py` — Lua download pipeline
- `backend/api_manifest.py` — API source management
- `backend/steam_paths.py` — Steam directory resolution

All methods are `async` and exposed to TypeScript via `callable<>()`.

## Plugin Class (`main.py`)

```python
class Plugin:
    # Steam
    async def get_steam_path(self) -> str
    async def get_app_name(self, appid: int) -> str

    # Download pipeline
    async def start_download(self, appid: int, api_source: str = None) -> str  # returns task_id
    async def get_download_status(self, task_id: str) -> dict
    async def cancel_download(self, task_id: str) -> None
    async def start_download_from_url(self, url: str, appid: int) -> str

    # Installed apps
    async def get_installed_apps(self) -> list[dict]
    async def delete_app(self, appid: int) -> bool
    async def discover_installed_apps(self) -> dict

    # API manifest
    async def get_api_sources(self) -> list[dict]
    async def refresh_api_manifest(self) -> list[dict]

    # Settings
    async def get_settings(self) -> dict
    async def set_setting(self, key: str, value: any) -> None

    # Steam restart
    async def restart_steam(self) -> dict

    # Game search
    async def search_games(self, query: str) -> list[dict]

    # Auto-update
    async def check_for_updates(self) -> dict
    async def install_update(self, asset_url: str) -> dict
```

**Rule:** No business logic in this file — pure delegation to backend modules.

## IPC Methods

| Method | Args | Returns | Notes |
|--------|------|---------|-------|
| `get_steam_path` | — | `str` | Cached after first call |
| `get_app_name` | `appid: int` | `str` | Cache → Steam applist → Steam Store API (300ms rate limit) |
| `start_download` | `appid: int, source?: str, img_url?: str` | `task_id: str` | Progress via events; img_url for capsule display |
| `cancel_download` | `task_id: str` | `void` | Cooperative cancel |
| `start_download_from_url` | `url: str, appid: int` | `task_id: str` | Same pipeline, custom URL |
| `get_installed_apps` | — | `InstalledApp[]` | Reads `loadedappids.txt`, resolves names for uncached |
| `delete_app` | `appid: int` | `bool` | Removes `.lua` file from `stplug-in/` |
| `discover_installed_apps` | — | `dict` | Scans `stplug-in/` for `.lua` files, resolves names/images, emits `discover_progress` events |
| `search_games` | `query: str` | `GameSearchResult[]` | Proxies Steam `/search/suggest` API |
| `get_api_sources` | — | `ApiSource[]` | Cached manifest, filtered by API key |
| `refresh_api_manifest` | — | `ApiSource[]` | Re-fetches + caches |
| `get_settings` | — | `Settings` | Reads JSON |
| `set_setting` | `key: str, value: any` | `void` | Type-validated |
| `restart_steam` | — | `dict` | Returns `{"success": bool, "error?": str}`; platform-specific process restart |
| `check_for_updates` | — | `dict` | Checks GitHub for newer plugin version |
| `install_update` | `asset_url: str` | `dict` | Downloads and applies plugin update |

## Download Pipeline (`backend/downloads.py`)

### Functions

| Function | Description |
|----------|-------------|
| `resolve_app_name(appid)` | Cache → Steam applist → Steam Store API (300ms rate limit between API calls) |
| `download_lua(appid, api_source?)` | Tries 4 API sources in order: Morrenus, Ryuu, TwentyTwo Cloud, Sushi. Uses `httpx` with timeout. |
| `validate_and_extract(zip_data)` | Magic byte check on zip, comments out `setManifestid()` calls in Lua, extracts manifest files to `depotcache/` |
| `install_lua(appid, lua_content, steam_path)` | Writes `.lua` file to `{steam_path}/config/stplug-in/{appid}.lua` |
| `track_installed(appid)` | Appends appid to `loadedappids.txt` |

### Progress Reporting

Each phase emits `decky.emit("download_progress", task_id, status)` with phase, percent, and message.

### Cancellation

Cooperative — uses `threading.Event` checked between pipeline phases. Partial files cleaned up on cancel.

## API Manifest (`backend/api_manifest.py`)

| Function | Description |
|----------|-------------|
| `fetch_manifest()` | GET from `raw.githubusercontent.com/madoiscool/lt_api_links` with Vercel proxy fallback |
| `normalize_json(text)` | Fix trailing commas, missing braces in malformed JSON |
| `filter_enabled(sources, api_key?)` | Remove disabled sources, hide Morrenus if no API key configured |
| `get_cached()` | Return in-memory cached manifest |

## Steam Paths (`backend/steam_paths.py`)

| Function | Description |
|----------|-------------|
| `get_steam_path()` | 1. Windows registry (`HKCU\Software\Valve\Steam\SteamPath`) → 2. `STEAM_PATH` env var → 3. Known paths |
| `get_lua_dir(steam_path)` | Returns `{steam_path}/config/stplug-in/` |
| `get_loaded_apps_file(steam_path)` | Returns path to `loadedappids.txt` |

All paths use `pathlib.Path` — platform-agnostic.

## Settings

Stored as JSON in `decky.DECKY_PLUGIN_SETTINGS_DIR / "settings.json"`:

```json
{
  "fastDownload": false,
  "morrenusApiKey": ""
}
```

- `fastDownload`: boolean — when ON, skips API source picker and auto-selects first working source
- `morrenusApiKey`: string — optional API key for the Morrenus source
- Validation: type checks only (bool for toggle, string for key)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No internet | `httpx.ConnectError` → phase="error", message="No internet connection" |
| All 4 APIs fail | Try all sources in order → if all fail: "All download sources unavailable" |
| Corrupt zip | Magic byte check fails → "Downloaded file is corrupt" |
| Steam path not found | All detection methods fail → "Could not find Steam installation" |
| Disk full / permission denied | `OSError`/`PermissionError` → OS-level message |
| Invalid appid | Non-numeric / negative → error immediately |
| Settings wrong type | Rejected by `set_setting`, value not saved |
| API manifest parse fail | Normalize fails → fallback to cached → fallback to hardcoded defaults |

## Related Specs

- [Frontend](./frontend.md) — React components, IPC consumption
- [API Contracts](./api-contracts.md) — TypeScript types, callable signatures
- [Architecture](./architecture.md) — Overall plugin structure
```

- [ ] **Step 3: Verify file created**

```bash
wc -l openspec/specs/backend.md
```

Expected: ~140 lines

- [ ] **Step 4: Commit**

```bash
git add openspec/specs/backend.md
git commit -m "docs: create openspec/specs/backend.md"
```

---

### Task 5: Create `openspec/specs/frontend.md`

**Files:**
- Create: `openspec/specs/frontend.md`
- Reference: `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` (section 5), `src/` directory

- [ ] **Step 1: Read source files**

Read `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` section 5
Read `src/index.tsx` for current structure
Read `src/shared/types.ts` for type definitions

- [ ] **Step 2: Create openspec/specs/frontend.md**

```markdown
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
```

- [ ] **Step 3: Verify file created**

```bash
wc -l openspec/specs/frontend.md
```

Expected: ~120 lines

- [ ] **Step 4: Commit**

```bash
git add openspec/specs/frontend.md
git commit -m "docs: create openspec/specs/frontend.md"
```

---

### Task 6: Create `openspec/specs/api-contracts.md`

**Files:**
- Create: `openspec/specs/api-contracts.md`
- Reference: `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` (section 6.4), `src/shared/types.ts`

- [ ] **Step 1: Read source files**

Read `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` section 6.4
Read `src/shared/types.ts` for current type definitions

- [ ] **Step 2: Create openspec/specs/api-contracts.md`

```markdown
# API Contracts Specification

> **Living document** — update this when TypeScript types, callable signatures, or events change.
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
```

- [ ] **Step 3: Verify file created**

```bash
wc -l openspec/specs/api-contracts.md
```

Expected: ~140 lines

- [ ] **Step 4: Commit**

```bash
git add openspec/specs/api-contracts.md
git commit -m "docs: create openspec/specs/api-contracts.md"
```

---

### Task 7: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Read current AGENTS.md**

Read `AGENTS.md` to understand current structure

- [ ] **Step 2: Replace "Key Reference Files" section**

Find and replace the "Key Reference Files" section:

**Old:**
```markdown
## Key Reference Files

Before making any code change or design decision, read these:

| Priority | File | Purpose |
|----------|------|---------|
| 🔴 **Always** | `./ltsteamplugin/project_analysis.md` | Complete analysis of the Millennium plugin — architecture, backends, frontend, data flows, external APIs, technical debt |
| 🔴 **Always** | `docs/references/decky-loader-plugin-development.md` | Decky development reference — file structure, APIs, components, lifecycle, communication, gotchas |
| 🔴 **Always** | `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` | Approved design spec — feature scope, architecture, IPC contract, exclusions |
| 🟡 **When unsure** | `./ltsteamplugin/backend/downloads.py` | Millennium download pipeline source (key reference for porting logic) |
| 🟡 **When unsure** | `./ltsteamplugin/backend/api_manifest.py` | Millennium API manifest source (~100 lines) |
```

**New:**
```markdown
## Key Reference Files

Before making any code change or design decision, read these:

| Priority | File | Purpose |
|----------|------|---------|
| 🔴 **Always** | `openspec/project.md` | Project overview, conventions, scope |
| 🔴 **Always** | `openspec/specs/architecture.md` | Overall plugin structure, file layout |
| 🔴 **Always** | `openspec/specs/backend.md` | Python modules, IPC methods, error handling |
| 🔴 **Always** | `openspec/specs/frontend.md` | React patterns, Decky UI components |
| 🔴 **Always** | `openspec/specs/api-contracts.md` | TypeScript types, callable signatures |
| 🟡 **When unsure** | `docs/references/decky-loader-plugin-development.md` | Decky API reference |
| 🟡 **When unsure** | `./ltsteamplugin/project_analysis.md` | Millennium source analysis |
```

- [ ] **Step 3: Add "OpenSpec Integration" section**

Add after "Key Reference Files" section:

```markdown
## OpenSpec Integration

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for living specifications.

### Living Specs (Source of Truth)
- `openspec/project.md` — Project overview, conventions, scope
- `openspec/specs/` — Component specifications (architecture, backend, frontend, api-contracts)

### Workflow
1. Read `openspec/specs/*.md` for context before any code change
2. Use superpowers brainstorming skill for design exploration
3. Use superpowers writing-plans skill for implementation planning
4. After implementation, update `openspec/specs/*.md` if architecture changed

### When to Update Living Specs
- Project conventions or scope change → update `project.md`
- New IPC method → update `backend.md`
- New React component → update `frontend.md`
- New TypeScript type → update `api-contracts.md`
- File structure changes → update `architecture.md`
```

- [ ] **Step 4: Update "Project Structure" section**

Update the file tree to include `openspec/`:

```
Decky-STPlugin/
├── openspec/                  # Living specifications
│   ├── project.md
│   ├── specs/
│   │   ├── architecture.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   └── api-contracts.md
│   ├── changes/
│   └── archive/
├── src/
│   ├── index.tsx
│   ... (rest of structure)
├── docs/
│   ├── references/
│   │   └── decky-loader-plugin-development.md
│   └── superpowers/
│       ├── specs/
│       └── plans/
└── ... (rest of structure)
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with OpenSpec integration"
```

---

### Task 8: Archive Old Specs

**Files:**
- Create: `docs/superpowers/specs/archive/` (directory)
- Move: All 21 spec files from `docs/superpowers/specs/` to `docs/superpowers/specs/archive/`

- [ ] **Step 1: Create archive directory**

```bash
mkdir -p docs/superpowers/specs/archive
```

- [ ] **Step 2: Move old specs to archive**

```bash
# Move ALL superpowers specs (including this integration design spec) to archive.
# The living specs in openspec/ replace them as source of truth.
mv docs/superpowers/specs/2026-06-*.md docs/superpowers/specs/archive/
```

- [ ] **Step 3: Verify archive contains files**

```bash
ls docs/superpowers/specs/archive/
```

Expected: All 21 spec files (20 old + this openspec design spec)

- [ ] **Step 4: Verify specs directory is clean**

```bash
ls docs/superpowers/specs/
```

Expected: Only `archive/` directory remains

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/
git commit -m "chore: archive old superpowers specs to docs/superpowers/specs/archive/"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Verify OpenSpec structure**

```bash
find openspec -type f -name "*.md" | sort
```

Expected:
```
openspec/project.md
openspec/specs/api-contracts.md
openspec/specs/architecture.md
openspec/specs/backend.md
openspec/specs/frontend.md
```

- [ ] **Step 2: Verify line counts**

```bash
wc -l openspec/project.md openspec/specs/*.md
```

Expected: ~620 total lines (vs previous 3,555 lines)

- [ ] **Step 3: Verify AGENTS.md updated**

```bash
grep -A 10 "## Key Reference Files" AGENTS.md
```

Expected: References to `openspec/` files

- [ ] **Step 4: Verify old specs archived**

```bash
ls docs/superpowers/specs/archive/ | wc -l
```

Expected: 21 files

- [ ] **Step 5: Run any existing tests**

```bash
npm test
```

Expected: All tests pass (no code changes, only docs)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs: complete OpenSpec integration - living specs created, old specs archived"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create directory structure | `openspec/`, `openspec/specs/`, `openspec/changes/`, `openspec/archive/` |
| 2 | Create project.md | `openspec/project.md` |
| 3 | Create architecture.md | `openspec/specs/architecture.md` |
| 4 | Create backend.md | `openspec/specs/backend.md` |
| 5 | Create frontend.md | `openspec/specs/frontend.md` |
| 6 | Create api-contracts.md | `openspec/specs/api-contracts.md` |
| 7 | Update AGENTS.md | `AGENTS.md` |
| 8 | Archive old specs | `docs/superpowers/specs/archive/` |
| 9 | Final verification | All files |

**Total files created:** 5
**Total files modified:** 1 (AGENTS.md)
**Total files archived:** 21
