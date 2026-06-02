# Game Name Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add game name search to the Download panel so users can find Lua scripts by typing a name instead of an App ID.

**Architecture:** A new `search_games` IPC method on the Python backend proxies Steam `/search/suggest`. The frontend adds a mode toggle (App ID / Search) to `DownloadPanel`, a new `GameSearchDropdown` component for live results with images, and uses a 300ms debounce to fire the backend call as the user types.

**Tech Stack:** Python (httpx, decky), TypeScript/React (Decky UI components, Decky API callables), pytest, pytest-asyncio

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `main.py` | Add `search_games` method to `Plugin` class |
| Create | `tests/test_search_games.py` | Backend unit tests for `search_games` |
| Create | `src/components/GameSearchDropdown.tsx` | Dropdown component for search results |
| Modify | `src/components/DownloadPanel.tsx` | Add mode toggle, search input, debounce, integrate dropdown |
| Modify | `package.json` | Add `pytest-asyncio` to test dependencies (if needed) |

---

### Task 1: Add `search_games` backend method to `main.py`

**Files:**
- Modify: `main.py` (add after line 217)
- Modify: `main.py:1-11` (add `httpx` to top-level imports)

- [ ] **Step 1: Add `httpx` to top-level imports**

In `main.py`, add `import httpx` to the existing imports block (after line 10, before `import decky`):

```python
import httpx
```

The import block at the top should become:

```python
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx
import decky
```

- [ ] **Step 2: Add `search_games` method to `Plugin` class**

Append this method after `set_setting` (after line 217, before the final blank line):

```python
    # ── Game Search ──

    async def search_games(self, query: str) -> list[dict[str, Any]]:
        """Search Steam store for games matching the query.

        Returns up to ~10 results as [{id, name, img}].
        Empty list on failure or empty query.
        """
        query = query.strip()
        if not query:
            return []

        url = (
            "https://store.steampowered.com/search/suggest"
            f"?term={query}"
            "&cc=US"
            "&l=english"
            "&realm=1"
            "&f=jsonfull"
            "&require_type=game,software"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                raw = resp.json()
        except Exception as exc:
            decky.logger.debug(f"search_games failed: {exc}")
            return []

        results: list[dict[str, Any]] = []
        for item in raw:
            try:
                results.append({
                    "id": int(item["id"]),
                    "name": str(item["name"]),
                    "img": str(item.get("img", "")),
                })
            except (KeyError, ValueError, TypeError):
                continue
        return results
```

- [ ] **Step 3: Verify imports and method placement**

