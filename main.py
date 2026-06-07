"""STPlugin — Lua script downloader for Decky Loader (Windows-first)."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import httpx
import decky

# Ensure the plugin root is on sys.path so the backend package resolves
_PLUGIN_DIR = Path(__file__).resolve().parent
if str(_PLUGIN_DIR) not in sys.path:
    sys.path.insert(0, str(_PLUGIN_DIR))

from backend.steam_paths import get_steam_path, get_loaded_apps_file
from backend.downloads import (
    resolve_app_name,
    download_lua,
    get_installed_apps,
    remove_lua,
    create_cancel_event,
    cancel_task,
    cleanup_task,
    USER_AGENT,
    discover_installed,
)
from backend.api_manifest import (
    get_api_sources,
    get_cached_sources,
    refresh_manifest,
)
from backend.auto_update import check_for_update as _check_for_update, install_update as _install_update, UPDATE_CHECK_INTERVAL

_SETTINGS_FILE = Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "settings.json"

_DEFAULT_SETTINGS = {
    "fastDownload": False,
    "morrenusApiKey": "",
}

BAT_TEMPLATE = """@echo off
timeout /t 2 /nobreak >nul
taskkill /F /IM steam.exe >nul 2>&1
taskkill /F /IM PluginLoader.exe >nul 2>&1
taskkill /F /IM PluginLoader_noconsole.exe >nul 2>&1

:wait_exit
timeout /t 1 /nobreak >nul
tasklist /FI "IMAGENAME eq steam.exe" 2>nul | find /I "steam.exe" >nul
if not errorlevel 1 goto :wait_exit
tasklist /FI "IMAGENAME eq PluginLoader.exe" 2>nul | find /I "PluginLoader.exe" >nul
if not errorlevel 1 goto :wait_exit
tasklist /FI "IMAGENAME eq PluginLoader_noconsole.exe" 2>nul | find /I "PluginLoader_noconsole.exe" >nul
if not errorlevel 1 goto :wait_exit

:: Start PluginLoader_noconsole.exe (if path was resolved)
set "PLUGIN_LOADER_PATH=__PLUGIN_LOADER_PATH__"
if "%PLUGIN_LOADER_PATH%"=="" goto :start_steam

start "" "%PLUGIN_LOADER_PATH%"
set COUNT=0
:wait_pl
timeout /t 1 /nobreak >nul
tasklist /FI "IMAGENAME eq PluginLoader_noconsole.exe" 2>nul | find /I "PluginLoader_noconsole.exe" >nul
if not errorlevel 1 goto :start_steam
set /a COUNT+=1
if %COUNT% lss 10 goto :wait_pl

