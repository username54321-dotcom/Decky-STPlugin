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
