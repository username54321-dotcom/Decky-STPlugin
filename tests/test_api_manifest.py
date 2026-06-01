"""Unit tests for API manifest normalisation and filtering."""
import json
import pytest
from backend.api_manifest import (
    _normalize_json,
    filter_sources,
    _get_default_sources,
)


class TestNormalizeJson:
    def test_removes_trailing_commas(self):
        result = _normalize_json('{"a": 1,}')
        parsed = json.loads(result)
        assert parsed == {"a": 1}

    def test_removes_trailing_commas_in_arrays(self):
        result = _normalize_json('[1, 2,]')
        parsed = json.loads(result)
        assert parsed == [1, 2]

    def test_adds_missing_closing_braces(self):
        result = _normalize_json('{"a": {"b": 1}')
        parsed = json.loads(result)
        assert parsed == {"a": {"b": 1}}

    def test_adds_missing_closing_brackets(self):
        result = _normalize_json('{"a": [1, 2')
        parsed = json.loads(result)
        assert parsed == {"a": [1, 2]}

    def test_valid_json_unchanged(self):
        original = '{"a": 1}'
        result = _normalize_json(original)
        assert json.loads(result) == {"a": 1}


class TestFilterSources:
    def test_hides_morrenus_without_api_key(self):
        sources = [
            {"name": "Morrenus", "url": "https://example.com/<moapikey>/stuff", "enabled": True},
            {"name": "Ryuu", "url": "https://other.com/<appid>", "enabled": True},
        ]
        result = filter_sources(sources, api_key="")
        names = [s["name"] for s in result]
        assert "Ryuu" in names
        assert "Morrenus" not in names

    def test_shows_morrenus_with_api_key(self):
        sources = [
            {"name": "Morrenus", "url": "https://example.com/<moapikey>/stuff", "enabled": True},
        ]
        result = filter_sources(sources, api_key="abc123")
        assert len(result) == 1
        assert result[0]["name"] == "Morrenus"


def test_default_sources_has_four_entries():
    defaults = _get_default_sources()
    assert len(defaults) == 4
    names = {s["name"] for s in defaults}
    assert names == {"Morrenus", "Ryuu", "TwentyTwo Cloud", "Sushi"}
