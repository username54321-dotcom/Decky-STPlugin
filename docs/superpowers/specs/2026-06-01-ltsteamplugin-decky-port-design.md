# Design Spec: LTSteamPlugin → Decky STPlugin Port

**Date:** 2026-06-01
**Status:** Approved
**Approach:** A — Lean Core

## 1. Objective

Port the core functionality of LTSteamPlugin (a Millennium desktop Steam plugin) to Decky Loader, targeting **Windows Decky Loader** as the primary platform. The port focuses on Lua script download/installation and a store page button trigger.

## 2. Scope

### 2.1 Feature Triage

| Status | Features |
|--------|----------|
| ✅ **KEEP** | Lua download pipeline (4 API sources), store page button injection (React patch), QAM management panel, API manifest management, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection |
| ❌ **DROP** | Game fixes system (entirely), 11 themes, 31 locales (English hardcoded only), SteamDB browser extension, key donation, games database (playability pills), playable warning |
| ⏸️ **DEFER** | In-plugin update check (GitHub), non-English locales, additional settings |

### 2.2 Target Platform

**Windows Decky Loader** — the plugin shall run on a Windows build of Decky Loader.

**Windows-First Principle:**
- Steam path detection: try Windows registry first, fall back to environment variables / known paths
- File paths: use `pathlib.Path` exclusively — never hardcode `/` or `\`
- `_root` flag: test without it first (Steam is usually user-writable on Windows)
- Registry: only used for Steam path detection; no other registry dependencies

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEAM CLIENT (CEF)                            │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  Store Page Patch     │    │  Quick Access Menu (QAM)     │   │
│  │  (React tree patch)   │    │                              │   │
│  │                       │    │  Installed Apps / Manage     │   │
│  │  "Add via LuaTools"   │    │  Settings Panel              │   │
│  │  button on game page  │    │  Download Panel (search +    │   │
│  │                       │    │    trigger + progress)       │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  ═══════════════════ IPC (local socket, callable) ═════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  main.py — Python Plugin class (RPC router, ~80 lines)    │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ downloads.py │  │ api_manifest │  │ steam_paths.py  │   │   │
│  │  │ (~150 lines) │  │   .py        │  │ (~40 lines)    │   │   │
│  │  │              │  │ (~60 lines)  │  │                 │   │   │
│  │  │ Download     │  │ Fetch JSON   │  │ Registry → env  │   │   │
│  │  │ pipeline     │  │ Normalize    │  │ → known paths   │   │   │
│  │  │ Validate     │  │ Filter       │  │ pathlib.Path    │   │   │
│  │  │ Extract      │  │ Cache        │  │                 │   │   │
│  │  │ Install      │  │              │  │                 │   │   │
│  │  │ Track        │  │              │  │                 │   │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  External: GitHub (manifest) + 4 Lua API sources + Steam Store   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 File Structure

```
Decky-STPlugin/
├── src/                    # TypeScript/React frontend (~500 lines)
│   ├── index.tsx           # definePlugin() entry + QAM router + IPC bindings
│   ├── patches/
│   │   └── storeButton.tsx # React tree patch: game page button
│   └── components/
│       ├── DownloadPanel.tsx
│       ├── InstalledApps.tsx
│       └── SettingsPanel.tsx
├── backend/                # Python modules (~250 lines)
│   ├── downloads.py        # Download pipeline
│   ├── api_manifest.py     # API source management
│   └── steam_paths.py      # Steam directory resolution
├── main.py                 # Plugin class — RPC router (~80 lines)
├── plugin.json             # Decky manifest
├── package.json            # pnpm + @decky deps
├── tsconfig.json
└── rollup.config.js
```

**Total:** ~12 files, ~980 lines (vs Millennium: 18 files, ~12,600 lines).

## 4. Backend Components

### 4.1 `main.py` — Plugin Class

All methods are `async` and become callable from TypeScript via `callable<>()`.

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

    # API manifest
    async def get_api_sources(self) -> list[dict]
    async def refresh_api_manifest(self) -> list[dict]

    # Settings
    async def get_settings(self) -> dict
    async def set_setting(self, key: str, value: any) -> None
```

No business logic in this file — pure delegation to backend modules. Settings read/write uses `decky.DECKY_PLUGIN_SETTINGS_DIR / "settings.json"`.

### 4.2 `backend/downloads.py`

Ported and trimmed from Millennium's 1200-line `downloads.py`. Keeps:

