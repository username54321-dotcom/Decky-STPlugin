# Store Button CDP Backend Discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move CDP tab discovery for the store page from frontend `fetch()` (blocked by CORS) to Python backend (same-host, no CORS) via a new `find_store_tab` callable.

**Architecture:** Add an `async find_store_tab()` method to the Python Plugin class that fetches `http://localhost:8080/json` and finds the store.steampowered.com tab ID. The frontend replaces its broken `findStoreTab` function with a `callable` wrapper. No other code changes — `executeInTab`, the injected script, the retry loop, and the `postMessage` bridge all stay identical.

**Tech Stack:** Python 3.10+ (httpx, unittest.mock), TypeScript (@decky/api callable)

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `tests/test_store_tab.py` | Unit test for `find_store_tab` backend method |
| Modify | `main.py:76` | Insert `find_store_tab` callable in Plugin class |
| Modify | `src/patches/storeButton.tsx:1-24` | Replace `CefTab` + `findStoreTab` with `callable` |

---

### Task 1: Write failing unit test for `find_store_tab`

**Files:**
- Create: `tests/test_store_tab.py`

- [ ] **Step 1: Write the test file**

```python
"""Unit tests for store CEF tab discovery."""
import sys
from unittest.mock import patch, MagicMock

# decky is a Decky Loader runtime module — mock it before importing main
sys.modules["decky"] = MagicMock()

from main import Plugin


class TestFindStoreTab:
    """Tests for Plugin.find_store_tab()."""

    async def test_returns_tab_id_when_store_tab_found(self):
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
            result = await plugin.find_store_tab()

        assert result == "STORE_TAB_ID"

    async def test_returns_none_when_no_store_tab(self):
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
            result = await plugin.find_store_tab()

        assert result is None

    async def test_returns_none_on_connection_error(self):
        """Returns None when the HTTP request fails (e.g., port 8080 unreachable)."""
        plugin = Plugin()

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.side_effect = OSError("Connection refused")

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await plugin.find_store_tab()

        assert result is None

    async def test_returns_none_on_invalid_json(self):
        """Returns None when /json returns non-JSON content."""
        plugin = Plugin()

        mock_resp = MagicMock()
        mock_resp.json.side_effect = ValueError("Invalid JSON")
        mock_resp.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await plugin.find_store_tab()

        assert result is None

    async def test_returns_none_when_tab_id_empty(self):
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
            result = await plugin.find_store_tab()

        assert result is None

    async def test_skips_non_page_tabs(self):
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
            result = await plugin.find_store_tab()

        assert result == "PAGE1"
```

- [ ] **Step 2: Run the tests to verify they fail**

```pwsh
python -m pytest tests/test_store_tab.py -v
```

Expected: All 6 tests FAIL with `AttributeError: 'Plugin' object has no attribute 'find_store_tab'`

- [ ] **Step 3: Commit**

```pwsh
git add tests/test_store_tab.py
git commit -m "test: add failing tests for find_store_tab backend method"
```

---

### Task 2: Implement `find_store_tab` in `main.py`

**Files:**
- Modify: `main.py:76` (insert after `_unload`, before `# ── Steam Path ──`)

- [ ] **Step 1: Add the `find_store_tab` method to the `Plugin` class**

Insert after line 75 (`decky.logger.info("STPlugin unloading")`) and before line 77 (`# ── Steam Path ──`). The new method:

```python
    # ── Store Tab Discovery ──

    async def find_store_tab(self) -> str | None:
        """Discover the CEF tab ID for store.steampowered.com via CDP."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8080/json")
                resp.raise_for_status()
                tabs = resp.json()
                for tab in tabs:
                    if isinstance(tab, dict) and tab.get("type") == "page":
                        url = tab.get("url", "")
                        if "store.steampowered.com" in url:
                            return str(tab.get("id", "")) or None
                return None
        except Exception as exc:
            decky.logger.warn(f"Failed to query CDP tabs: {exc}")
            return None
```

The resulting `main.py` lines 73-101 should read:

```python
    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")

    # ── Store Tab Discovery ──

    async def find_store_tab(self) -> str | None:
        """Discover the CEF tab ID for store.steampowered.com via CDP."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8080/json")
                resp.raise_for_status()
                tabs = resp.json()
                for tab in tabs:
                    if isinstance(tab, dict) and tab.get("type") == "page":
                        url = tab.get("url", "")
                        if "store.steampowered.com" in url:
                            return str(tab.get("id", "")) or None
                return None
        except Exception as exc:
            decky.logger.warn(f"Failed to query CDP tabs: {exc}")
            return None

    # ── Steam Path ──
```

- [ ] **Step 2: Run tests to verify they pass**

```pwsh
python -m pytest tests/test_store_tab.py -v
```

Expected: All 6 tests PASS

- [ ] **Step 3: Run existing test suite to verify no regressions**

```pwsh
python -m pytest tests/ -v
```

Expected: All tests pass (17 existing + 6 new = 23)

- [ ] **Step 4: Commit**

```pwsh
git add main.py
git commit -m "feat: add find_store_tab callable to discover store CEF tab via CDP"
```

---

### Task 3: Replace frontend `findStoreTab` with `callable` wrapper

**Files:**
- Modify: `src/patches/storeButton.tsx:1-24`

- [ ] **Step 1: Remove `CefTab` interface and `findStoreTab` function, add callable**

Replace lines 1-24:

```typescript
import { executeInTab, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

interface CefTab {
  id: string;
  url: string;
  type: string;
  title: string;
}

async function findStoreTab(): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:8080/json");
    const tabs: CefTab[] = await res.json();
    const storeTab = tabs.find(
      (t) => t.url?.includes("store.steampowered.com") && t.type === "page"
    );
    return storeTab?.id ?? null;
  } catch (e) {
    console.warn("[STPlugin] Failed to query CDP tabs:", e);
    return null;
  }
}
```

With:

```typescript
import { executeInTab, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");
const findStoreTab = callable<[], string | null>("find_store_tab");
```

The resulting file should start with these 4 lines, followed immediately by `function getInjectedScript()` (previously line 26).

- [ ] **Step 2: Build to verify TypeScript compiles**

```pwsh
pnpm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```pwsh
git add src/patches/storeButton.tsx
git commit -m "fix: replace broken fetch-based findStoreTab with backend callable"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

```pwsh
python -m pytest tests/ -v
```

Expected: All 23 tests pass.

- [ ] **Step 2: Run full build**

```pwsh
pnpm run build
```

Expected: Build produces `dist/index.js` with no errors.

- [ ] **Step 3: Commit (if any loose ends)**

```pwsh
git status
git log --oneline -5
```
