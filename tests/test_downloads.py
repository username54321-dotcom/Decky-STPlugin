"""Unit tests for the download pipeline helpers."""
import pytest
from backend.downloads import _substitute_url


class TestFormatFailureMessage:
    def test_single_failure(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message(["Sushi (404 Not Found)"])
        assert result == "All download sources unavailable: Sushi (404 Not Found)"

    def test_multiple_failures(self):
        from backend.downloads import _format_failure_message
        failures = [
            "Morrenus (no API key)",
            "Ryuu (403 Forbidden)",
            "TwentyTwo Cloud (connection failed)",
            "Sushi (404 Not Found)",
        ]
        result = _format_failure_message(failures)
        expected = (
            "All download sources unavailable: "
            "Morrenus (no API key); Ryuu (403 Forbidden); "
            "TwentyTwo Cloud (connection failed); Sushi (404 Not Found)"
        )
        assert result == expected

    def test_empty_failures_fallback(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message([])
        assert result == "All download sources unavailable"

    def test_http_reason_phrase_included(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message(["TestSource (503 Service Unavailable)"])
        assert "503" in result
        assert "Service Unavailable" in result


class TestSubstituteUrl:
    def test_replaces_appid(self):
        result = _substitute_url("https://api.example/<appid>/lua", 730, "")
        assert result == "https://api.example/730/lua"

    def test_replaces_moapikey(self):
        result = _substitute_url("https://api.example/<appid>?key=<moapikey>", 730, "secret")
        assert result == "https://api.example/730?key=secret"

    def test_keeps_placeholder_without_key(self):
        result = _substitute_url("https://api.example/<appid>?key=<moapikey>", 730, "")
        assert result == "https://api.example/730?key=<moapikey>"
