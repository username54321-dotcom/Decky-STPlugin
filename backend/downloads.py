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

# ── User-Agent for download source identification ──

USER_AGENT = "discord(dot)gg/luatools"

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
            resp.encoding = "utf-8"
            data = resp.json()
            with _applist_lock:
                for appid_str, name in data.items():
                    try:
                        _applist_data[int(appid_str)] = _fix_mojibake(str(name))
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
            resp.encoding = "utf-8"
            data = resp.json()
            entry = data.get(str(appid)) or {}
            if isinstance(entry, dict):
                inner = entry.get("data") or {}
                name = inner.get("name", "")
                if isinstance(name, str) and name.strip():
                    name = name.strip()
                    name = _fix_mojibake(name)
                    with _app_name_cache_lock:
                        _app_name_cache[appid] = name
                    return name
    except Exception:
        pass

    # Cache empty result to prevent repeated failures
    with _app_name_cache_lock:
        _app_name_cache[appid] = ""
    return ""


# ── Download pipeline ──

import uuid
import zipfile


def _substitute_url(template: str, appid: int, api_key: str = "") -> str:
    """Replace <appid> and <moapikey> placeholders in an API URL template."""
    url = template.replace("<appid>", str(appid))
    if "<moapikey>" in url and api_key:
        url = url.replace("<moapikey>", api_key)
    return url


def _format_failure_message(failures: list[str]) -> str:
    """Build a detailed error message from per-source failure reasons."""
    if not failures:
        return "All download sources unavailable"
    detail = "; ".join(failures)
    return f"All download sources unavailable: {detail}"