:start_steam
start "" "__STEAM_EXE__"
del "%~f0"
"""


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

        # Clean up stale restart scripts from previous runs
        settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        for pattern in ["restart_steam.ps1", "restart_steam.sh", "restart_steam.bat"]:
            script = settings_dir / pattern
            if script.exists():
                try:
                    script.unlink()
                except OSError:
                    pass

        # Pre-fetch API manifest in background
        try:
            sources = await refresh_manifest()
            decky.logger.info(f"API manifest loaded: {len(sources)} sources")
        except Exception as exc:
            decky.logger.warn(f"API manifest fetch failed: {exc}")

        # Start background update checker
        async def _update_checker():
            while True:
                try:
                    await asyncio.sleep(UPDATE_CHECK_INTERVAL)
                except asyncio.CancelledError:
                    break
                info = await _check_for_update()
                if info and info.available:
                    await decky.emit("update_available", {
                        "current_version": info.current_version,
                        "latest_version": info.latest_version,
                        "release_url": info.release_url,
                        "asset_url": info.asset_url,
                        "checked_at": info.checked_at,
                    })

        self._update_task = asyncio.ensure_future(_update_checker())

    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")
        task = getattr(self, "_update_task", None)
        if task:
            task.cancel()

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

    async def start_download(self, appid: int, api_source: str = "", img_url: str = "") -> str:
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
                await download_lua(task_id, appid, api_source, api_key, img_url)
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
                    resp = await client.get(url, headers={"User-Agent": USER_AGENT})
                    resp.raise_for_status()
                    zip_path.write_bytes(resp.content)

                from backend.downloads import _extract_and_install
                result = _extract_and_install(appid, zip_path, lua_dir)
                from backend.downloads import _track_installed, resolve_app_name
                app_name = await resolve_app_name(appid)
                _track_installed(appid, lua_dir, app_name, "")

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
        # Only resolve names for apps missing them
        uncached = [app for app in apps if not app.get("name")]
        if uncached:
            names = await asyncio.gather(
                *[resolve_app_name(app["appid"]) for app in uncached]
            )
            for app, name in zip(uncached, names):
                app["name"] = name
        return apps

    async def delete_app(self, appid: int) -> bool:
        """Remove an installed Lua script."""
        return remove_lua(appid)

    # ── Discover Installed ──

    async def discover_installed_apps(self) -> dict[str, Any]:
        """Scan stplug-in/ for .lua files, resolve names and images, rebuild tracking file.

        Emits "discover_progress" events during processing.
        Returns {"success": True, "discovered": N} or {"success": False, "error": "..."}.
        """
        total = 0
        try:
            async for event in discover_installed():
                await decky.emit("discover_progress", event)
                await asyncio.sleep(0)
                if event.get("step") == "error":
                    return {"success": False, "error": event.get("error", "Unknown error")}
                if event.get("step") == "done":
                    total = event.get("total", 0)
            return {"success": True, "discovered": total}
        except Exception as exc:
            decky.logger.error(f"discover_installed_apps failed: {exc}")
            await decky.emit("discover_progress", {
                "step": "error", "total": 0, "current": 0,
                "message": str(exc), "error": str(exc),
            })
            return {"success": False, "error": str(exc)}

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

    # ── Game Search ──

    async def search_games(self, query: str) -> list[dict[str, Any]]:
        """Search Steam store for games matching the query.

        Returns up to ~10 results as [{id, name, img}].
        Empty list on failure or empty query.
        """
        query = query.strip()
        if not query:
            return []

        url = (
            "https://store.steampowered.com/search/suggest"
            f"?term={query}"
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
        except Exception as exc:
            decky.logger.debug(f"search_games failed: {exc}")
            return []

        results: list[dict[str, Any]] = []
        for item in raw:
            try:
                results.append({
                    "id": int(item["id"]),
                    "name": str(item["name"]),
                    "img": str(item.get("img", "")),
                })
            except (KeyError, ValueError, TypeError):
                continue
        return results

    # ── Steam Restart ──

    async def restart_steam(self) -> dict[str, Any]:
        """Kill Steam and PluginLoader processes, then restart via a detached platform script.

        Writes a batch (Windows) or bash (Linux) script to the
        plugin settings directory, spawns it as a fully detached
        process, and returns immediately. The script survives Steam
        and PluginLoader shutdown, waits for all processes to exit,
        then relaunches Steam.
        """
        steam_path = get_steam_path()
        if not steam_path:
            return {"success": False, "error": "Steam path not detected"}

        settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        settings_dir.mkdir(parents=True, exist_ok=True)

        try:
            if sys.platform == "win32":
                self._spawn_restart_windows(steam_path, settings_dir)
            else:
                self._spawn_restart_linux(settings_dir)
        except Exception as exc:
            decky.logger.error(f"Failed to spawn restart script: {exc}")
            return {"success": False, "error": str(exc)}

        return {"success": True}

    @staticmethod
    def _resolve_plugin_loader_path() -> str | None:
        """Locate PluginLoader_noconsole.exe dynamically.

        Uses getattr to safely check decky.DECKY_HOME (may not be set on Windows),
        then falls back to ~/homebrew/services/ (standard Windows install).
        Returns None if not found — the restart script will skip PluginLoader launch.
        """
        candidates: list[Path] = []
        decky_home = getattr(decky, "DECKY_HOME", None)
        if decky_home:
            candidates.append(
                Path(decky_home) / "services" / "PluginLoader_noconsole.exe"
            )
        candidates.append(
            Path.home() / "homebrew" / "services" / "PluginLoader_noconsole.exe"
        )
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
        return None

    @staticmethod
    def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None:
        """Write and spawn batch restart script that kills Steam and PluginLoader (Windows).

        Injects the resolved PluginLoader_noconsole.exe path into the template.
        If PluginLoader cannot be found, the script skips launching it and
        proceeds directly to starting Steam.
        """
        steam_exe = str(Path(steam_path) / "steam.exe")
        pl_path = Plugin._resolve_plugin_loader_path()
        script_path = settings_dir / "restart_steam.bat"
        script = (
            BAT_TEMPLATE.replace("__PLUGIN_LOADER_PATH__", pl_path or "")
            .replace("__STEAM_EXE__", steam_exe)
        )
        script_path.write_text(script, encoding="utf-8")
        subprocess.Popen(
            ["cmd.exe", "/c", str(script_path)],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    @staticmethod
    def _spawn_restart_linux(settings_dir: Path) -> None:
        """Write and spawn bash restart script that kills Steam and PluginLoader (Linux)."""
        script_path = settings_dir / "restart_steam.sh"
        script_path.write_text(
            "#!/bin/bash\n"
            "sleep 3\n"
            "pkill -9 steam 2>/dev/null\n"
            "pkill -9 PluginLoader 2>/dev/null\n"
            "pkill -9 PluginLoader_noconsole 2>/dev/null\n"
            "sleep 2\n"
            "steam &\n"
        )
        script_path.chmod(0o755)
        subprocess.Popen(
            ["bash", str(script_path)],
            start_new_session=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    # ── Auto-Update ──

    async def check_for_updates(self) -> dict:
        info = await _check_for_update()
        if info is None:
            return {"error": "Failed to check for updates"}

        return {
            "available": info.available,
            "current_version": info.current_version,
            "latest_version": info.latest_version,
            "release_url": info.release_url,
            "asset_url": info.asset_url,
            "checked_at": info.checked_at,
        }

    async def install_update(self, asset_url: str) -> dict:
        success = await _install_update(asset_url)
        return {"success": success}

    # ── Plugin Info ──

    async def get_plugin_version(self) -> str:
        return getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0")
