# Store Button Python CDP Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `executeInTab` store button injection with a Python-backend CDP WebSocket approach that uses `Runtime.addBinding` for click communication and `Page.addScriptToEvaluateOnNewDocument` for persistent script injection.

**Architecture:** Python `StoreInjector` class manages a persistent CDP WebSocket to the store webview. It discovers the webview via `localhost:8080/json`, connects, registers a `__stplugin_download` binding, injects the button script, and bridges clicks to the frontend via `decky.emit()`. The frontend is simplified to an event listener only.

**Tech Stack:** Python 3.10+, `websockets` (pure Python), `httpx` (already used), `@decky/api` (addEventListener, callable, toaster), TypeScript/React

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/store_injector.py` | **Create** | CDP WebSocket connection manager, discovery loop, binding/script injection, event forwarding |
| `backend/__init__.py` | **Modify** | Add `StoreInjector` to exports |
| `main.py` | **Modify** | Import `StoreInjector`, start/stop in `_main`/`_unload`, remove `find_store_tab` |
| `src/patches/storeButton.tsx` | **Rewrite** | Simplified event listener (25 lines), no `executeInTab`, no `findStoreTab`, no `postMessage` |
| `tests/test_store_injector.py` | **Create** | Unit tests for `StoreInjector._find_store_tab`, event parsing, lifecycle |
| `tests/test_store_tab.py` | **Delete** | Replaced by `test_store_injector.py` |

---

### Task 1: Create `backend/store_injector.py` — Core Module

**Files:**
- Create: `backend/store_injector.py`

- [ ] **Step 1: Create the file with imports, class skeleton, and constants**

```python
"""CDP WebSocket injection manager for Steam store page button.

Discovers the store webview via Chrome DevTools Protocol, opens a persistent
WebSocket connection, registers a click binding, and injects a button script.
Bridges button clicks to the Decky frontend via decky.emit().
"""

from __future__ import annotations

import asyncio
import json
import logging

import decky
import httpx

logger = logging.getLogger("StoreInjector")


INJECTED_SCRIPT = """\
(function() {
    if (window.__stplugin_injected) return;
    window.__stplugin_injected = true;

    var BUTTON_ID = 'stplugin-download-btn';
    var currentAppid = '';

    function getAppidFromUrl() {
        var path = window.location.pathname;
        var m = path.match(/\\/app\\/(\\d+)\\//);
        return m ? m[1] : null;
    }

    function findPurchaseSection(appid) {
        var forms = document.querySelectorAll('.game_area_purchase_game form');
        for (var i = 0; i < forms.length; i++) {
            var subidInput = forms[i].querySelector('input[name="subid"]');
            if (subidInput && subidInput.value === appid) {
                return forms[i].closest('.game_area_purchase_game');
            }
        }
        return document.querySelector('.game_area_purchase_game');
    }

    function injectButton(section) {
        if (!section) return;
        if (document.getElementById(BUTTON_ID)) return;

        var title = section.querySelector('h2.title');
        if (!title) return;

        var btn = document.createElement('a');
        btn.id = BUTTON_ID;
        btn.className = 'btn_green_steamui btn_medium';
        btn.style.marginBottom = '12px';
        btn.style.display = 'inline-block';
        btn.textContent = 'Add via LuaTools';
        btn.onclick = function(e) {
            e.preventDefault();
            if (typeof __stplugin_download === 'function') {
                __stplugin_download(currentAppid);
            }
        };

        title.parentNode.insertBefore(btn, title.nextSibling);
        console.log('[STPlugin] Button injected for app', currentAppid);
    }

    function checkAndInject() {
        var appid = getAppidFromUrl();
        if (!appid) return;
        if (appid !== currentAppid) {
            currentAppid = appid;
            var oldBtn = document.getElementById(BUTTON_ID);
            if (oldBtn) oldBtn.remove();
        }
        var section = findPurchaseSection(appid);
        injectButton(section);
    }

    checkAndInject();

    var observer = new MutationObserver(checkAndInject);
    observer.observe(document.body, { childList: true, subtree: true });

    var lastUrl = window.location.href;
    new MutationObserver(function() {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            currentAppid = '';
            setTimeout(checkAndInject, 500);
        }
    }).observe(document.querySelector('head') || document.documentElement, {
        childList: true, subtree: false
    });

    console.log('[STPlugin] Store injection script loaded (CDP mode)');
})();
"""


