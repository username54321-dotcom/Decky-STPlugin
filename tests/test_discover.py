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
