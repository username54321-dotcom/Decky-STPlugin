# STPlugin Lean Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Decky plugin (Windows-first) that downloads Lua scripts from 4 API sources, installs them to `{steam}/config/stplug-in/`, injects a button on the game store page, and provides a QAM management panel.

**Architecture:** Python backend (Plugin class + 3 modules) communicates with TypeScript/React frontend via Decky IPC (`callable` + `decky.emit`). The store button uses `afterPatch` on Steam's game page React component. The QAM uses `PanelSection`/`ButtonItem`/`ToggleField`/`TextField` from `@decky/ui`.

**Tech Stack:** Python 3.10+ (httpx, zipfile, winreg, asyncio), TypeScript + React (via `@decky/ui`/`@decky/api`), Rollup bundling, pnpm.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `plugin.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `rollup.config.js`

- [ ] **Step 1: Create plugin.json**

Write `plugin.json`:
```json
{
  "name": "STPlugin",
  "author": "",
  "flags": ["debug"],
  "api_version": 1,
  "publish": {
    "tags": [],
    "description": "Lua script downloader for Steam games — port of LTSteamPlugin to Decky Loader.",
    "image": ""
  }
}
```

- [ ] **Step 2: Create package.json**

Write `package.json`:
```json
{
  "name": "decky-stplugin",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w"
  },
  "devDependencies": {
    "@decky/rollup": "^1.0.2",
    "@decky/ui": "^4.11.4",
    "@types/react": "19.1.1",
    "@types/react-dom": "19.1.1",
    "@types/webpack": "^5.28.5",
    "rollup": "^4.53.3",
    "typescript": "^5.6.2"
  },
  "optionalDependencies": {
    "@rollup/rollup-win32-x64-msvc": "^4.53.3"
  },
  "dependencies": {
    "@decky/api": "^1.1.3",
    "react-icons": "^5.3.0",
    "tslib": "^2.7.0"
  },
  "pnpm": {
    "peerDependencyRules": {
      "ignoreMissing": ["react", "react-dom"]
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create rollup.config.js**

Write `rollup.config.js`:
```javascript
import deckyPlugin from "@decky/rollup";
export default deckyPlugin();
```

- [ ] **Step 5: Install dependencies and verify build**

Run:
```bash
pnpm install
pnpm run build
```

Expected: `dist/index.js` is created (even though `src/index.tsx` doesn't exist yet, the build may error — that's fine for now; the scaffolding is in place).

---

### Task 2: Backend — Steam Path Detection (`backend/steam_paths.py`)

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/steam_paths.py`

- [ ] **Step 1: Create backend package init**

Write `backend/__init__.py`:
```python
# STPlugin backend module
```

- [ ] **Step 2: Write steam_paths.py**

Write `backend/steam_paths.py`:
```python
"""Steam installation directory detection — Windows-first with cross-platform fallback."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _from_registry() -> str | None:
    """Try to read Steam path from Windows registry."""
    if sys.platform != "win32":
        return None
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
        value, _ = winreg.QueryValueEx(key, "SteamPath")
        winreg.CloseKey(key)
        if value and Path(value).is_dir():
            return value
    except Exception:
        pass
    return None


def _from_env() -> str | None:
    """Try STEAM_PATH environment variable."""
    val = os.environ.get("STEAM_PATH")
    if val and Path(val).is_dir():
        return val
    return None


def _from_known_paths() -> str | None:
    """Try known default install locations."""
    candidates = []
    if sys.platform == "win32":
        candidates = [
            Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "Steam",
            Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "Steam",
            Path("C:\\Steam"),
        ]
    else:
        candidates = [
            Path.home() / ".steam" / "steam",
            Path.home() / ".local" / "share" / "Steam",
        ]
    for p in candidates:
        if p.is_dir():
            return str(p)
    return None


def get_steam_path() -> str | None:
    """
    Resolve the Steam installation directory.

    Windows-first: registry → env → known paths.
    Returns None if all methods fail.
    """
    return _from_registry() or _from_env() or _from_known_paths()


def get_lua_dir(steam_path: str) -> Path:
    """Return the stplug-in directory path inside the Steam installation."""
    return Path(steam_path) / "config" / "stplug-in"


def get_loaded_apps_file(steam_path: str) -> Path:
    """Return path to the loaded app IDs tracking file."""
    return Path(steam_path) / "config" / "stplug-in" / "loadedappids.txt"
```

- [ ] **Step 3: Verify module imports**

Run:
```bash
python -c "from backend.steam_paths import get_steam_path, get_lua_dir; print(get_steam_path() or 'Steam not found')"
```

Expected: Prints the detected Steam path or "Steam not found" (no crash).

---

### Task 3: Backend — API Manifest Management (`backend/api_manifest.py`)

**Files:**
- Create: `backend/api_manifest.py`

- [ ] **Step 1: Write api_manifest.py**

Write `backend/api_manifest.py`:
```python
"""Management of the LuaTools API manifest (free API source list)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

# Primary and fallback URLs for the API manifest
_API_MANIFEST_URL = (
    "https://raw.githubusercontent.com/madoiscool/lt_api_links/refs/heads/main/api_links.json"
)
_API_MANIFEST_PROXY_URL = "https://lt-api-links.vercel.app/api_links.json"

# In-memory cache of fetched API sources
_cached_sources: list[dict[str, Any]] | None = None


def _normalize_json(text: str) -> str:
    """Fix common JSON issues: trailing commas, missing closing braces."""
    # Remove trailing commas before ] or }
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Count braces and add missing closing ones
    open_braces = text.count("{") - text.count("}")
    open_brackets = text.count("[") - text.count("]")
    text += "}" * max(0, open_braces)
    text += "]" * max(0, open_brackets)
    return text


async def fetch_manifest() -> list[dict[str, Any]]:
    """Fetch the API manifest from GitHub, with Vercel proxy fallback."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        text = ""
        try:
            resp = await client.get(_API_MANIFEST_URL, follow_redirects=True)
            resp.raise_for_status()
            text = resp.text
        except Exception:
            try:
                resp = await client.get(_API_MANIFEST_PROXY_URL, follow_redirects=True)
                resp.raise_for_status()
                text = resp.text
            except Exception:
                pass

    if not text:
        return _get_default_sources()

    normalized = _normalize_json(text)
    try:
        data = json.loads(normalized)
        sources = data.get("api_list", [])
        return [s for s in sources if s.get("enabled", False)]
    except json.JSONDecodeError:
        return _get_default_sources()


def filter_sources(sources: list[dict[str, Any]], api_key: str = "") -> list[dict[str, Any]]:
    """Filter enabled sources, hiding Morrenus-requiring APIs if no key provided."""
    result = []
    for src in sources:
        url = src.get("url", "")
        # Skip sources requiring Morrenus API key when none is configured
        if "<moapikey>" in url and not api_key:
            continue
        result.append(src)
    return result


def get_cached_sources() -> list[dict[str, Any]]:
    """Return the last-fetched manifest (in-memory cache)."""
    global _cached_sources
    if _cached_sources is None:
        _cached_sources = _get_default_sources()
    return _cached_sources


def _get_default_sources() -> list[dict[str, Any]]:
    """Hardcoded fallback list if the manifest cannot be fetched."""
    return [
        {
            "name": "Morrenus",
            "url": "https://morrenus.xyz/morrenus/api/<appid>/lua/download?key=<moapikey>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "Ryuu",
            "url": "http://167.235.229.108/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "TwentyTwo Cloud",
            "url": "https://api.22cloud.pw/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "Sushi",
            "url": "https://raw.githubusercontent.com/madoiscool/lua-sushi/main/<appid>/<appid>.zip",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
    ]


async def refresh_manifest() -> list[dict[str, Any]]:
    """Re-fetch the manifest and update the cache."""
    global _cached_sources
    _cached_sources = await fetch_manifest()
    return _cached_sources


async def get_api_sources(api_key: str = "") -> list[dict[str, Any]]:
    """Return available API sources, filtered by API key availability."""
    sources = get_cached_sources()
    return filter_sources(sources, api_key)
```

- [ ] **Step 2: Verify module imports and default sources**

Run:
```bash
python -c "from backend.api_manifest import get_cached_sources; srcs = get_cached_sources(); print(f'Default sources: {len(srcs)}'); [print(f'  {s[\"name\"]}') for s in srcs]"
```

Expected:
```
Default sources: 4
  Morrenus
  Ryuu
  TwentyTwo Cloud
  Sushi
```

---

### Task 4: Backend — App Name Resolution (`backend/downloads.py` part 1)

**Files:**
- Create: `backend/downloads.py`

- [ ] **Step 1: Write app name resolution in downloads.py**

Write `backend/downloads.py`:
```python
"""Download pipeline for Lua scripts — app name resolution, download, extract, install."""

from __future__ import annotations

import asyncio
import re
import threading
import time
from pathlib import Path
from typing import Any

import httpx

from backend.api_manifest import get_api_sources
from backend.steam_paths import get_lua_dir, get_steam_path

# ── Rate limiting for Steam API ──

_LAST_API_CALL_TIME = 0.0
_API_CALL_MIN_INTERVAL = 0.3  # 300ms
_API_CALL_LOCK = threading.Lock()


def _rate_limit() -> None:
    """Ensure at least 300ms between Steam API calls."""
    global _LAST_API_CALL_TIME
    with _API_CALL_LOCK:
        elapsed = time.time() - _LAST_API_CALL_TIME
        sleep_time = _API_CALL_MIN_INTERVAL - elapsed if elapsed < _API_CALL_MIN_INTERVAL else 0
        _LAST_API_CALL_TIME = time.time() + sleep_time
    if sleep_time > 0:
        time.sleep(sleep_time)


# ── App name cache ──

_app_name_cache: dict[int, str] = {}
_app_name_cache_lock = threading.Lock()

# In-memory applist (loaded lazily)
_applist_data: dict[int, str] = {}
_applist_loaded = False
_applist_lock = threading.Lock()
_APPLIST_URL = "https://applist.morrenus.xyz/"

# ── Download state ──

_download_state: dict[str, dict[str, Any]] = {}
_download_state_lock = threading.Lock()

# Cancellation events per task
_cancel_events: dict[str, threading.Event] = {}


def _set_state(task_id: str, update: dict[str, Any]) -> None:
    with _download_state_lock:
        state = _download_state.get(task_id) or {}
        state.update(update)
        _download_state[task_id] = state


def _get_state(task_id: str) -> dict[str, Any]:
    with _download_state_lock:
        return _download_state.get(task_id, {}).copy()


def _is_cancelled(task_id: str) -> bool:
    event = _cancel_events.get(task_id)
    return event.is_set() if event else False


async def _load_applist() -> None:
    """Load the Steam applist into memory for fast name lookups."""
    global _applist_loaded, _applist_data
    if _applist_loaded:
        return
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(_APPLIST_URL, follow_redirects=True)
            resp.raise_for_status()
            data = resp.json()
            with _applist_lock:
                for appid_str, name in data.items():
                    try:
                        _applist_data[int(appid_str)] = str(name)
                    except (ValueError, TypeError):
                        pass
                _applist_loaded = True
    except Exception:
        _applist_loaded = True  # Don't retry on failure


async def resolve_app_name(appid: int) -> str:
    """
    Resolve a game name for an app ID.

    Priority: cache → applist → Steam Store API.
    Returns empty string if all methods fail.
    """
    # Check cache
    with _app_name_cache_lock:
        if appid in _app_name_cache:
            return _app_name_cache[appid]

    # Check applist
    await _load_applist()
    with _applist_lock:
        if appid in _applist_data:
            name = _applist_data[appid]
            with _app_name_cache_lock:
                _app_name_cache[appid] = name
            return name

    # Steam Store API (rate limited)
    _rate_limit()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            data = resp.json()
            entry = data.get(str(appid)) or {}
            if isinstance(entry, dict):
                inner = entry.get("data") or {}
                name = inner.get("name", "")
                if isinstance(name, str) and name.strip():
                    name = name.strip()
                    with _app_name_cache_lock:
                        _app_name_cache[appid] = name
                    return name
    except Exception:
        pass

    # Cache empty result to prevent repeated failures
    with _app_name_cache_lock:
        _app_name_cache[appid] = ""
    return ""
```

- [ ] **Step 2: Verify the module imports**

Run:
```bash
python -c "import asyncio; from backend.downloads import resolve_app_name; print(asyncio.run(resolve_app_name(730)))"
```

Expected: Prints "Counter-Strike 2" or similar (requires internet), or empty string if offline. No crash.

---

### Task 5: Backend — Download Pipeline (`backend/downloads.py` part 2)

**Files:**
- Modify: `backend/downloads.py` (append to existing)

- [ ] **Step 1: Append download, validate, extract, and install functions**

Append to `backend/downloads.py`:

```python
# ── Download pipeline ──

import uuid
import zipfile


def _substitute_url(template: str, appid: int, api_key: str = "") -> str:
    """Replace <appid> and <moapikey> placeholders in an API URL template."""
    url = template.replace("<appid>", str(appid))
    if "<moapikey>" in url and api_key:
        url = url.replace("<moapikey>", api_key)
    return url


async def download_lua(
    task_id: str,
    appid: int,
    preferred_source: str = "",
    api_key: str = "",
) -> str | None:
    """
    Download a Lua script for the given app ID.

    Tries all available API sources in order. Returns the path to the
    installed .lua file on success, or None on failure. Emits progress
    events via decky.emit() during the process.
    """
    # Deferred import: decky module is only available inside the plugin
    # runtime (provided by Decky Loader), not during import-time of this file.
    import decky

    steam_path = get_steam_path()
    if not steam_path:
        await decky.emit("download_progress", task_id, {
            "task_id": task_id, "phase": "error",
            "percent": 0, "message": "Could not find Steam installation",
        })
        return None

    lua_dir = get_lua_dir(steam_path)
    lua_dir.mkdir(parents=True, exist_ok=True)

    # Get API sources
    try:
        all_sources = await get_api_sources(api_key)
    except Exception:
        from backend.api_manifest import get_cached_sources
        all_sources = get_cached_sources()

    if not all_sources:
        await decky.emit("download_progress", task_id, {
            "task_id": task_id, "phase": "error",
            "percent": 0, "message": "No API sources available",
        })
        return None

    # If a preferred source is specified, try it first
    if preferred_source:
        all_sources = sorted(
            all_sources,
            key=lambda s: 0 if s.get("name") == preferred_source else 1,
        )

    # Download temp path
    import tempfile
    tmp_dir = Path(tempfile.gettempdir()) / "stplugin"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = tmp_dir / f"{appid}.zip"

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for src in all_sources:
            if _is_cancelled(task_id):
                return None

            name = src.get("name", "Unknown")
            template = src.get("url", "")
            success_code = int(src.get("success_code", 200))
            unavailable_code = int(src.get("unavailable_code", 404))

            # Skip sources requiring an API key if none is set
            if "<moapikey>" in template and not api_key:
                continue

            url = _substitute_url(template, appid, api_key)

            await decky.emit("download_progress", task_id, {
                "task_id": task_id, "phase": "fetching_apis",
                "percent": 5, "message": f"Trying {name}...",
            })

            try:
                resp = await client.get(url)
                code = resp.status_code

                if code == unavailable_code:
                    continue
                if code != success_code:
                    continue

                total = int(resp.headers.get("Content-Length", "0") or "0")

                await decky.emit("download_progress", task_id, {
                    "task_id": task_id, "phase": "downloading",
                    "percent": 10, "message": f"Downloading from {name}...",
                })

                # Stream download with progress
                zip_path.write_bytes(resp.content)

                if _is_cancelled(task_id):
                    _cleanup(zip_path)
                    return None

                # Validate magic bytes
                with open(zip_path, "rb") as fh:
                    magic = fh.read(4)
                if magic not in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
                    zip_path.unlink(missing_ok=True)
                    continue  # Not a zip file, try next source

                # Extract and install
                await decky.emit("download_progress", task_id, {
                    "task_id": task_id, "phase": "extracting",
                    "percent": 50, "message": "Extracting Lua script...",
                })

                if _is_cancelled(task_id):
                    _cleanup(zip_path)
                    return None

                result = _extract_and_install(appid, zip_path, lua_dir)
                if result:
                    await decky.emit("download_progress", task_id, {
                        "task_id": task_id, "phase": "installing",
                        "percent": 80, "message": "Installing...",
                    })

                    if _is_cancelled(task_id):
                        _cleanup(zip_path)
                        return None

                    # Track installed app
                    _track_installed(appid, lua_dir)

                    await decky.emit("download_progress", task_id, {
                        "task_id": task_id, "phase": "done",
                        "percent": 100, "message": f"Installed {appid}.lua",
                        "appid": appid,
                    })
                    return str(result)

                # Source succeeded but no lua found — try next
                continue

            except Exception:
                continue  # Try next source

    # All sources failed
    await decky.emit("download_progress", task_id, {
        "task_id": task_id, "phase": "error",
        "percent": 0, "message": "All download sources unavailable",
    })
    _cleanup(zip_path)
    return None


def _extract_and_install(appid: int, zip_path: Path, lua_dir: Path) -> Path | None:
    """Extract Lua file from zip and install to stplug-in directory."""
    with zipfile.ZipFile(zip_path, "r") as archive:
        names = archive.namelist()

        # Extract .manifest files to depotcache/
        steam_path = get_steam_path()
        if steam_path:
            depot_dir = Path(steam_path) / "depotcache"
            depot_dir.mkdir(parents=True, exist_ok=True)
            for name in names:
                if name.lower().endswith(".manifest"):
                    data = archive.read(name)
                    out = depot_dir / Path(name).name
                    out.write_bytes(data)

        # Find the matching .lua file
        candidates = [n for n in names if re.fullmatch(r"\d+\.lua", Path(n).name)]
        chosen = None
        preferred = f"{appid}.lua"
        for c in candidates:
            if Path(c).name == preferred:
                chosen = c
                break
        if chosen is None and candidates:
            chosen = candidates[0]

        if not chosen:
            return None

        # Read and process Lua content
        data = archive.read(chosen)
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("utf-8", errors="replace")

        # Comment out setManifestid() calls
        processed_lines = []
        for line in text.splitlines(keepends=True):
            if re.match(r"^\s*setManifestid\(", line) and not re.match(r"^\s*--", line):
                line = re.sub(r"^(\s*)", r"\1--", line)
            processed_lines.append(line)

        processed_text = "".join(processed_lines)

        # Write to stplug-in/{appid}.lua
        dest = lua_dir / f"{appid}.lua"
        dest.write_text(processed_text, encoding="utf-8")
        return dest


def _track_installed(appid: int, lua_dir: Path) -> None:
    """Append appid to loaded app tracking file."""
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        existing = set()
        if tracking_file.exists():
            existing = set(tracking_file.read_text().splitlines())
        if str(appid) not in existing:
            with tracking_file.open("a", encoding="utf-8") as f:
                f.write(f"{appid}\n")
    except Exception:
        pass


def _cleanup(zip_path: Path) -> None:
    """Remove the temporary zip file."""
    try:
        zip_path.unlink(missing_ok=True)
    except Exception:
        pass


def get_installed_apps() -> list[dict[str, Any]]:
    """Return list of installed app IDs from the tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return []
    lua_dir = get_lua_dir(steam_path)
    tracking_file = lua_dir / "loadedappids.txt"
    if not tracking_file.exists():
        return []

    apps = []
    for line in tracking_file.read_text().splitlines():
        line = line.strip()
        if line and line.isdigit():
            apps.append({"appid": int(line), "name": ""})
    return apps


def remove_lua(appid: int) -> bool:
    """Delete the .lua file for the given app ID."""
    steam_path = get_steam_path()
    if not steam_path:
        return False
    lua_file = get_lua_dir(steam_path) / f"{appid}.lua"
    if lua_file.exists():
        lua_file.unlink()
        return True
    return False


def create_cancel_event() -> tuple[str, threading.Event]:
    """Create a cancellation event for a new download task."""
    task_id = str(uuid.uuid4())
    event = threading.Event()
    _cancel_events[task_id] = event
    return task_id, event


def cancel_task(task_id: str) -> bool:
    """Signal cancellation for a running download task."""
    event = _cancel_events.get(task_id)
    if event and not event.is_set():
        event.set()
        return True
    return False


def cleanup_task(task_id: str) -> None:
    """Remove task state after completion/cancellation."""
    _cancel_events.pop(task_id, None)
    with _download_state_lock:
        _download_state.pop(task_id, None)
```

- [ ] **Step 2: Verify the full module imports**

Run:
```bash
python -c "from backend.downloads import resolve_app_name, get_installed_apps, remove_lua; print('downloads module loaded OK')"
```

Expected: `downloads module loaded OK`

---

### Task 6: Backend — Plugin Class (`main.py`)

**Files:**
- Create: `main.py`

- [ ] **Step 1: Write main.py with all RPC methods**

Write `main.py`:
```python
"""STPlugin — Lua script downloader for Decky Loader (Windows-first)."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import decky

from backend.steam_paths import get_steam_path, get_loaded_apps_file
from backend.downloads import (
    resolve_app_name,
    download_lua,
    get_installed_apps,
    remove_lua,
    create_cancel_event,
    cancel_task,
    cleanup_task,
)
from backend.api_manifest import (
    get_api_sources,
    get_cached_sources,
    refresh_manifest,
)

_SETTINGS_FILE = Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "settings.json"

_DEFAULT_SETTINGS = {
    "fastDownload": False,
    "morrenusApiKey": "",
}


def _read_settings() -> dict[str, Any]:
    """Read settings from disk, merging with defaults."""
    try:
        if _SETTINGS_FILE.exists():
            raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
            return {**_DEFAULT_SETTINGS, **raw}
    except Exception:
        pass
    return dict(_DEFAULT_SETTINGS)


def _write_settings(settings: dict[str, Any]) -> None:
    """Write settings to disk."""
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(json.dumps(settings, indent=2), encoding="utf-8")


class Plugin:
    """Decky plugin backend — all public async methods are callable from TypeScript."""

    async def _main(self) -> None:
        """Initialize on plugin load."""
        decky.logger.info(f"{decky.DECKY_PLUGIN_NAME} v{decky.DECKY_PLUGIN_VERSION} loaded")
        # Pre-fetch API manifest in background
        try:
            sources = await refresh_manifest()
            decky.logger.info(f"API manifest loaded: {len(sources)} sources")
        except Exception as exc:
            decky.logger.warn(f"API manifest fetch failed: {exc}")

    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")

    # ── Steam Path ──

    async def get_steam_path(self) -> str:
        """Return the detected Steam installation directory."""
        path = get_steam_path()
        return path or ""

    # ── App Name ──

    async def get_app_name(self, appid: int) -> str:
        """Resolve a game name from an app ID."""
        name = await resolve_app_name(appid)
        return name or f"App {appid}"

    # ── Download ──

    async def start_download(self, appid: int, api_source: str = "") -> str:
        """
        Start Lua download for the given app ID.

        Returns a task_id for progress tracking via events.
        Event name: "download_progress"
        Event payload: {task_id, phase, percent, message, appid?}
        """
        task_id, _cancel_event = create_cancel_event()

        async def _run():
            try:
                settings = _read_settings()
                api_key = settings.get("morrenusApiKey", "")
                await download_lua(task_id, appid, api_source, api_key)
            except Exception as exc:
                decky.logger.error(f"Download failed for {appid}: {exc}")
                await decky.emit("download_progress", task_id, {
                    "task_id": task_id, "phase": "error",
                    "percent": 0, "message": str(exc),
                })
            finally:
                cleanup_task(task_id)

        asyncio.ensure_future(_run())
        return task_id

    async def cancel_download(self, task_id: str) -> None:
        """Cancel an in-progress download."""
        cancel_task(task_id)

    async def start_download_from_url(self, url: str, appid: int) -> str:
        """Download Lua from a custom URL (for future use)."""
        task_id, _cancel_event = create_cancel_event()

        async def _run():
            try:
                import httpx
                import tempfile
                steam_path = get_steam_path()
                if not steam_path:
                    raise RuntimeError("Steam not found")
                from backend.steam_paths import get_lua_dir
                lua_dir = get_lua_dir(steam_path)
                lua_dir.mkdir(parents=True, exist_ok=True)

                tmp_dir = Path(tempfile.gettempdir()) / "stplugin"
                tmp_dir.mkdir(parents=True, exist_ok=True)
                zip_path = tmp_dir / f"{appid}_url.zip"

                async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    zip_path.write_bytes(resp.content)

                from backend.downloads import _extract_and_install
                result = _extract_and_install(appid, zip_path, lua_dir)
                from backend.downloads import _track_installed
                _track_installed(appid, lua_dir)

                await decky.emit("download_progress", task_id, {
                    "task_id": task_id, "phase": "done",
                    "percent": 100, "message": f"Installed from URL",
                    "appid": appid,
                })
            except Exception as exc:
                await decky.emit("download_progress", task_id, {
                    "task_id": task_id, "phase": "error",
                    "percent": 0, "message": str(exc),
                })
            finally:
                cleanup_task(task_id)

        asyncio.ensure_future(_run())
        return task_id

    # ── Installed Apps ──

    async def get_installed_apps(self) -> list[dict[str, Any]]:
        """Return list of installed Lua scripts with resolved names."""
        apps = get_installed_apps()
        for app in apps:
            app["name"] = await resolve_app_name(app["appid"])
        return apps

    async def delete_app(self, appid: int) -> bool:
        """Remove an installed Lua script."""
        return remove_lua(appid)

    # ── API Manifest ──

    async def get_api_sources(self) -> list[dict[str, Any]]:
        """Return the current list of available API sources."""
        settings = _read_settings()
        api_key = settings.get("morrenusApiKey", "")
        return await get_api_sources(api_key)

    async def refresh_api_manifest(self) -> list[dict[str, Any]]:
        """Force-refresh the API manifest and return updated sources."""
        sources = await refresh_manifest()
        settings = _read_settings()
        api_key = settings.get("morrenusApiKey", "")
        from backend.api_manifest import filter_sources
        return filter_sources(sources, api_key)

    # ── Settings ──

    async def get_settings(self) -> dict[str, Any]:
        """Return current settings."""
        return _read_settings()

    async def set_setting(self, key: str, value: Any) -> None:
        """Update a single setting. Silently ignores unknown keys/invalid types."""
        if key not in _DEFAULT_SETTINGS:
            return
        # Validate types
        if isinstance(_DEFAULT_SETTINGS[key], bool) and not isinstance(value, bool):
            return
        if isinstance(_DEFAULT_SETTINGS[key], str) and not isinstance(value, str):
            return
        settings = _read_settings()
        settings[key] = value
        _write_settings(settings)
```

- [ ] **Step 2: Verify main.py imports**

Run:
```bash
python -c "import main; print('main.py loads OK')"
```

Expected: `main.py loads OK` (may warn about missing env vars for decky, that's expected).

---

### Task 7: Backend — Unit Tests

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/test_steam_paths.py`
- Create: `tests/test_api_manifest.py`
- Create: `tests/test_downloads.py`

**Dependency:** Install `pytest` and `pytest-asyncio`:

```bash
pip install pytest pytest-asyncio
```

- [ ] **Step 1: Write test_steam_paths.py**

Write `tests/test_steam_paths.py`:
```python
"""Unit tests for Steam path detection."""
import sys
from unittest.mock import patch, MagicMock
from pathlib import Path
from backend.steam_paths import get_steam_path, get_lua_dir, get_loaded_apps_file


class TestGetSteamPath:
    def test_registry_returns_valid_path(self):
        with patch("backend.steam_paths._from_registry", return_value="C:\\Steam"):
            assert get_steam_path() == "C:\\Steam"

    def test_falls_back_to_env(self):
        with patch("backend.steam_paths._from_registry", return_value=None), \
             patch("backend.steam_paths._from_env", return_value="/opt/steam"):
            assert get_steam_path() == "/opt/steam"

    def test_falls_back_to_known_paths(self):
        with patch("backend.steam_paths._from_registry", return_value=None), \
             patch("backend.steam_paths._from_env", return_value=None), \
             patch("backend.steam_paths._from_known_paths", return_value="/default/steam"):
            assert get_steam_path() == "/default/steam"

    def test_all_methods_fail_returns_none(self):
        with patch("backend.steam_paths._from_registry", return_value=None), \
             patch("backend.steam_paths._from_env", return_value=None), \
             patch("backend.steam_paths._from_known_paths", return_value=None):
            assert get_steam_path() is None


def test_get_lua_dir():
    result = get_lua_dir("C:\\Steam")
    assert isinstance(result, Path)
    assert str(result).endswith("stplug-in")


def test_get_loaded_apps_file():
    result = get_loaded_apps_file("C:\\Steam")
    assert isinstance(result, Path)
    assert result.name == "loadedappids.txt"
```

- [ ] **Step 2: Write test_api_manifest.py**

Write `tests/test_api_manifest.py`:
```python
"""Unit tests for API manifest normalisation and filtering."""
import json
import pytest
from backend.api_manifest import (
    _normalize_json,
    filter_sources,
    _get_default_sources,
)


class TestNormalizeJson:
    def test_removes_trailing_commas(self):
        result = _normalize_json('{"a": 1,}')
        parsed = json.loads(result)
        assert parsed == {"a": 1}

    def test_removes_trailing_commas_in_arrays(self):
        result = _normalize_json('[1, 2,]')
        parsed = json.loads(result)
        assert parsed == [1, 2]

    def test_adds_missing_closing_braces(self):
        result = _normalize_json('{"a": {"b": 1}')
        parsed = json.loads(result)
        assert parsed == {"a": {"b": 1}}

    def test_adds_missing_closing_brackets(self):
        result = _normalize_json('{"a": [1, 2')
        parsed = json.loads(result)
        assert parsed == {"a": [1, 2]}

    def test_valid_json_unchanged(self):
        original = '{"a": 1}'
        result = _normalize_json(original)
        assert json.loads(result) == {"a": 1}


class TestFilterSources:
    def test_hides_morrenus_without_api_key(self):
        sources = [
            {"name": "Morrenus", "url": "https://example.com/<moapikey>/stuff", "enabled": True},
            {"name": "Ryuu", "url": "https://other.com/<appid>", "enabled": True},
        ]
        result = filter_sources(sources, api_key="")
        names = [s["name"] for s in result]
        assert "Ryuu" in names
        assert "Morrenus" not in names

    def test_shows_morrenus_with_api_key(self):
        sources = [
            {"name": "Morrenus", "url": "https://example.com/<moapikey>/stuff", "enabled": True},
        ]
        result = filter_sources(sources, api_key="abc123")
        assert len(result) == 1
        assert result[0]["name"] == "Morrenus"


def test_default_sources_has_four_entries():
    defaults = _get_default_sources()
    assert len(defaults) == 4
    names = {s["name"] for s in defaults}
    assert names == {"Morrenus", "Ryuu", "TwentyTwo Cloud", "Sushi"}
```

- [ ] **Step 3: Write test_downloads.py**

Write `tests/test_downloads.py`:
```python
"""Unit tests for the download pipeline helpers."""
import pytest
from backend.downloads import _substitute_url


class TestSubstituteUrl:
    def test_replaces_appid(self):
        result = _substitute_url("https://api.example/<appid>/lua", 730, "")
        assert result == "https://api.example/730/lua"

    def test_replaces_moapikey(self):
        result = _substitute_url("https://api.example/<appid>?key=<moapikey>", 730, "secret")
        assert result == "https://api.example/730?key=secret"

    def test_keeps_placeholder_without_key(self):
        result = _substitute_url("https://api.example/<appid>?key=<moapikey>", 730, "")
        assert result == "https://api.example/730?key=<moapikey>"
```

- [ ] **Step 4: Run the test suite**

Run:
```bash
python -m pytest tests/ -v
```

Expected: All tests pass. At minimum:
```
tests/test_steam_paths.py ....
tests/test_api_manifest.py ........
tests/test_downloads.py ....
```

> **Note:** The download pipeline's HTTP-dependent functions (`download_lua`, `resolve_app_name`, `fetch_manifest`) are tested via manual integration (Task 13, Step 3). Unit-testing them with mocked `httpx` is deferred to avoid over-engineering the test harness for the initial build.

---

### Task 8: Frontend — Plugin Entry & QAM Router (`src/index.tsx`)

**Files:**
- Create: `src/index.tsx`
- Create: `src/components/` (empty dir)

- [ ] **Step 1: Create component directory**

Run:
```bash
mkdir -p src/components src/patches
```

- [ ] **Step 2: Write src/index.tsx**

Write `src/index.tsx`:
```tsx
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
} from "@decky/ui";
import {
  definePlugin,
  callable,
  addEventListener,
  removeEventListener,
  toaster,
  routerHook,
} from "@decky/api";
import { FaDownload } from "react-icons/fa";

// ── Import sub-components (statically, for Rollup bundling) ──

import { DownloadPanel } from "./components/DownloadPanel";
import { InstalledApps } from "./components/InstalledApps";
import { SettingsPanel } from "./components/SettingsPanel";
import { registerStoreButtonPatch } from "./patches/storeButton";

// ── Main Panel ──

function MainPanel() {
  return (
    <PanelSection title="STPlugin">
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/download")}
        >
          Download Lua Script
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/installed")}
        >
          Installed Scripts
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/settings")}
        >
          Settings
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

// ── Plugin Definition ──

export default definePlugin(() => {
  console.log("STPlugin initializing");

  // QAM routes — sub-components imported statically above
  routerHook.addRoute("/stplugin", MainPanel, { exact: true });
  routerHook.addRoute("/stplugin/download", () => <DownloadPanel />, { exact: true });
  routerHook.addRoute("/stplugin/installed", () => <InstalledApps />, { exact: true });
  routerHook.addRoute("/stplugin/settings", () => <SettingsPanel />, { exact: true });

  // Store button patch — capture unpatch for cleanup
  const storeButtonUnpatch = registerStoreButtonPatch();

  return {
    name: "STPlugin",
    titleView: <div className={staticClasses.Title}>STPlugin</div>,
    content: <MainPanel />,
    icon: <FaDownload />,
    onDismount() {
      console.log("STPlugin unloading");
      routerHook.removeRoute("/stplugin");
      routerHook.removeRoute("/stplugin/download");
      routerHook.removeRoute("/stplugin/installed");
      routerHook.removeRoute("/stplugin/settings");
      storeButtonUnpatch?.unpatch?.();  // Remove the store page patch
    },
  };
});
```

- [ ] **Step 3: Create placeholder components for build check**

Write `src/components/DownloadPanel.tsx`:
```tsx
import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";

export function DownloadPanel() {
  return (
    <PanelSection title="Download">
      <PanelSectionRow>
        <div>Download panel — coming in next task</div>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

Write `src/components/InstalledApps.tsx`:
```tsx
import { PanelSection, PanelSectionRow } from "@decky/ui";

export function InstalledApps() {
  return (
    <PanelSection title="Installed">
      <PanelSectionRow>
        <div>Installed apps — coming soon</div>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

Write `src/components/SettingsPanel.tsx`:
```tsx
import { PanelSection, PanelSectionRow } from "@decky/ui";

export function SettingsPanel() {
  return (
    <PanelSection title="Settings">
      <PanelSectionRow>
        <div>Settings — coming soon</div>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

Write `src/patches/storeButton.tsx`:
```tsx
export function registerStoreButtonPatch() {
  console.log("Store button patch placeholder — implemented in Task 12");
}
```

- [ ] **Step 4: Build and verify**

Run:
```bash
pnpm run build
```

Expected: `dist/index.js` is created. Build succeeds.

---

### Task 9: Frontend — Download Panel (`src/components/DownloadPanel.tsx`)

**Files:**
- Modify: `src/components/DownloadPanel.tsx` (overwrite placeholder)

- [ ] **Step 1: Write DownloadPanel with full download flow**

Write `src/components/DownloadPanel.tsx`:
```tsx
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  SingleDropdownOption,
  Navigation,
  staticClasses,
} from "@decky/ui";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import { FaDownload, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useState, useEffect, useCallback } from "react";

const getAppName = callable<[number], string>("get_app_name");
const startDownload = callable<[number, string?], string>("start_download");
const cancelDownload = callable<[string], void>("cancel_download");
const getApiSources = callable<[], { name: string; url: string }[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");

interface ApiSource {
  name: string;
  url: string;
}

interface DownloadProgress {
  task_id: string;
  phase: string;
  percent: number;
  message: string;
  appid?: number;
  error?: string;
}

export function DownloadPanel() {
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadProgress | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState("");

  // Load API sources and settings on mount
  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      // Use defaults if settings are unavailable
      setFastDownload(false);
    });
  }, []);

  // Listen for download progress events
  useEffect(() => {
    const listener = addEventListener<[string, DownloadProgress]>(
      "download_progress",
      (taskId, progress) => {
        if (taskId === currentTaskId) {
          setDownloadState(progress);
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Installed Lua for App ${progress.appid}`,
            });
          } else if (progress.phase === "error") {
            toaster.toast({
              title: "Download Failed",
              body: progress.message || "Unknown error",
            });
          }
        }
      }
    );
    return () => removeEventListener("download_progress", listener);
  }, [currentTaskId]);

  // Resolve app name when input changes
  const resolveName = useCallback(async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) {
      setResolvedName("");
      return;
    }
    const name = await getAppName(id);
    setResolvedName(name);
  }, [appidInput]);

  const handleStart = async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    const source = fastDownload ? "" : selectedSource;
    const taskId = await startDownload(id, source);
    setCurrentTaskId(taskId);
    setDownloadState({
      task_id: taskId,
      phase: "fetching_apis",
      percent: 0,
      message: "Starting...",
    });
  };

  const handleCancel = async () => {
    if (currentTaskId) {
      await cancelDownload(currentTaskId);
      setDownloadState({
        task_id: currentTaskId,
        phase: "cancelled",
        percent: 0,
        message: "Cancelled",
      });
    }
  };

  const isDownloading =
    downloadState &&
    !["done", "error", "cancelled"].includes(downloadState.phase);

  return (
    <PanelSection title="Download Lua Script">
      <PanelSectionRow>
        <TextField
          label="App ID"
          value={appidInput}
          onChange={(e) => setAppidInput(e.target.value)}
          onBlur={resolveName}
        />
      </PanelSectionRow>
      {resolvedName && (
        <PanelSectionRow>
          <div className={staticClasses.Label}>{resolvedName}</div>
        </PanelSectionRow>
      )}
      {!fastDownload && sources.length > 0 && (
        <PanelSectionRow>
          <DropdownItem
            label="API Source"
            description="Choose a download source or leave as Auto"
            rgOptions={[
              { data: "", label: "Auto (try all)" },
              ...sources.map((s) => ({ data: s.name, label: s.name })),
            ]}
            selectedOption={selectedSource}
            onChange={(opt) => setSelectedSource(opt.data as string)}
          />
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleStart}
          disabled={!appidInput || isDownloading}
        >
          {isDownloading ? "Downloading..." : "Start Download"}
        </ButtonItem>
      </PanelSectionRow>
      {downloadState && (
        <PanelSectionRow>
          <div>
            <div>
              {downloadState.phase}: {downloadState.message}
            </div>
            {downloadState.percent > 0 && (
              <div>Progress: {downloadState.percent}%</div>
            )}
            {isDownloading && (
              <ButtonItem layout="below" onClick={handleCancel}>
                Cancel
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
```

- [ ] **Step 2: Build and verify**

Run:
```bash
pnpm run build
```

Expected: Build succeeds.

---

### Task 10: Frontend — Installed Apps Panel (`src/components/InstalledApps.tsx`)

**Files:**
- Modify: `src/components/InstalledApps.tsx` (overwrite placeholder)

- [ ] **Step 1: Write InstalledApps with list, re-download, and delete**

Write `src/components/InstalledApps.tsx`:
```tsx
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import { FaDownload, FaTrash, FaRedo } from "react-icons/fa";
import { useState, useEffect } from "react";

const getInstalledApps = callable<[], { appid: number; name: string }[]>("get_installed_apps");
const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

interface InstalledApp {
  appid: number;
  name: string;
}

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);

  const loadApps = async () => {
    try {
      const result = await getInstalledApps();
      setApps(result);
    } catch {
      console.warn("[STPlugin] Failed to load installed apps");
      setApps([]);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = async (appid: number) => {
    const ok = await deleteApp(appid);
    if (ok) {
      toaster.toast({ title: "STPlugin", body: `Removed Lua for App ${appid}` });
      await loadApps();
    } else {
      toaster.toast({ title: "Error", body: "Failed to remove Lua file" });
    }
  };

  const handleRedownload = async (appid: number) => {
    const taskId = await startDownload(appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading App ${appid}...` });
  };

  if (apps.length === 0) {
    return (
      <PanelSection title="Installed Scripts">
        <PanelSectionRow>
          <div className={staticClasses.Label}>No Lua scripts installed yet.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Installed Scripts">
      {apps.map((app) => (
        <PanelSectionRow key={app.appid}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>
              {app.name || `App ${app.appid}`}
            </span>
            <ButtonItem onClick={() => handleRedownload(app.appid)}>
              <FaRedo />
            </ButtonItem>
            <ButtonItem onClick={() => handleDelete(app.appid)}>
              <FaTrash />
            </ButtonItem>
          </div>
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}
```

- [ ] **Step 2: Build and verify**

Run:
```bash
pnpm run build
```

Expected: Build succeeds.

---

### Task 11: Frontend — Settings Panel (`src/components/SettingsPanel.tsx`)

**Files:**
- Modify: `src/components/SettingsPanel.tsx` (overwrite placeholder)

- [ ] **Step 1: Write SettingsPanel with fastDownload toggle, API key, and refresh**

Write `src/components/SettingsPanel.tsx`:
```tsx
import {
  PanelSection,
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";

const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");
const setSetting = callable<[string, any], void>("set_setting");
const refreshApiManifest = callable<[], { name: string; url: string }[]>("refresh_api_manifest");

export function SettingsPanel() {
  const [fastDownload, setFastDownload] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    getSettings().then((s) => {
      setFastDownload(s.fastDownload);
      setApiKey(s.morrenusApiKey);
    });
  }, []);

  const handleFastDownload = async (checked: boolean) => {
    setFastDownload(checked);
    await setSetting("fastDownload", checked);
  };

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    await setSetting("morrenusApiKey", value);
  };

  const handleRefresh = async () => {
    const sources = await refreshApiManifest();
    toaster.toast({
      title: "STPlugin",
      body: `Loaded ${sources.length} API sources`,
    });
  };

  return (
    <PanelSection title="Settings">
      <PanelSectionRow>
        <ToggleField
          label="Fast Download"
          description="Skip source picker — auto-select first working API source"
          checked={fastDownload}
          onChange={handleFastDownload}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Morrenus API Key (optional)"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleRefresh}>
          <FaSync /> Refresh API Sources
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

- [ ] **Step 2: Build and verify**

Run:
```bash
pnpm run build
```

Expected: Build succeeds.

---

### Task 12: Frontend — Store Page Button Patch (`src/patches/storeButton.tsx`)

**Files:**
- Modify: `src/patches/storeButton.tsx` (overwrite placeholder)

- [ ] **Step 1: Write storeButton patch**

Write `src/patches/storeButton.tsx`:
```tsx
import { findModuleExport, afterPatch } from "@decky/ui";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import { useState } from "react";

const startDownload = callable<[number, string?], string>("start_download");
const getSettings = callable<[], { fastDownload: boolean }>("get_settings");

/**
 * Register a React tree patch that adds an "Add via LuaTools"
 * button to Steam's game store page.
 *
 * The patch finds the game page component in Steam's React tree
 * and injects a download button into its render output.
 */
export function registerStoreButtonPatch() {
  // Try to find the Steam store app page component.
  // The fingerprint string below targets Steam's store game page render.
  const StoreGamePage = findModuleExport((e: any) =>
    e?.toString?.()?.includes("StoreGamePage") ||
    e?.toString?.()?.includes("appdetails")
  );

  if (!StoreGamePage) {
    console.warn("[STPlugin] Could not find store game page component");
    return;
  }

  const unpatch = afterPatch(
    StoreGamePage,
    "type",
    (_props: any, _ret: any) => {
      if (!_ret?.props) return _ret;

      // Try to extract the app ID from the component's props
      const appid = _ret.props.appid || _ret.props.nAppID || _ret.props.unAppID;
      if (!appid) return _ret;

      // Check if this is a DLC (has DLC-specific props)
      const isDLC =
        _ret.props.bIsDlc ||
        _ret.props.eAppType === "DLC" ||
        _ret.props.strDLCName;

      // Inject download button
      const children = _ret.props.children;
      if (Array.isArray(children)) {
        children.push(
          <StoreButton
            key="stplugin-download-btn"
            appid={appid}
            isDLC={!!isDLC}
          />
        );
      }

      return _ret;
    }
  );

  console.log("[STPlugin] Store button patch registered");

  // Return unpatch function for cleanup
  return unpatch;
}

/**
 * Injected "Add via LuaTools" button component.
 */
function StoreButton({ appid, isDLC }: { appid: number; isDLC: boolean }) {
  const [downloading, setDownloading] = useState(false);

  const handleClick = async () => {
    if (isDLC || downloading) return;

    setDownloading(true);
    try {
      const taskId = await startDownload(appid);
      toaster.toast({
        title: "STPlugin",
        body: `Downloading Lua for App ${appid}...`,
      });

      // Listen for completion on this task
      interface Progress {
        task_id: string;
        phase: string;
        message?: string;
        appid?: number;
      }
      const listener = addEventListener<[string, Progress]>(
        "download_progress",
        (eventTaskId: string, progress: Progress) => {
          if (eventTaskId !== taskId) return;
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Lua installed for App ${progress.appid || appid}`,
            });
            removeEventListener("download_progress", listener);
            setDownloading(false);
          } else if (progress.phase === "error") {
            toaster.toast({
              title: "Download Failed",
              body: progress.message || "Unknown error",
            });
            removeEventListener("download_progress", listener);
            setDownloading(false);
          }
        }
      );
    } catch (err: any) {
      toaster.toast({ title: "Error", body: err?.message || "Download failed" });
      setDownloading(false);
    }
  };

  if (isDLC) {
    return (
      <button
        disabled
        title="Lua scripts cannot be installed for DLC"
        style={{ opacity: 0.5, cursor: "not-allowed" }}
      >
        DLC — Cannot Install
      </button>
    );
  }

  return (
    <button onClick={handleClick} disabled={downloading}>
      {downloading ? "Downloading..." : "Add via LuaTools"}
    </button>
  );
}
```

- [ ] **Step 2: Build and verify**

Run:
```bash
pnpm run build
```

Expected: Build succeeds (the `findModuleExport` call resolves at runtime).

> **⚠️ HIGH RISK:** The `findModuleExport` fingerprint strings (`"StoreGamePage"`, `"appdetails"`) are speculative and may not match Steam's actual internals. This is the most fragile component in the plugin. On first deployment, verify the button appears on a game store page. If not, use Decky's `SteamClient.BrowserView` or `SteamClient.BrowserWindow.ExecuteJavaScript` to inspect the React tree and find the correct component fingerprint. The fallback behavior (silently not injecting the button) is safe — no crash.

---

### Task 13: Final Build & Manual Testing Checklist

**Files:**
- None new (verification only)

- [ ] **Step 1: Full production build**

Run:
```bash
pnpm run build
```

Expected: `dist/index.js` produced. No build errors.

- [ ] **Step 2: Verify final file structure**

Run:
```bash
Get-ChildItem -Recurse -Name -File | Where-Object { $_ -notmatch "node_modules|\.git|ltsteamplugin|dist/index.js.map" }
```

Expected output includes:
```
AGENTS.md
backend/__init__.py
backend/api_manifest.py
backend/downloads.py
backend/steam_paths.py
main.py
package.json
plugin.json
rollup.config.js
tsconfig.json
src/index.tsx
src/components/DownloadPanel.tsx
src/components/InstalledApps.tsx
src/components/SettingsPanel.tsx
src/patches/storeButton.tsx
tests/__init__.py
tests/test_api_manifest.py
tests/test_downloads.py
tests/test_steam_paths.py
dist/index.js
docs/superpowers/plans/2026-06-01-stplugin-lean-core.md
docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md
docs/references/decky-loader-plugin-development.md
```

- [ ] **Step 3: Manual testing on Windows Decky**

Deploy to Windows Decky Loader and verify:

1. **Plugin loads:** STPlugin appears in Decky plugin list
2. **QAM navigation:** Main panel shows Download / Installed / Settings buttons
3. **Store button patch:** Navigate to a game store page → "Add via LuaTools" button visible
4. **Download from store:** Click button → toast appears → Lua file installed to `{steam}/config/stplug-in/{appid}.lua`
5. **Download from QAM:** Enter app ID → click Start Download → progress shown → toast on completion
6. **Installed apps:** Installed Scripts panel shows downloaded apps with re-download/delete options
7. **Settings:** Toggle fastDownload, enter API key, refresh sources
8. **DLC warning:** Navigate to a DLC store page → button shows "DLC — Cannot Install"
9. **Cancel:** Start a download, cancel mid-way → clean cancellation
10. **Steam path:** Runs `get_steam_path` → returns correct Windows Steam path via registry

- [ ] **Step 4: Commit all files**

```bash
git add -A
git commit -m "feat: initial STPlugin — Lua download pipeline + store button + QAM panel"
```