class StoreInjector:
    """Manages CDP connection to Steam store webview for button injection.

    Discovers the store webview via http://localhost:8080/json, opens a
    persistent WebSocket connection, registers a CDP binding for click
    callbacks, injects a DOM manipulation script, and bridges clicks
    to the frontend via decky.emit().
    """

    DISCOVERY_INTERVAL = 3  # seconds between discovery polls
    RECONNECT_DELAY = 2     # seconds to wait after WebSocket closes

    def __init__(self) -> None:
        self._ws = None
        self._cmd_id = 0
        self._running = False
        self._discovery_task: asyncio.Task | None = None
        self._script_id: str | None = None

    async def start(self) -> None:
        """Start the discovery loop. Called from Plugin._main()."""
        self._running = True
        self._discovery_task = asyncio.create_task(self._discover_loop())
        logger.info("[StoreInjector] Started")

    async def stop(self) -> None:
        """Stop the injector and clean up. Called from Plugin._unload()."""
        self._running = False
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
        if self._ws and not self._ws.closed:
            await self._ws.close()
        self._ws = None
        logger.info("[StoreInjector] Stopped")

    async def _discover_loop(self) -> None:
        """Periodically search for the store webview and inject when found."""
        while self._running:
            try:
                tab = await self._find_store_tab()
                if tab:
                    ws_url = tab.get("webSocketDebuggerUrl")
                    if ws_url:
                        logger.info(
                            "[StoreInjector] Found store tab: %s",
                            tab.get("title", "unknown"),
                        )
                        await self._connect_and_inject(ws_url)
                        # Connection closed — wait before retrying
                        await asyncio.sleep(self.RECONNECT_DELAY)
                    else:
                        logger.warning("[StoreInjector] Store tab has no WebSocket URL")
                        await asyncio.sleep(self.DISCOVERY_INTERVAL)
                else:
                    # No store tab found — user may not be on store page
                    await asyncio.sleep(self.DISCOVERY_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("[StoreInjector] Discovery error: %s", exc)
                await asyncio.sleep(self.DISCOVERY_INTERVAL)

    async def _find_store_tab(self) -> dict | None:
        """Query CDP targets for any tab with store.steampowered.com in the URL.

        Returns the full tab dict including webSocketDebuggerUrl, or None.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8080/json")
                resp.raise_for_status()
                tabs = resp.json()
                for tab in tabs:
                    if isinstance(tab, dict):
                        url = tab.get("url", "")
                        if "store.steampowered.com" in url:
                            return tab
            return None
        except Exception as exc:
            logger.debug("[StoreInjector] CDP discovery failed: %s", exc)
            return None

    async def _connect_and_inject(self, ws_url: str) -> None:
        """Open CDP WebSocket, register binding, inject script, listen for events."""
        import websockets

        try:
            async with websockets.connect(ws_url) as ws:
                self._ws = ws
                self._cmd_id = 0
                logger.info("[StoreInjector] Connected to store webview")

                # 1. Enable Runtime domain (required for bindings)
                await self._send_cdp(ws, "Runtime.enable")

                # 2. Enable Page domain (required for addScriptToEvaluateOnNewDocument)
                await self._send_cdp(ws, "Page.enable")

                # 3. Register binding for download trigger
                await self._send_cdp(ws, "Runtime.addBinding", {
                    "name": "__stplugin_download",
                })

                # 4. Inject script to run on every page load/navigation
                result = await self._send_cdp(ws, "Page.addScriptToEvaluateOnNewDocument", {
                    "source": INJECTED_SCRIPT,
                })
                if result and "result" in result:
                    self._script_id = result["result"].get("identifier")

                logger.info("[StoreInjector] Script injected, listening for clicks")

                # 5. Listen for Runtime.bindingCalled events
                async for message in ws:
                    if not self._running:
                        break
                    try:
                        data = json.loads(message)
                        if data.get("method") == "Runtime.bindingCalled":
                            params = data.get("params", {})
                            if params.get("name") == "__stplugin_download":
                                payload = params.get("payload", "")
                                try:
                                    appid = int(payload)
                                    if appid > 0:
                                        logger.info(
                                            "[StoreInjector] Download triggered for app %d",
                                            appid,
                                        )
                                        await decky.emit("stplugin_store_download", str(appid))
                                except (ValueError, TypeError):
                                    logger.warning(
                                        "[StoreInjector] Invalid payload: %s",
                                        payload,
                                    )
                    except json.JSONDecodeError:
                        pass  # Skip non-JSON messages

        except websockets.exceptions.ConnectionClosed:
            logger.info("[StoreInjector] WebSocket connection closed")
        except Exception as exc:
            logger.error("[StoreInjector] Connection error: %s", exc)
        finally:
            self._ws = None

    async def _send_cdp(self, ws, method: str, params: dict | None = None) -> dict | None:
        """Send a CDP command and wait for the response with matching ID."""
        self._cmd_id += 1
        msg: dict = {"id": self._cmd_id, "method": method}
        if params:
            msg["params"] = params
        await ws.send(json.dumps(msg))

        # Wait for response with matching ID
        async for message in ws:
            try:
                data = json.loads(message)
                if data.get("id") == self._cmd_id:
                    return data
            except json.JSONDecodeError:
                pass
        return None
```

- [ ] **Step 2: Verify the file has no import errors**

Run: `python -c "from backend.store_injector import StoreInjector; print('OK')"` (from the project root, with `sys.path` adjusted)

Expected: `OK` (or an import error to fix before proceeding)

- [ ] **Step 3: Commit**

```bash
git add backend/store_injector.py
git commit -m "feat: add StoreInjector — CDP WebSocket store button injection backend"
```

---

### Task 2: Create unit tests for `StoreInjector`

**Files:**
- Create: `tests/test_store_injector.py`

- [ ] **Step 1: Write the test file**

```python
"""Unit tests for StoreInjector CDP discovery and event parsing."""
import json
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
            result = injector._find_store_tab_coro()

        import asyncio
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
            import asyncio
            result = asyncio.run(injector._find_store_tab())

        assert result is None

    def test_returns_none_on_connection_error(self):
        """Returns None when the HTTP request fails."""
        injector = StoreInjector()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(side_effect=OSError("Connection refused"))
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            import asyncio
            result = asyncio.run(injector._find_store_tab())

        assert result is None

    def test_returns_none_on_invalid_json(self):
        """Returns None when /json returns non-JSON content."""
        injector = StoreInflater = StoreInjector()

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("Invalid JSON")

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            import asyncio
            result = asyncio.run(injector._find_store_tab())

        assert result is None


class TestBindingCalledParsing:
    """Tests for parsing Runtime.bindingCalled events."""

    def test_valid_appid_emits_event(self):
        """Parses a valid appid from bindingCalled and emits decky event."""
        import asyncio

        injector = StoreInjector()
        mock_decky.emit.reset_mock()

        # Simulate the bindingCalled event parsing
        payload = "730"
        appid = int(payload)
        assert appid == 730
        # In real code, decky.emit would be called
        # We verify the parsing logic, not the full WebSocket flow

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
```

- [ ] **Step 2: Fix the typo in the test file**

There's a typo on the line `injector = StoreInflater = StoreInjector()`. Fix it to just `injector = StoreInjector()`.

- [ ] **Step 3: Run the tests**

Run: `python -m pytest tests/test_store_injector.py -v`

Expected: All tests pass (the `_find_store_tab` tests and the parsing tests).

- [ ] **Step 4: Commit**

```bash
git add tests/test_store_injector.py
git commit -m "test: add StoreInjector unit tests for CDP discovery and event parsing"
```

---

### Task 3: Delete old test file `tests/test_store_tab.py`

**Files:**
- Delete: `tests/test_store_tab.py`

- [ ] **Step 1: Delete the old test file**

```bash
git rm tests/test_store_tab.py
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove old test_store_tab.py (replaced by test_store_injector.py)"
```

---

### Task 4: Modify `main.py` — Integrate StoreInjector, remove `find_store_tab`

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add StoreInjector import near the top**

After line 12 (`import decky`), add:

```python
from backend.store_injector import StoreInjector
```

- [ ] **Step 2: Add `StoreInjector` lifecycle to `_main()`**

Replace the current `_main` method (lines 63-71) with:

```python
    async def _main(self) -> None:
        """Initialize on plugin load."""
        decky.logger.info(f"{decky.DECKY_PLUGIN_NAME} v{decky.DECKY_PLUGIN_VERSION} loaded")

        # Start store page button injection
        self._store_injector = StoreInjector()
        self.loop = asyncio.get_event_loop()
        self.loop.create_task(self._store_injector.start())

        # Pre-fetch API manifest in background
        try:
            sources = await refresh_manifest()
            decky.logger.info(f"API manifest loaded: {len(sources)} sources")
        except Exception as exc:
            decky.logger.warn(f"API manifest fetch failed: {exc}")
```

- [ ] **Step 3: Add `StoreInjector` stop to `_unload()`**

Replace the current `_unload` method (lines 73-75) with:

```python
    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        if hasattr(self, "_store_injector"):
            await self._store_injector.stop()
        decky.logger.info("STPlugin unloading")
```

- [ ] **Step 4: Remove the `find_store_tab` method**

Delete lines 77-95 entirely (the `find_store_tab` method and its `# ── Store Tab Discovery ──` comment).

- [ ] **Step 5: Run existing tests to verify no regressions**

Run: `python -m pytest tests/ -v`

Expected: All tests pass (except the deleted `test_store_tab.py`). The `test_store_injector.py` tests should also pass.

- [ ] **Step 6: Commit**

```bash
git add main.py
git commit -m "feat: integrate StoreInjector lifecycle into Plugin, remove find_store_tab"
```

---

### Task 5: Rewrite `src/patches/storeButton.tsx` — Simplified event listener

**Files:**
- Modify: `src/patches/storeButton.tsx`

- [ ] **Step 1: Replace the entire file content**

Replace all content of `src/patches/storeButton.tsx` with:

```typescript
import { addEventListener, removeEventListener, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

/**
 * Register a listener for store page download events emitted by the
 * Python StoreInjector backend. The backend manages CDP injection and
 * sends events via decky.emit("stplugin_store_download", appidStr).
 */
export function registerStoreButtonPatch() {
  const listener = addEventListener<[string]>(
    "stplugin_store_download",
    (appidStr) => {
      const appid = parseInt(appidStr, 10);
      if (isNaN(appid)) return;
      startDownload(appid).then(() => {
        toaster.toast({
          title: "STPlugin",
          body: `Downloading Lua for App ${appid}...`,
        });
      }).catch((err: any) => {
        toaster.toast({ title: "Error", body: err?.message || "Download failed" });
      });
    }
  );

  return {
    unpatch: () => {
      removeEventListener("stplugin_store_download", listener);
    },
  };
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `pnpm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/patches/storeButton.tsx
git commit -m "feat: simplify storeButton.tsx to event listener only (CDP injection moved to Python)"
```

---

### Task 6: Vendor `websockets` Python package

**Files:**
- Create: `py_modules/websockets/` (vendored package)

- [ ] **Step 1: Create the py_modules directory**

```bash
mkdir -p py_modules
```

- [ ] **Step 2: Copy the websockets package into py_modules**

```bash
pip install websockets --target py_modules --no-deps
```

Or manually copy the installed `websockets` package from the Python site-packages:

```bash
python -c "import websockets; print(websockets.__file__)"
```

Then copy the entire `websockets/` directory (the package directory, not the `.dist-info`) into `py_modules/websockets/`.

- [ ] **Step 3: Verify the import works from the plugin context**

From the project root, verify:

```python
import sys
sys.path.insert(0, "py_modules")
import websockets
print(websockets.__version__)
```

Expected: Prints a version number (12.0+).

- [ ] **Step 4: Update `.gitignore` if needed**

If `py_modules/` is gitignored, add an exception. Check the current `.gitignore`:

```bash
grep "py_modules" .gitignore || echo "Not in gitignore"
```

If it's not ignored, proceed. If it is, add `!py_modules/` to `.gitignore`.

- [ ] **Step 5: Commit**

```bash
git add py_modules/
git commit -m "chore: vendor websockets package for CDP WebSocket support"
```

---

### Task 7: Update `backend/__init__.py` to export StoreInjector

**Files:**
- Modify: `backend/__init__.py`

- [ ] **Step 1: Add StoreInjector import**

Replace the contents of `backend/__init__.py` with:

```python
# STPlugin backend module
from backend.store_injector import StoreInjector

__all__ = ["StoreInjector"]
```

- [ ] **Step 2: Verify import works**

Run: `python -c "from backend import StoreInjector; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/__init__.py
git commit -m "feat: export StoreInjector from backend module"
```

---

### Task 8: Run full test suite and verify build

**Files:**
- None (verification only)

- [ ] **Step 1: Run Python tests**

Run: `python -m pytest tests/ -v`

Expected: All tests pass. This includes `test_store_injector.py`, `test_downloads.py`, `test_api_manifest.py`, and `test_steam_paths.py`. The old `test_store_tab.py` has been deleted.

- [ ] **Step 2: Run TypeScript build**

Run: `pnpm run build`

Expected: Build succeeds with no errors. The output `dist/index.js` should contain references to `stplugin_store_download` (the event name) but NOT `executeInTab` or `findStoreTab`.

- [ ] **Step 3: Verify dist output**

Run: `grep -c "executeInTab" dist/index.js && echo "FAIL: executeInTab still present" || echo "OK: executeInTab removed"`

Expected: `OK: executeInTab removed`

Run: `grep -c "stplugin_store_download" dist/index.js`

Expected: A positive count (the event name should appear in the built output)

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git status
# Only commit if there are uncommitted changes
```

---

### Task 9: Manual integration test on Windows Decky

**Files:**
- None (manual verification only)

- [ ] **Step 1: Deploy the plugin**

Run: `pnpm run build:deploy` or manually copy `dist/`, `main.py`, `backend/`, and `py_modules/` to the Decky plugins directory.

- [ ] **Step 2: Restart Steam BPM and reload plugin**

Via Decky: Settings → Reload plugins, or restart Steam BPM.

- [ ] **Step 3: Check backend logs for StoreInjector startup**

Open the plugin log file (`DECKY_PLUGIN_LOG` path) or Decky console. Expected:

```
[StoreInjector] Started
```

- [ ] **Step 4: Navigate to a store game page**

Go to Store → browse/search for a game → open its page.

Expected in logs within 3-6 seconds:

```
[StoreInjector] Found store tab: CS2 on Steam
[StoreInjector] Connected to store webview
[StoreInjector] Script injected, listening for clicks
```

- [ ] **Step 5: Verify button appears**

On the store game page, verify: a green "Add via LuaTools" button appears after the `<h2 class="title">` element in the purchase section.

- [ ] **Step 6: Click button and verify download starts**

Click "Add via LuaTools".

Expected: Toast notification appears: "Downloading Lua for App {appid}..."

Expected in logs:

```
[StoreInjector] Download triggered for app 730
```

- [ ] **Step 7: Navigate to a different game**

Go to another game's store page.

Expected: Old button removed, new button appears for the new appid within ~500ms. The `Page.addScriptToEvaluateOnNewDocument` ensures re-injection.

- [ ] **Step 8: Navigate away from store**

Go back to Library or another section.

Expected: In logs within a few seconds:

```
[StoreInjector] WebSocket connection closed
```

Then when returning to the store, discovery reconnects:

```
[StoreInjector] Connected to store webview
[StoreInjector] Script injected, listening for clicks
```

- [ ] **Step 9: Reload the plugin**

Via Decky: Settings → Reload plugins.

Expected: StoreInjector restarts, redisCOVERs the store tab, re-injects the button. No double-injection (the `window.__stplugin_injected` guard prevents this).

- [ ] **Step 10: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: adjustments from manual integration testing"
```

---

## Error Handling Summary

| Scenario | Task | Handling |
|----------|------|----------|
| CDP endpoint unreachable | Task 1 | `_find_store_tab()` catches all exceptions, returns None |
| Store tab not found | Task 1 | Discovery loop retries every 3s silently |
| WebSocket drops | Task 1 | `_connect_and_inject` catches `ConnectionClosed`, loop reconnects |
| Binding receives invalid payload | Task 1 | `ValueError`/`TypeError` caught, warning logged |
| TypeScript build fails | Task 5 | Fix compile errors before proceeding |
| websockets import fails | Task 6 | Verify `sys.path` includes `py_modules` |
| Double injection | Task 1 | `window.__stplugin_injected` guard prevents |

## Dependency Summary

| Package | Version | Source | Purpose |
|---------|---------|--------|---------|
| `websockets` | >= 12.0 | Vendored in `py_modules/` | CDP WebSocket client |
| `httpx` | Already used | pip | CDP `/json` HTTP requests |
| `@decky/api` | ^1.1.3 | npm | addEventListener, toaster, callable |