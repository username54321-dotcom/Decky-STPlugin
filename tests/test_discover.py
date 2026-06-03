"""Tests for discover_installed feature."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from backend.downloads import _resolve_image_url


class TestResolveImageUrl:
    """Tests for _resolve_image_url()."""

    @pytest.mark.asyncio
    async def test_returns_img_from_first_result(self):
        """Returns img field from first search suggest result."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "730", "name": "Counter-Strike 2", "img": "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg"},
        ]
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Counter-Strike 2")
            assert result == "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg"

    @pytest.mark.asyncio
    async def test_returns_empty_on_no_results(self):
        """Returns empty string when suggest API returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Nonexistent Game")
            assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_on_exception(self):
        """Returns empty string on network error."""
        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.side_effect = Exception("timeout")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Some Game")
            assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_for_empty_name(self):
        """Returns empty string for empty input."""
        result = await _resolve_image_url("")
        assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_img_field(self):
        """Returns empty string when result has no img field."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "730", "name": "Counter-Strike 2"},
        ]
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Counter-Strike 2")
            assert result == ""


from backend.downloads import discover_installed


class TestDiscoverInstalled:
    """Tests for discover_installed() async generator."""

    @pytest.mark.asyncio
    async def test_discovers_lua_files(self, tmp_path):
        """Finds .lua files and yields progress events."""
        # Create mock .lua files
        (tmp_path / "730.lua").write_text("-- CS2 lua")
        (tmp_path / "440.lua").write_text("-- TF2 lua")
        (tmp_path / "readme.txt").write_text("not a lua file")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock) as mock_resolve, \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock) as mock_img:
            mock_resolve.side_effect = lambda appid: {730: "Counter-Strike 2", 440: "Team Fortress 2"}.get(appid, "")
            mock_img.return_value = "https://example.com/img.jpg"

            events = []
            async for event in discover_installed():
                events.append(event)

            # Should have: scanning, 2x processing (with appid), done
            assert len(events) >= 4
            assert events[0]["step"] == "scanning"
            assert events[0]["total"] == 2
            assert events[-1]["step"] == "done"
            assert events[-1]["total"] == 2

    @pytest.mark.asyncio
    async def test_yields_error_on_no_steam_path(self):
        """Yields fatal error when Steam path not found."""
        with patch("backend.downloads.get_steam_path", return_value=None):
            events = []
            async for event in discover_installed():
                events.append(event)

            assert len(events) == 1
            assert events[0]["step"] == "error"
            assert "Steam" in events[0]["error"]

    @pytest.mark.asyncio
    async def test_empty_directory_yields_done_zero(self, tmp_path):
        """Yields done with total=0 when no .lua files found."""
        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path):
            events = []
            async for event in discover_installed():
                events.append(event)

            assert len(events) == 2
            assert events[0]["step"] == "scanning"
            assert events[0]["total"] == 0
            assert events[1]["step"] == "done"
            assert events[1]["total"] == 0

    @pytest.mark.asyncio
    async def test_skips_non_numeric_lua_files(self, tmp_path):
        """Only processes files matching {digits}.lua pattern."""
        (tmp_path / "730.lua").write_text("-- valid")
        (tmp_path / "abc.lua").write_text("-- invalid name")
        (tmp_path / "test123.lua").write_text("-- invalid name")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, return_value="CS2"), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in discover_installed():
                events.append(event)

            scanning = [e for e in events if e["step"] == "scanning"]
            assert scanning[0]["total"] == 1  # Only 730.lua

    @pytest.mark.asyncio
    async def test_writes_tracking_file(self, tmp_path):
        """Appends entries to loadedappids.txt as apps are processed."""
        (tmp_path / "730.lua").write_text("-- CS2")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, return_value="Counter-Strike 2"), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value="https://img.jpg"):
            events = []
            async for event in discover_installed():
                events.append(event)

            tracking_file = tmp_path / "loadedappids.txt"
            assert tracking_file.exists()
            content = tracking_file.read_text(encoding="utf-8")
            assert "730|Counter-Strike 2|https://img.jpg" in content

    @pytest.mark.asyncio
    async def test_continues_on_per_app_error(self, tmp_path):
        """Continues processing other apps when one fails."""
        (tmp_path / "730.lua").write_text("-- ok")
        (tmp_path / "440.lua").write_text("-- ok")

        call_count = 0
        async def resolve_side_effect(appid):
            nonlocal call_count
            call_count += 1
            if appid == 730:
                raise Exception("API error")
            return "Team Fortress 2"

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, side_effect=resolve_side_effect), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in discover_installed():
                events.append(event)

            done_events = [e for e in events if e["step"] == "done"]
            assert len(done_events) == 1
            assert done_events[0]["total"] == 2  # Both processed (one with fallback name)
