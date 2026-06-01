"""Unit tests for store CEF tab discovery."""
import sys
import asyncio
from unittest.mock import patch, MagicMock

# decky is a Decky Loader runtime module — mock it before importing main
sys.modules["decky"] = MagicMock()

from main import Plugin


class TestFindStoreTab:
    """Tests for Plugin.find_store_tab()."""

    def test_returns_tab_id_when_store_tab_found(self):
        """Returns the correct tab ID when store.steampowered.com is in CDP tab list."""
        plugin = Plugin()
        mock_tabs = [
            {"id": "ABC123", "url": "https://steamloopback.host/", "type": "page", "title": "Steam"},
            {"id": "STORE_TAB_ID", "url": "https://store.steampowered.com/app/730/?IN_CLIENT=true", "type": "page", "title": "CS2 on Steam"},
            {"id": "XYZ", "url": "https://steamloopback.host/library", "type": "page", "title": "Library"},
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result == "STORE_TAB_ID"

    def test_returns_none_when_no_store_tab(self):
        """Returns None when no store.steampowered.com tab exists."""
        plugin = Plugin()
        mock_tabs = [
            {"id": "ABC123", "url": "https://steamloopback.host/", "type": "page", "title": "Steam"},
            {"id": "XYZ", "url": "https://steamloopback.host/library", "type": "page", "title": "Library"},
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result is None

    def test_returns_none_on_connection_error(self):
        """Returns None when the HTTP request fails (e.g., port 8080 unreachable)."""
        plugin = Plugin()

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.side_effect = OSError("Connection refused")

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result is None

    def test_returns_none_on_invalid_json(self):
        """Returns None when /json returns non-JSON content."""
        plugin = Plugin()

        mock_resp = MagicMock()
        mock_resp.json.side_effect = ValueError("Invalid JSON")
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result is None

    def test_returns_none_when_tab_id_empty(self):
        """Returns None when the store tab has an empty/missing ID."""
        plugin = Plugin()

        mock_tabs = [
            {"id": "", "url": "https://store.steampowered.com/app/730/", "type": "page"},
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result is None

    def test_skips_non_page_tabs(self):
        """Skips tabs whose type is not 'page' (e.g., service_worker, iframe)."""
        plugin = Plugin()

        mock_tabs = [
            {"id": "SW1", "url": "https://store.steampowered.com/sw.js", "type": "service_worker"},
            {"id": "IF1", "url": "https://store.steampowered.com/widget", "type": "iframe"},
            {"id": "PAGE1", "url": "https://store.steampowered.com/app/730/", "type": "page"},
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(plugin.find_store_tab())

        assert result == "PAGE1"
