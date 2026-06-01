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
