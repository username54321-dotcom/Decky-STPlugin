# Backend Specification

> **Living document** — updating this is **critical and not optional**. Update when backend architecture, IPC methods, or Python modules change.
> Last updated: 2026-06-07

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

    # Steam restart (kills Steam + PluginLoader + PluginLoader_noconsole,
    #                  then launches PluginLoader_noconsole before Steam)
    async def restart_steam(self) -> dict

    # Restart script generation (private)
    @staticmethod
    def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None
    @staticmethod
    def _spawn_restart_linux(settings_dir: Path) -> None
    @staticmethod
    def _resolve_plugin_loader_path() -> str | None

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
| `restart_steam` | — | `dict` | Returns `{"success": bool, "error?": str}`; kills Steam + PluginLoader + PluginLoader_noconsole, then starts PluginLoader_noconsole (if found), waits for it to start (max 10s), then restarts Steam |
| `check_for_updates` | — | `dict` | Checks GitHub for newer plugin version |
| `install_update` | `asset_url: str` | `dict` | Downloads and applies plugin update |
| `get_plugin_version` | — | `str` | Returns the current plugin version from `decky.DECKY_PLUGIN_VERSION` |

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
