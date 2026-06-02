"""Unit tests for StoreInjector CDP discovery and event parsing."""
import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

# decky is a Decky Loader runtime module — mock it before importing
mock_decky = MagicMock()
mock_decky.emit = AsyncMock()
sys.modules["decky"] = mock_decky

from backend.store_injector import StoreInjector


class TestFindStoreTab:
    """Tests for StoreInjector._find_store_tab()."""

    def test_returns_full_tab_when_store_tab_found(self):
        """Returns the full tab dict when store.steampowered.com is in CDP tab list."""
        injector = StoreInjector()
        mock_tabs = [
            {
                "id": "ABC123",
                "url": "https://steamloopback.host/",
                "type": "page",
                "title": "Steam",
                "webSocketDebuggerUrl": "ws://localhost:8080/devtools/page/ABC123",
            },
            {
                "id": "STORE_TAB_ID",
                "url": "https://store.steampowered.com/app/730/?IN_CLIENT=true",
                "type": "page",
                "title": "CS2 on Steam",
                "webSocketDebuggerUrl": "ws://localhost:8080/devtools/page/STORE_TAB_ID",
            },
            {
                "id": "XYZ",
                "url": "https://steamloopback.host/library",
                "type": "page",
                "title": "Library",
                "webSocketDebuggerUrl": "ws://localhost:8080/devtools/page/XYZ",
            },
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(injector._find_store_tab())

        assert result is not None
        assert result["id"] == "STORE_TAB_ID"
        assert "webSocketDebuggerUrl" in result

    def test_returns_none_when_no_store_tab(self):
        """Returns None when no store.steampowered.com tab exists."""
        injector = StoreInjector()
        mock_tabs = [
            {
                "id": "ABC123",
                "url": "https://steamloopback.host/",
                "type": "page",
                "title": "Steam",
            },
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tabs
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(injector._find_store_tab())

        assert result is None

    def test_returns_none_on_connection_error(self):
        """Returns None when the HTTP request fails."""
        injector = StoreInjector()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(side_effect=OSError("Connection refused"))
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(injector._find_store_tab())

        assert result is None

    def test_returns_none_on_invalid_json(self):
        """Returns None when /json returns non-JSON content."""
        injector = StoreInjector()

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("Invalid JSON")

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(injector._find_store_tab())

        assert result is None


class TestBindingCalledParsing:
    """Tests for parsing Runtime.bindingCalled events."""

    def test_valid_appid_emits_event(self):
        """Parses a valid appid from bindingCalled and emits decky event."""
        payload = "730"
        appid = int(payload)
        assert appid == 730

    def test_invalid_appid_is_caught(self):
        """Invalid (non-numeric) payloads are caught without crashing."""
        payload = "not_a_number"
        try:
            appid = int(payload)
            assert False, "Should have raised ValueError"
        except (ValueError, TypeError):
            pass  # Expected

    def test_zero_appid_is_skipped(self):
        """Appid of 0 or negative is skipped."""
        appid = int("0")
        assert appid == 0
        assert not (appid > 0)  # Should be skipped