| Function | Description |
|----------|-------------|
| `resolve_app_name(appid)` | Cache → Steam applist → Steam Store API (300ms rate limit between API calls) |
| `download_lua(appid, api_source?)` | Tries 4 API sources in order (Morrenus, Ryuu, TwentyTwo Cloud, Sushi). Uses `httpx` with timeout. |
| `validate_and_extract(zip_data)` | Magic byte check on zip, comments out `setManifestid()` calls in Lua, extracts manifest files to `depotcache/` |
| `install_lua(appid, lua_content, steam_path)` | Writes `.lua` file to `{steam_path}/config/stplug-in/{appid}.lua` |
| `track_installed(appid)` | Appends appid to `loadedappids.txt` |

**Progress reporting:** Each phase emits `decky.emit("download_progress", task_id, status)` with phase, percent, and message.

**Cancellation:** Uses `threading.Event` checked between pipeline phases. Cancels cleanly (stops download, removes partial files).

**Dropped from Millennium version:** App info fetching (SteamCMD), API availability ping, games database, icon data URL, DLC logic (moved to frontend).

### 4.3 `backend/api_manifest.py`

| Function | Description |
|----------|-------------|
| `fetch_manifest()` | GET from `raw.githubusercontent.com/madoiscool/lt_api_links` with Vercel proxy fallback |
| `normalize_json(text)` | Fix trailing commas, missing braces in malformed JSON |
| `filter_enabled(sources, api_key?)` | Remove disabled sources, hide Morrenus if no API key configured |
| `get_cached()` | Return in-memory cached manifest |

### 4.4 `backend/steam_paths.py`

| Function | Description |
|----------|-------------|
| `get_steam_path()` | 1. Windows registry (`HKCU\Software\Valve\Steam\SteamPath`) → 2. `STEAM_PATH` env var → 3. Known paths (`C:\Program Files (x86)\Steam`, `~/.steam/steam`) |
| `get_lua_dir(steam_path)` | Returns `{steam_path}/config/stplug-in/` |
| `get_loaded_apps_file(steam_path)` | Returns path to `loadedappids.txt` |

All paths use `pathlib.Path` — platform-agnostic.

### 4.5 Settings

Stored as JSON in `decky.DECKY_PLUGIN_SETTINGS_DIR / "settings.json"`:

```json
{
  "fastDownload": false,
  "morrenusApiKey": ""
}
```

- `fastDownload`: boolean toggle — when ON, skips API source picker and auto-selects first working source
- `morrenusApiKey`: string — optional API key for the Morrenus source
- Validation: type checks only (bool for toggle, string for key)
- No schema versioning, no change hooks, no dynamic choices

## 5. Frontend Components

### 5.1 `src/index.tsx` — Plugin Entry

```typescript
definePlugin(() => {
  // IPC bindings
  const getSteamPath = callable<[], string>("get_steam_path");
  const getAppName = callable<[number], string>("get_app_name");
  const startDownload = callable<[number, string?], string>("start_download");
  // ... etc

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

**Dropped from Millennium entry:** GamepadNav (570 lines), mode detection, disclaimer gate, URL tracking, MutationObserver system, click delegation router (396 lines).

### 5.2 `src/patches/storeButton.tsx` — Store Page Button

Uses `findModuleExport` + `afterPatch` to inject a button into Steam's game page React component:

- Finds the game page component's render function
- Injects `<ButtonItem>` labeled "Add via LuaTools"
- On click: calls `startDownload(appid)`, shows loading spinner
- **DLC Detection:** Checks app type from component props. If DLC → button shows "DLC — Cannot Install" and is disabled with tooltip
- Shows toast on download start / completion

### 5.3 `src/components/DownloadPanel.tsx`

QAM panel for initiating downloads:

- Search input (appid or game name, resolved via `get_app_name`)
- API source picker dropdown (hidden when `fastDownload` is ON)
- Download button
- Progress section (visible during download):
  - Progress bar (percentage)
  - Phase text ("Downloading...", "Extracting...", "Installing...", "Done")
  - Cancel button
- States: idle → downloading → extracting → installing → done / error / cancelled

### 5.4 `src/components/InstalledApps.tsx`

QAM panel for managing installed Lua scripts:

- List fetched via `get_installed_apps()`
- Each entry: app name + appid + [Re-download] + [Delete]
- Delete removes the `.lua` file from `stplug-in/`

### 5.5 `src/components/SettingsPanel.tsx`

QAM panel using Decky's built-in form components:

- `<ToggleField>` — fastDownload
- `<TextField>` — morrenusApiKey
- `<ButtonItem>` — "Refresh API Sources" → calls `refresh_api_manifest()`

## 6. Data Flow & IPC

### 6.1 Download Flow

```
Frontend                    Backend
  │                           │
  │── startDownload(appid)──→│
  │←── task_id ──────────────│
  │                           │ 1. resolve_app_name
  │                           │ 2. download_lua (try 4 sources)
  │                           │ 3. validate_and_extract
  │   download_progress ─────│ 4. install_lua
  │   events (×N)  ←─────────│ 5. track_installed
  │                           │
  │   Update UI:              │
  │   - Progress %            │
  │   - Phase text            │
  │   - Done/error state      │
