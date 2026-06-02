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

        # Clean up stale restart scripts from previous runs
        settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        for pattern in ["restart_steam.ps1", "restart_steam.sh"]:
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
                    resp = await client.get(url, headers={"User-Agent": USER_AGENT})
                    resp.raise_for_status()
                    zip_path.write_bytes(resp.content)

                from backend.downloads import _extract_and_install
                result = _extract_and_install(appid, zip_path, lua_dir)
                from backend.downloads import _track_installed, resolve_app_name
                app_name = await resolve_app_name(appid)
                _track_installed(appid, lua_dir, app_name)

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
        """Kill and restart Steam via a detached platform script.

        Writes a PowerShell (Windows) or bash (Linux) script to the
        plugin settings directory, spawns it as a fully detached
        process, and returns immediately. The script survives Steam
        shutdown and relaunches Steam afterward, then exits.
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
    def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None:
        """Write and spawn PowerShell restart script (Windows)."""
        steam_exe = str(Path(steam_path) / "steam.exe")
        script_path = settings_dir / "restart_steam.ps1"
        script_path.write_text(
            f'$steamPath = "{steam_exe}"\n'
            "taskkill /F /IM steam.exe 2>$null\n"
            "Start-Sleep -Seconds 3\n"
            "while (Get-Process steam -ErrorAction SilentlyContinue) {"
            " Start-Sleep -Seconds 1 }\n"
            "Start-Process -FilePath $steamPath\n"
        )
        subprocess.Popen(
            ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW,
        )

    @staticmethod
    def _spawn_restart_linux(settings_dir: Path) -> None:
        """Write and spawn bash restart script (Linux)."""
        script_path = settings_dir / "restart_steam.sh"
        script_path.write_text(
            "#!/bin/bash\n"
            "sleep 3\n"
            "pkill -9 steam 2>/dev/null\n"
            "sleep 2\n"
            "steam &\n"
        )
        script_path.chmod(0o755)
        subprocess.Popen(
            ["bash", str(script_path)],
            start_new_session=True,
        )
