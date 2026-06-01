"""Unit tests for the download pipeline helpers."""
import pytest
from backend.downloads import _substitute_url


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