```

### 6.2 Progress Event Contract

```typescript
interface DownloadProgress {
  task_id: string;
  phase: "fetching_apis" | "downloading" | "extracting" | "installing" | "done" | "error" | "cancelled";
  percent: number;        // 0-100
  message: string;        // Human-readable
  appid?: number;         // On done: the installed app
  error?: string;         // On error: description
}
```

### 6.3 Cancellation

Cooperative — uses `threading.Event` checked between pipeline phases. Partial files are cleaned up on cancel.

### 6.4 All IPC Methods

| Method | Args | Returns | Notes |
|--------|------|---------|-------|
| `get_steam_path` | — | `str` | Cached after first call |
| `get_app_name` | `appid: int` | `str` | Cache → API → "Unknown Game" |
| `start_download` | `appid: int, source?: str` | `task_id: str` | Progress via events |
| `get_download_status` | `task_id: str` | `DownloadProgress` | Polling fallback |
| `cancel_download` | `task_id: str` | `void` | Cooperative cancel |
| `get_installed_apps` | — | `AppInfo[]` | Reads `loadedappids.txt` |
| `start_download_from_url` | `url: str, appid: int` | `task_id: str` | Same pipeline |
| `get_api_sources` | — | `ApiSource[]` | Cached manifest |
| `refresh_api_manifest` | — | `ApiSource[]` | Re-fetches + caches |
| `get_settings` | — | `Settings` | Reads JSON |
| `set_setting` | `key: str, value: any` | `void` | Type-validated |

## 7. Error Handling

### 7.1 Backend

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

### 7.2 Frontend

| Scenario | Behavior |
|----------|----------|
| IPC timeout | `callable` rejects → toast "Backend not responding" |
| Download error | Phase="error" → show message in progress panel + toast |
| App name unknown | Show "App {appid}" as fallback |

## 8. Testing

| Layer | Strategy |
|-------|----------|
| Backend unit | Test `downloads.py` pipeline with mock HTTP. Test `steam_paths.py` with mock registry/env. Test `api_manifest.py` with mock GitHub. |
| Backend integration | Full `start_download` with real small app, verify `.lua` written to temp dir |
| Frontend | Manual testing on Windows Decky (primary target). React component testing not practical without Steam's runtime. |
| E2E | Manual: open store → click button → verify download → check QAM → see installed app |

No automated frontend tests — Decky plugins run inside Steam's CEF.

## 9. Explicit Exclusions

The following Millennium features are intentionally excluded from the Decky port:

| Excluded | Reason |
|----------|--------|
| Game fixes (generic, online, unfix, rollback) | Dropped by decision |
| Theme system (11 themes, CSS engine, 4 animations) | Decky uses native Steam theming |
| SteamDB browser extension + Chrome API shim | No Decky equivalent; not needed for button injection |
| Key donation (extract, validate, submit, cache) | Security concern; dropped |
| Games database / playability pills (toolsdb.piqseu.cc) | Dropped by decision |
| Playable warning popup | Dropped by decision |
| Auto-update / self-update / Steam restart | Deferred |
| 30 non-English locale files + LocaleManager | English hardcoded only |
| Gamepad navigation system (570 lines) | Decky/Steam provides this natively |
| Mode detection (Desktop vs Big Picture heuristic) | Deck has one mode (GamepadUI) |
| MutationObserver DOM injection system | Replaced by React tree patching |
| Millennium disclaimer gate ("I Understand") | Millennium-specific |
| URL tracking (pushState/replaceState polling) | Not needed for Decky |
| Icon data URL fetching | Not needed without playability UI |
| App info / SteamCMD depot queries | Only needed for fixes system |
| API availability health ping (plain HTTP) | Unreliable; let pipeline try sources directly |

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Windows-first, always fallback | Primary target is Windows Decky Loader |
| `pathlib.Path` everywhere | Platform-agnostic paths; no hardcoded separators |
| Cooperative cancellation | Safer than forced thread kill; `threading.Event` between phases |
| Events for progress, not polling | Decky's `decky.emit()` pattern is the standard; `get_download_status` is fallback only |
| No `_root` flag by default | Steam is usually user-writable on Windows; test without first |
| English hardcoded strings | No i18n overhead for MVP; can add later |
| Decky native form components | `ToggleField`, `TextField`, `ButtonItem` — no custom form rendering |
| Store button via `afterPatch` | The Decky-standard way to inject into Steam's React tree |
