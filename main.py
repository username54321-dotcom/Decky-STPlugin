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