Run: `python -c "import sys; sys.path.insert(0, '.'); from main import Plugin; print('Import OK')"`
Expected: `Import OK` (may fail if `decky` module is not available locally — that's fine, the syntax and structure are valid)

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat: add search_games backend method to Plugin"
```

---

### Task 2: Write backend tests for `search_games`

**Files:**
- Create: `tests/test_search_games.py`
- Modify: `package.json` (if test runner dependency needed)

> **Note:** The project has no `pytest-asyncio` installed yet. The tests below use `asyncio.run()` to call async methods synchronously, avoiding the need for `pytest-asyncio`. If `httpx` is not importable locally, the `search_games` tests will fail — that's expected; they run in CI or with the Decky environment.

- [ ] **Step 1: Create `tests/test_search_games.py`**

Write `tests/test_search_games.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail with "method not found"**

Run: `python -m pytest tests/test_search_games.py -v`
Expected: FAIL — either "Plugin has no attribute 'search_games'" or all pass if the backend was added first (Task 1).

If `main.py` import fails because `decky` is not installed locally, use `pytest -p no:importlib --pyargs` or just note that the tests validate the logic and syntax.

- [ ] **Step 3: Run tests to verify they pass**

Run: `python -m pytest tests/test_search_games.py -v`
Expected: All 6 tests PASS.

- [ ] **Step 4: Run all existing tests to confirm no regressions**

Run: `python -m pytest tests/ -v`
Expected: All existing tests (3 files, ~15 tests) continue to pass.

- [ ] **Step 5: Commit**

```bash
git add tests/test_search_games.py
git commit -m "test: add search_games unit tests"
```

---

### Task 3: Create `GameSearchDropdown` component

**Files:**
- Create: `src/components/GameSearchDropdown.tsx`

- [ ] **Step 1: Create the component file**

Write `src/components/GameSearchDropdown.tsx`:

```tsx
import React from "react";
import { staticClasses } from "@decky/ui";

export interface GameSearchResult {
  id: number;
  name: string;
  img: string;
}

export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
  onClose: () => void;
}

export function GameSearchDropdown({ results, onSelect, onClose }: GameSearchDropdownProps) {
  if (results.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          padding: "12px 16px",
          color: "var(--gpSystemLighterGrey)",
          fontSize: "14px",
          backgroundColor: "var(--gpBackgroundMedium)",
          border: "1px solid var(--gpBackgroundLight)",
          borderTop: "none",
          borderBottomLeftRadius: "3px",
          borderBottomRightRadius: "3px",
        }}
      >
        No results found
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        maxHeight: "320px",
        overflowY: "auto",
        backgroundColor: "var(--gpBackgroundMedium)",
        border: "1px solid var(--gpBackgroundLight)",
        borderTop: "none",
        borderBottomLeftRadius: "3px",
        borderBottomRightRadius: "3px",
      }}
    >
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid var(--gpBackgroundLight)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--gpBackgroundHard)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
        >
          {result.img ? (
            <img
              src={result.img}
              alt={result.name}
              style={{
                width: "120px",
                height: "45px",
                objectFit: "cover",
                borderRadius: "3px",
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: "120px",
                height: "45px",
                backgroundColor: "var(--gpBackgroundHard)",
                borderRadius: "3px",
                flexShrink: 0,
              }}
            />
          )}
          <span
            className={staticClasses.Label}
            style={{
              fontSize: "14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {result.name}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `pnpm build`  
Expected: Build succeeds (component is importable, ships as part of the rollup bundle).

- [ ] **Step 3: Commit**

```bash
git add src/components/GameSearchDropdown.tsx
git commit -m "feat: add GameSearchDropdown component"
```

---

### Task 4: Modify `DownloadPanel` to add mode toggle and search

**Files:**
- Modify: `src/components/DownloadPanel.tsx`

- [ ] **Step 1: Add new imports at the top of `DownloadPanel.tsx`**

After line 9 (after `FaArrowLeft` import), add:

```tsx
import { GameSearchDropdown } from "./GameSearchDropdown";
import type { GameSearchResult } from "./GameSearchDropdown";
```

- [ ] **Step 2: Add `searchGames` callable**

After line 17 (after `getSettings` callable), add:

```tsx
const searchGames = callable<[string], GameSearchResult[]>("search_games");
```

- [ ] **Step 3: Add new state variables**

Replace the state declarations block (lines 36-42) by adding the new state after `currentTaskId`:

Current block (lines 36-42):
```tsx
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadProgress | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState("");
```

Add these 4 new state declarations after `currentTaskId`:
```tsx
  const [inputMode, setInputMode] = useState<"appid" | "search">("appid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
```

- [ ] **Step 4: Add debounced search effect**

Add this `useEffect` block after the existing download_progress `useEffect` (after line 74):

```tsx
  useEffect(() => {
    if (inputMode !== "search" || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchGames(searchQuery.trim());
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch {
        setSearchResults([]);
        setSearchOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, inputMode]);
```

- [ ] **Step 5: Add search result selection handler**

Add this function after `handleCancel` (after line 97):

```tsx
  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSearchOpen(false);
    setSearchResults([]);
  };
```

- [ ] **Step 6: Add mode toggle handler**

Add this function after `handleSearchSelect`:

```tsx
  const handleModeChange = (mode: "appid" | "search") => {
    if (mode === "appid") {
      // Switching to App ID mode: close dropdown, clear search state.
      // If the user selected a result in search mode, appidInput/resolvedName
      // are already set and will be preserved.
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    } else {
      // Switching to Search mode: clear app ID state, start fresh
      setAppidInput("");
      setResolvedName("");
    }
    setInputMode(mode);
  };
```

- [ ] **Step 7: Replace the existing TextField/reactNode area with mode-aware JSX**

Replace the existing `return (...)` block (lines 103-174) with the new version below. 

**Find** the JSX that starts with:
```tsx
  return (
    <PanelSection title="Download Lua Script">
      <PanelSectionRow>
        <TextField
          label="App ID"
          value={appidInput}
          onChange={(e) => setAppidInput(e.target.value)}
          onBlur={resolveName}
        />
      </PanelSectionRow>
```

**Replace** the entire return block with:

```tsx
  return (
    <PanelSection title="Download Lua Script">
      {/* Mode toggle */}
      <PanelSectionRow>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <ButtonItem
            layout="below"
            onClick={() => handleModeChange("appid")}
            disabled={inputMode === "appid"}
          >
            App ID
          </ButtonItem>
          <ButtonItem
            layout="below"
            onClick={() => handleModeChange("search")}
            disabled={inputMode === "search"}
          >
            Search
          </ButtonItem>
        </div>
      </PanelSectionRow>

      {/* App ID input */}
      {inputMode === "appid" && (
        <>
          <PanelSectionRow>
            <TextField
              label="App ID"
              value={appidInput}
              onChange={(e) => setAppidInput(e.target.value)}
              onBlur={resolveName}
            />
          </PanelSectionRow>
          {resolvedName && (
            <PanelSectionRow>
              <div className={staticClasses.Label}>{resolvedName}</div>
            </PanelSectionRow>
          )}
          {!fastDownload && sources.length > 0 && (
            <PanelSectionRow>
              <DropdownItem
                label="API Source"
                description="Choose a download source or leave as Auto"
                rgOptions={[
                  { data: "", label: "Auto (try all)" },
                  ...sources.map((s) => ({ data: s.name, label: s.name })),
                ]}
                selectedOption={selectedSource}
                onChange={(opt) => setSelectedSource(opt.data as string)}
              />
            </PanelSectionRow>
          )}
        </>
      )}

      {/* Search input */}
      {inputMode === "search" && (
        <>
          <PanelSectionRow>
            <TextField
              label="Game Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </PanelSectionRow>
          {searchOpen && (
            <PanelSectionRow>
              <GameSearchDropdown
                results={searchResults}
                onSelect={handleSearchSelect}
                onClose={() => setSearchOpen(false)}
              />
            </PanelSectionRow>
          )}
          {!searchOpen && searchQuery.trim() && searchResults.length === 0 && (
            <PanelSectionRow>
              <div className={staticClasses.Label} style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}>
                No results found
              </div>
            </PanelSectionRow>
          )}
          {/* Show resolved name after selection */}
          {resolvedName && !searchOpen && (
            <PanelSectionRow>
              <div className={staticClasses.Label}>{resolvedName}</div>
            </PanelSectionRow>
          )}
          {!fastDownload && sources.length > 0 && (
            <PanelSectionRow>
              <DropdownItem
                label="API Source"
                description="Choose a download source or leave as Auto"
                rgOptions={[
                  { data: "", label: "Auto (try all)" },
                  ...sources.map((s) => ({ data: s.name, label: s.name })),
                ]}
                selectedOption={selectedSource}
                onChange={(opt) => setSelectedSource(opt.data as string)}
              />
            </PanelSectionRow>
          )}
        </>
      )}

      {/* Start Download button (visible in both modes) */}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleStart}
          disabled={!!(!appidInput || isDownloading)}
        >
          {isDownloading ? "Downloading..." : "Start Download"}
        </ButtonItem>
      </PanelSectionRow>
      {downloadState && (
        <PanelSectionRow>
          <div>
            <div>
              {downloadState.phase}: {downloadState.message}
            </div>
            {downloadState.percent > 0 && (
              <div>Progress: {downloadState.percent}%</div>
            )}
            {isDownloading && (
              <ButtonItem layout="below" onClick={handleCancel}>
                Cancel
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
```

Make sure to keep the closing `}` for the function after this.

- [ ] **Step 8: Verify build succeeds**

Run: `pnpm build`  
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 9: Run all Python tests to confirm no regressions**

Run: `python -m pytest tests/ -v`  
Expected: All tests pass (~21 tests: ~15 existing + 6 new from Task 2).

- [ ] **Step 10: Commit**

```bash
git add src/components/DownloadPanel.tsx
git commit -m "feat: add game search with mode toggle to DownloadPanel"
```

---

## Manual Testing Guide

Since there is no frontend test framework set up, verify these behaviors manually after deploying to Decky:

1. **Mode toggle:** Click "App ID" and "Search" — UI switches correctly, inputs clear/appear as specified.
2. **App ID mode (regression):** Enter `730`, blur, see "Counter-Strike 2". Click Start → download flow works as before.
3. **Search mode:** Type "counter", wait 300ms, see dropdown with results including images. Click a result → name appears, App ID populated, Start Download enabled.
4. **No results:** Type "xyznonexistent" → see "No results found" text.
5. **Debounce:** Type rapidly — only one API call fires when you stop.
6. **Mode switch preserves selection:** Search → select result → switch to App ID → name and ID are preserved. Switch back to Search → cleared for fresh search.
