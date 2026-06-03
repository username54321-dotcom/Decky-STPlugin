"""Tests for loadedappids.txt tracking -- sanitization and pipe delimiter parsing."""

from __future__ import annotations

import tempfile
from pathlib import Path

from backend.downloads import _sanitize_title, _parse_tracking_line, _track_installed


class TestSanitizeTitle:
    """Tests for _sanitize_title()."""

    def test_plain_title(self):
        assert _sanitize_title("Portal 2") == "Portal 2"

    def test_unicode_symbols(self):
        """Preserves ®, ™, é, etc."""
        assert _sanitize_title("LEGO® Batman™") == "LEGO® Batman™"

    def test_strips_pipe_delimiter(self):
        """Pipe must be stripped to prevent format injection."""
        assert _sanitize_title("Game|Name") == "GameName"

    def test_strips_control_characters(self):
        assert _sanitize_title("Game\x00Name\x1f") == "GameName"

    def test_strips_null_byte(self):
        assert _sanitize_title("Game\x00") == "Game"

    def test_collapses_multiple_spaces(self):
        assert _sanitize_title("Game   Name   Here") == "Game Name Here"

    def test_strips_leading_trailing_whitespace(self):
        assert _sanitize_title("  Game Name  ") == "Game Name"

    def test_colon_preserved(self):
        """Colons are fine in titles -- the delimiter is now pipe."""
        assert _sanitize_title("LEGO® Batman™: Legacy") == "LEGO® Batman™: Legacy"

    def test_empty_string(self):
        assert _sanitize_title("") == ""

    def test_only_whitespace(self):
        assert _sanitize_title("   ") == ""

    def test_only_control_chars(self):
        assert _sanitize_title("\x00\x01\x02") == ""


class TestParseTrackingLine:
    """Tests for _parse_tracking_line() -- the pipe-delimited parser."""

    def test_full_format_with_url(self):
        result = _parse_tracking_line("2215200|LEGO® Batman™|https://example.com/capsule.jpg")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™",
            "img_url": "https://example.com/capsule.jpg",
        }

    def test_name_only(self):
        result = _parse_tracking_line("2215200|LEGO® Batman™")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™",
            "img_url": "",
        }

    def test_legacy_bare_appid(self):
        result = _parse_tracking_line("2215200")
        assert result == {
            "appid": 2215200,
            "name": "",
            "img_url": "",
        }

    def test_empty_line(self):
        assert _parse_tracking_line("") is None

    def test_whitespace_only(self):
        assert _parse_tracking_line("   ") is None

    def test_name_with_colon(self):
        """Colons in names are preserved -- pipe is the delimiter."""
        result = _parse_tracking_line("2215200|LEGO® Batman™: Legacy|https://example.com/img.jpg")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™: Legacy",
            "img_url": "https://example.com/img.jpg",
        }

    def test_url_with_query_params(self):
        result = _parse_tracking_line("2215200|Game|https://example.com/img.jpg?t=123456")
        assert result["img_url"] == "https://example.com/img.jpg?t=123456"


class TestTrackingRoundTrip:
    """Tests that write -> read round-trips correctly via _track_installed + parse."""

    def _make_temp_dir(self) -> Path:
        return Path(tempfile.mkdtemp())

    def test_write_and_read_back(self):
        lua_dir = self._make_temp_dir()
        _track_installed(2215200, lua_dir, "LEGO® Batman™: Legacy", "https://example.com/img.jpg")
        content = (lua_dir / "loadedappids.txt").read_text(encoding="utf-8")
        assert "|" in content
        assert "2215200|LEGO® Batman™: Legacy|https://example.com/img.jpg" in content

    def test_write_and_read_parse(self):
        """Write with _track_installed, read back with _parse_tracking_line."""
        lua_dir = self._make_temp_dir()
        _track_installed(456, lua_dir, "Game: Subtitle", "https://cdn.example.com/456.jpg")
        content = (lua_dir / "loadedappids.txt").read_text(encoding="utf-8")
        line = content.strip().splitlines()[0]
        parsed = _parse_tracking_line(line)
        assert parsed == {
            "appid": 456,
            "name": "Game: Subtitle",
            "img_url": "https://cdn.example.com/456.jpg",
        }

    def test_sanitizes_pipe_in_title(self):
        """Pipe char in name should be stripped before writing."""
        lua_dir = self._make_temp_dir()
        _track_installed(999, lua_dir, "Game|Bad|Name", "https://example.com/999.jpg")
        content = (lua_dir / "loadedappids.txt").read_text(encoding="utf-8")
        assert "|Bad|" not in content
        assert "999|GameBadName|https://example.com/999.jpg" in content
