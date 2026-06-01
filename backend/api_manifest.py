"""Management of the LuaTools API manifest (free API source list)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

# Primary and fallback URLs for the API manifest
_API_MANIFEST_URL = (
    "https://raw.githubusercontent.com/madoiscool/lt_api_links/refs/heads/main/api_links.json"
)
_API_MANIFEST_PROXY_URL = "https://lt-api-links.vercel.app/api_links.json"

# In-memory cache of fetched API sources
_cached_sources: list[dict[str, Any]] | None = None


def _normalize_json(text: str) -> str:
    """Fix common JSON issues: trailing commas, missing closing braces."""
    # Remove trailing commas before ] or }
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Track nesting order to close properly
    stack = []
    for ch in text:
        if ch == "{":
            stack.append("}")
        elif ch == "[":
            stack.append("]")
        elif ch == "}":
            if stack and stack[-1] == "}":
                stack.pop()
        elif ch == "]":
            if stack and stack[-1] == "]":
                stack.pop()
    # Add missing closing tokens in reverse nesting order
    for ch in reversed(stack):
        text += ch
    return text


async def fetch_manifest() -> list[dict[str, Any]]:
    """Fetch the API manifest from GitHub, with Vercel proxy fallback."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        text = ""
        try:
            resp = await client.get(_API_MANIFEST_URL, follow_redirects=True)
            resp.raise_for_status()
            text = resp.text
        except Exception:
            try:
                resp = await client.get(_API_MANIFEST_PROXY_URL, follow_redirects=True)
                resp.raise_for_status()
                text = resp.text
            except Exception:
                pass

    if not text:
        return _get_default_sources()

    normalized = _normalize_json(text)
    try:
        data = json.loads(normalized)
        sources = data.get("api_list", [])
        return [s for s in sources if s.get("enabled", False)]
    except json.JSONDecodeError:
        return _get_default_sources()


def filter_sources(sources: list[dict[str, Any]], api_key: str = "") -> list[dict[str, Any]]:
    """Filter enabled sources, hiding Morrenus-requiring APIs if no key provided."""
    result = []
    for src in sources:
        url = src.get("url", "")
        # Skip sources requiring Morrenus API key when none is configured
        if "<moapikey>" in url and not api_key:
            continue
        result.append(src)
    return result


def get_cached_sources() -> list[dict[str, Any]]:
    """Return the last-fetched manifest (in-memory cache)."""
    global _cached_sources
    if _cached_sources is None:
        _cached_sources = _get_default_sources()
    return _cached_sources


def _get_default_sources() -> list[dict[str, Any]]:
    """Hardcoded fallback list if the manifest cannot be fetched."""
    return [
        {
            "name": "Morrenus",
            "url": "https://morrenus.xyz/morrenus/api/<appid>/lua/download?key=<moapikey>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "Ryuu",
            "url": "http://167.235.229.108/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "TwentyTwo Cloud",
            "url": "https://api.22cloud.pw/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
        {
            "name": "Sushi",
            "url": "https://raw.githubusercontent.com/madoiscool/lua-sushi/main/<appid>/<appid>.zip",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
    ]


async def refresh_manifest() -> list[dict[str, Any]]:
    """Re-fetch the manifest and update the cache."""
    global _cached_sources
    _cached_sources = await fetch_manifest()
    return _cached_sources


async def get_api_sources(api_key: str = "") -> list[dict[str, Any]]:
    """Return available API sources, filtered by API key availability."""
    sources = get_cached_sources()
    return filter_sources(sources, api_key)