async def download_lua(
    task_id: str,
    appid: int,
    preferred_source: str = "",
    api_key: str = "",
    img_url: str = "",
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
        failures: list[str] = []
        for src in all_sources:
            if _is_cancelled(task_id):
                return None

            name = src.get("name", "Unknown")
            template = src.get("url", "")
            success_code = int(src.get("success_code", 200))
            unavailable_code = int(src.get("unavailable_code", 404))

            # Skip sources requiring an API key if none is set
            if "<moapikey>" in template and not api_key:
                failures.append(f"{name} (no API key)")
                continue

            url = _substitute_url(template, appid, api_key)

            await decky.emit("download_progress", task_id, {
                "task_id": task_id, "phase": "fetching_apis",
                "percent": 5, "message": f"Trying {name}...",
            })

            try:
                resp = await client.get(url, headers={"User-Agent": USER_AGENT})
                code = resp.status_code

                if code == unavailable_code or code != success_code:
                    reason = resp.reason_phrase or f"HTTP {code}"
                    failures.append(f"{name} ({code} {reason})")
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
                    failures.append(f"{name} (invalid file)")
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

                    # Track installed app with name
                    app_name = await resolve_app_name(appid)
                    _track_installed(appid, lua_dir, app_name, img_url)

                    await decky.emit("download_progress", task_id, {
                        "task_id": task_id, "phase": "done",
                        "percent": 100, "message": f"Installed {appid}.lua",
                        "appid": appid,
                    })
                    return str(result)

                # Source succeeded but no lua found — try next
                failures.append(f"{name} (no .lua found)")
                continue

            except Exception:
                failures.append(f"{name} (connection failed)")
                continue  # Try next source

    # All sources failed — emit detailed error
    await decky.emit("download_progress", task_id, {
        "task_id": task_id, "phase": "error",
        "percent": 0, "message": _format_failure_message(failures),
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


def _sanitize_title(name: str) -> str:
    """Sanitize a game title for safe storage in the tracking file."""
    name = re.sub(r"[\x00-\x1f\x7f|]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _fix_mojibake(text: str) -> str:
    """Detect and reverse CP1252/UTF-8 mojibake.

    When UTF-8 bytes are misinterpreted as CP1252 (Windows codepage) and
    then re-encoded as UTF-8, multi-byte characters become garbled. For
    example, ™ (U+2122, UTF-8 bytes E2 84 A2) becomes â„¢ (â + „ + ¢)
    when those bytes are read as CP1252.

    This reversal works by encoding the text back to CP1252 bytes (which
    recovers the original UTF-8 byte sequence) and decoding as UTF-8.

    Handles multiple rounds of corruption (double, triple mojibake) via
    a loop that stabilizes when no further reversal is possible.
    """
    if not text:
        return text
    current = text
    for _ in range(5):  # Max 5 rounds of reversal
        try:
            recovered = current.encode("cp1252").decode("utf-8")
            if recovered == current:
                return current
            current = recovered
        except (UnicodeDecodeError, UnicodeEncodeError):
            break
    return current


async def _resolve_image_url(app_name: str) -> str:
    if not app_name:
        return ""

    _rate_limit()
    url = (
        "https://store.steampowered.com/search/suggest"
        f"?term={app_name}"
        "&cc=US"
        "&l=english"
        "&realm=1"
        "&f=jsonfull"
        "&require_type=game,software"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = resp.json()
            if raw and isinstance(raw, list) and len(raw) > 0:
                img = raw[0].get("img", "")
                if img:
                    return str(img)
    except Exception:
        pass
    return ""


def _parse_tracking_line(line: str) -> dict[str, Any] | None:
    """Parse a single line from loadedappids.txt.

    Format: appid|name|imageUrl (pipe-delimited).
    """
    line = line.strip()
    if not line:
        return None
    if line.isdigit():
        return {"appid": int(line), "name": "", "img_url": ""}
    if "|" not in line:
        return None
    parts = line.split("|", 2)
    try:
        appid = int(parts[0])
    except ValueError:
        return None
    name = parts[1] if len(parts) > 1 else ""
    name = _fix_mojibake(name)
    img_url = parts[2] if len(parts) > 2 else ""
    return {"appid": appid, "name": name, "img_url": img_url}


def _track_installed(appid: int, lua_dir: Path, name: str = "", img_url: str = "") -> None:
    """Append appid|name|img_url to loaded app tracking file."""
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        if not img_url and tracking_file.exists():
            for line in tracking_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith(f"{appid}|"):
                    parts = line.split("|", 2)
                    if len(parts) > 2:
                        img_url = parts[2]
                    break
        name = _sanitize_title(name)
        if img_url:
            entry = f"{appid}|{name}|{img_url}"
        elif name:
            entry = f"{appid}|{name}"
        else:
            entry = str(appid)
        lines = []
        if tracking_file.exists():
            lines = tracking_file.read_text(encoding="utf-8").splitlines()
        appid_str = str(appid)
        lines = [ln for ln in lines if not (ln.strip() == appid_str or ln.strip().startswith(f"{appid_str}|"))]
        lines.append(entry)
        with tracking_file.open("w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
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
    for line in tracking_file.read_text(encoding="utf-8").splitlines():
        parsed = _parse_tracking_line(line)
        if parsed is not None:
            apps.append(parsed)
    return apps


def _remove_loaded_app(appid: int) -> None:
    """Remove appid from the loaded app tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return
    tracking_file = get_lua_dir(steam_path) / "loadedappids.txt"
    if not tracking_file.exists():
        return
    lines = tracking_file.read_text(encoding="utf-8").splitlines()
    prefix = f"{appid}|"
    new_lines = [line for line in lines if not line.strip().startswith(prefix)]
    new_lines = [line for line in new_lines if line.strip() != str(appid)]
    if len(new_lines) != len(lines):
        tracking_file.write_text("\n".join(new_lines) + "\n")


def remove_lua(appid: int) -> bool:
    """Delete the .lua file and remove from tracking for the given app ID."""
    steam_path = get_steam_path()
    if not steam_path:
        return False
    lua_file = get_lua_dir(steam_path) / f"{appid}.lua"
    if lua_file.exists():
        lua_file.unlink()
    _remove_loaded_app(appid)
    return True


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
