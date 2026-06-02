"""Unit tests for search_games Plugin method."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from main import Plugin


class TestSearchGames:
    """Tests for Plugin.search_games()."""

    def test_empty_query_returns_empty(self):
        """Empty or whitespace query returns [] immediately, no HTTP call."""
        plugin = Plugin()
        # Use asyncio.run to invoke the async method synchronously
        result = asyncio.run(plugin.search_games(""))
        assert result == []

        result = asyncio.run(plugin.search_games("   "))
        assert result == []

    def test_normal_response_returns_parsed_list(self):
        """Valid JSON response returns list of {id, name, img} dicts."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "440", "type": "game", "name": "Team Fortress 2", "img": "https://cdn.example/440.jpg", "price": "Free to Play"},
            {"id": "730", "type": "game", "name": "Counter-Strike 2", "img": "https://cdn.example/730.jpg", "price": "Free to Play"},
        ]

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("main.httpx.AsyncClient", return_value=mock_client):
            plugin = Plugin()
            result = asyncio.run(plugin.search_games("counter"))

        assert len(result) == 2
        assert result[0] == {"id": 440, "name": "Team Fortress 2", "img": "https://cdn.example/440.jpg"}
        assert result[1] == {"id": 730, "name": "Counter-Strike 2", "img": "https://cdn.example/730.jpg"}

    def test_http_error_returns_empty(self):
        """Non-200 response returns [] and logs debug."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = Exception("HTTP 500")

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("main.httpx.AsyncClient", return_value=mock_client), \
             patch("main.decky.logger.debug") as mock_debug:
            plugin = Plugin()
            result = asyncio.run(plugin.search_games("tf2"))

        assert result == []
        mock_debug.assert_called_once()

    def test_connection_error_returns_empty(self):
        """httpx.ConnectError returns [] and logs debug."""
        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=Exception("Connection refused"))

        with patch("main.httpx.AsyncClient", return_value=mock_client), \
             patch("main.decky.logger.debug") as mock_debug:
            plugin = Plugin()
            result = asyncio.run(plugin.search_games("tf2"))

        assert result == []
        mock_debug.assert_called_once()

    def test_malformed_json_returns_empty(self):
        """Response body that is not a list returns []."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"error": "not a list"}

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("main.httpx.AsyncClient", return_value=mock_client), \
             patch("main.decky.logger.debug") as mock_debug:
            plugin = Plugin()
            # Iterating over a dict iterates keys (ints/strings), which will
            # fail KeyError/ValueError in the comprehension → result is []
            result = asyncio.run(plugin.search_games("tf2"))

        assert result == []

    def test_item_with_missing_fields_is_skipped(self):
        """Items missing 'id' or 'name' are silently skipped."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "440", "name": "Team Fortress 2", "img": "https://cdn.example/440.jpg"},
            {"type": "game", "name": "No ID"},  # missing id → skipped
            {"id": "730", "type": "game"},       # missing name → skipped
            {"id": "570", "name": "Dota 2", "img": "https://cdn.example/570.jpg"},
        ]

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("main.httpx.AsyncClient", return_value=mock_client):
            plugin = Plugin()
            result = asyncio.run(plugin.search_games("dota"))

        assert len(result) == 2
        assert result[0]["id"] == 440
        assert result[1]["id"] == 570
