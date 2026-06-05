# Store Button Python CDP Injection — Design Spec

**Date:** 2026-06-02
**Status:** Approved
**Supersedes:** `2026-06-02-storebutton-cdp-backend-discovery.md`, `2026-06-02-store-webview-injection-design.md`

## 1. Problem

The current store button injection uses `executeInTab()` from `@decky/api` combined with a Python `find_store_tab()` method that returns a CDP tab ID. This approach has three failure points on Windows Big Picture Mode:

### Failure Point 1: Tab Identifier Mismatch
`executeInTab()`'s internal implementation routes through Decky Loader's `injector.py`, which matches tabs by **title** (`get_tab(tab_name)` uses `i.title == tab_name`). The Python `find_store_tab()` returns a CDP tab **id** (UUID-style string), which never matches any tab title. The injection always fails or targets the wrong tab.

### Failure Point 2: Store Webview Not Discoverable
On Windows BPM overlay, the store game page is a CEF `<webview>` embedded within GamepadUI. These embedded webviews may not appear as independent entries in the CDP `/json` endpoint. The Python `find_store_tab()` searches `/json` for `url` containing `store.steampowered.com` and `type === "page"`, but the webview might not be listed here at all.

### Failure Point 3: `postMessage` Bridge Broken
The injected script uses `window.parent.postMessage({stplugin_download: appid}, '*')` to communicate with the GamepadUI plugin. In process-isolated CEF webviews, `window.parent` may not reference the GamepadUI window, so the `message` event listener in `storeButton.tsx` never fires.

## 2. Solution

Move ALL CDP interaction to the Python backend, bypassing `executeInTab()` entirely. The Python backend:

1. Discovers the store webview CDP target via `http://localhost:8080/json`
2. Opens a **persistent CDP WebSocket** connection to the webview using its `webSocketDebuggerUrl`
3. Registers a **CDP binding** (`Runtime.addBinding`) named `__stplugin_download`
4. Injects the button creation script via `Page.addScriptToEvaluateOnNewDocument` (persists across navigations)
5. Listens for `Runtime.bindingCalled` events — when the user clicks the button, the binding fires
6. Bridges the click to the frontend via `decky.emit("stplugin_store_download", appid)`

The frontend is simplified to just listening for the event and calling `startDownload()`.

## 3. Architecture

```
┌─ Python Backend (backend/store_injector.py) ──────────────────┐
│                                                                │
│  StoreInjector (async task)                                    │
│    │                                                           │
│    ├─ _discover_loop() [every 3s]                              │
│    │   └─ httpx.get("http://localhost:8080/json")             │
│    │   └─ Find tab where url contains "store.steampowered.com" │
│    │                                                           │
│    ├─ _connect_and_inject(ws_url)                              │
│    │   └─ websockets.connect(ws_url)                           │
│    │   └─ CDP: Runtime.enable                                  │
│    │   └─ CDP: Page.enable                                     │
│    │   └─ CDP: Runtime.addBinding("__stplugin_download")      │
│    │   └─ CDP: Page.addScriptToEvaluateOnNewDocument(script)   │
│    │   └─ Listen for Runtime.bindingCalled events              │
│    │                                                           │
│    └─ On bindingCalled("stplugin_download", appidStr):        │
│        └─ decky.emit("stplugin_store_download", appidStr)     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
         │ decky.emit()
         ▼
┌─ Frontend (src/patches/storeButton.tsx) ───────────────────────┐
│                                                                │
│  addEventListener("stplugin_store_download", (appidStr) => {  │
│    const appid = parseInt(appidStr, 10);                       │
│    startDownload(appid)                                         │
│      .then(() => toaster.toast(...))                            │
│      .catch(err => toaster.toast(...));                         │
│  });                                                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
         │ WebSocket (CDP)
         ▼
┌─ Store Webview (store.steampowered.com/app/730/) ─────────────┐
│                                                                │
│  Injected Script (by Page.addScriptToEvaluateOnNewDocument):   │
│    • MutationObserver on document.body                         │
│    • Parse appid from window.location.pathname                 │
│    • Find .game_area_purchase_game → inject button             │
│    • Button onclick: __stplugin_download(currentAppid)        │
│    • __stplugin_download is registered by CDP Runtime binding  │
│                                                                │
│  <a id="stplugin-download-btn" class="btn_green_steamui">     │
│    Add via LuaTools                                            │
│  </a>                                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 4. Component Details

### 4.1 `backend/store_injector.py` — New Module

```python
import asyncio
import json
import decky
import httpx

class StoreInjector:
    """Manages CDP connection to Steam store webview for button injection."""

    INJECTED_SCRIPT = """..."""  # See Section 4.4
    DISCOVERY_INTERVAL = 3  # seconds
    RECONNECT_DELAY = 2    # seconds after WebSocket close

    def __init__(self):
        self._ws = None
        self._cmd_id = 0
        self._running = False
        self._discovery_task: asyncio.Task | None = None
        self._script_id: str | None = None  # CDP script identifier for cleanup

    async def start(self):
        """Start the discovery loop. Called from Plugin._main()."""
        self._running = True
        self._discovery_task = asyncio.create_task(self._discover_loop())
        decky.logger.info("[StoreInjector] Started")

    async def stop(self):
        """Stop the injector and clean up. Called from Plugin._unload()."""
        self._running = False
        if self._discovery_task:
            self._discovery_task.cancel()
        if self._ws and not self._ws.closed:
            await self._ws.close()
        decky.logger.info("[StoreInjector] Stopped")

    async def _discover_loop(self):
        """Periodically search for the store webview and inject when found."""
        while self._running:
            try:
                tab = await self._find_store_tab()
                if tab:
                    ws_url = tab.get("webSocketDebuggerUrl")
                    if ws_url:
                        decky.logger.info(f"[StoreInjector] Found store tab: {tab.get('title', 'unknown')}")
                        await self._connect_and_inject(ws_url)
                        # Connection closed — wait before retrying
                        await asyncio.sleep(self.RECONNECT_DELAY)
                    else:
                        decky.logger.warn("[StoreInjector] Store tab has no WebSocket URL")
                        await asyncio.sleep(self.DISCOVERY_INTERVAL)
                else:
                    # No store tab found — user may not be on store page
                    await asyncio.sleep(self.DISCOVERY_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as e:
                decky.logger.error(f"[StoreInjector] Discovery error: {e}")
                await asyncio.sleep(self.DISCOVERY_INTERVAL)

    async def _find_store_tab(self) -> dict | None:
        """Query CDP targets for any tab with store.steampowered.com in the URL."""
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
        except Exception as e:
            decky.logger.debug(f"[StoreInjector] CDP discovery failed: {e}")
            return None

    async def _connect_and_inject(self, ws_url: str):
        """Open CDP WebSocket, register binding, inject script, listen for events."""
        import websockets
        try:
            async with websockets.connect(ws_url) as ws:
                self._ws = ws
                self._cmd_id = 0
                decky.logger.info("[StoreInjector] Connected to store webview")

                # 1. Enable Runtime domain (required for bindings)
                await self._send_cdp(ws, "Runtime.enable")

                # 2. Enable Page domain (required for addScriptToEvaluateOnNewDocument)
                await self._send_cdp(ws, "Page.enable")

                # 3. Register binding for download trigger
                await self._send_cdp(ws, "Runtime.addBinding", {
                    "name": "__stplugin_download"
                })

                # 4. Inject script to run on every page load/navigation
                result = await self._send_cdp(ws, "Page.addScriptToEvaluateOnNewDocument", {
                    "source": self.INJECTED_SCRIPT
                })
                if result and "result" in result:
                    self._script_id = result["result"].get("identifier")

                decky.logger.info("[StoreInjector] Script injected, listening for clicks")

                # 4. Listen for Runtime.bindingCalled events
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
                                        decky.logger.info(f"[StoreInjector] Download triggered for app {appid}")
                                        await decky.emit("stplugin_store_download", str(appid))
                                except (ValueError, TypeError):
                                    decky.logger.warn(f"[StoreInjector] Invalid payload: {payload}")
                    except json.JSONDecodeError:
                        pass  # Skip non-JSON messages

        except websockets.exceptions.ConnectionClosed:
            decky.logger.info("[StoreInjector] WebSocket connection closed")
        except Exception as e:
            decky.logger.error(f"[StoreInjector] Connection error: {e}")
        finally:
            self._ws = None

    async def _send_cdp(self, ws, method: str, params: dict = None) -> dict | None:
        """Send a CDP command and wait for the response."""
        self._cmd_id += 1
        msg = {"id": self._cmd_id, "method": method}
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

**Notes:**
- `_find_store_tab()` matches the same criteria as the original (URL contains `store.steampowered.com`), but now returns the full tab object including `webSocketDebuggerUrl`
- The `_send_cdp` method sends a command and waits for the response with matching ID
- `Page.addScriptToEvaluateOnNewDocument` is used instead of `Runtime.evaluate` so the script persists across page navigations
- The discovery loop runs indefinitely (while `_running` is True), reconnecting automatically when the WebSocket drops

### 4.2 `src/patches/storeButton.tsx` — Simplified Rewrite

```typescript
import { addEventListener, removeEventListener, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

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

**Changes from current:**
- **Removed:** `executeInTab`, `callable("find_store_tab")`, `CefTab` interface, `findStoreTab()`, `getInjectedScript()`, the entire retry loop, `window.addEventListener("message", onMessage)`
- **Added:** `addEventListener("stplugin_store_download")` for event-based communication
- **Net change:** 133 lines → ~25 lines

### 4.3 `main.py` — Modified

```python
import decky
import asyncio
from backend.store_injector import StoreInjector

class Plugin:
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self.store_injector = StoreInjector()
        self.loop.create_task(self.store_injector.start())
        # ... existing _main code ...

    async def _unload(self):
        await self.store_injector.stop()
        # ... existing _unload code ...
```

**Changes:**
- **Added:** `StoreInjector` import, instantiation, start/stop lifecycle
- **Removed:** `find_store_tab` method (replaced by `StoreInjector._find_store_tab`)

### 4.4 Injected JavaScript

The injected script is nearly identical to the current version with one change — the button click handler uses CDP binding instead of `postMessage`:

```javascript
(function() {
    if (window.__stplugin_injected) return;
    window.__stplugin_injected = true;

    const BUTTON_ID = 'stplugin-download-btn';
    let currentAppid = '';

    function getAppidFromUrl() {
        const path = window.location.pathname;
        const m = path.match(/\/app\/(\d+)\//);
        return m ? m[1] : null;
    }

    function findPurchaseSection(appid) {
        const forms = document.querySelectorAll('.game_area_purchase_game form');
        for (const form of forms) {
            const subidInput = form.querySelector('input[name="subid"]');
            if (subidInput && subidInput.value === appid) {
                return form.closest('.game_area_purchase_game');
            }
        }
        return document.querySelector('.game_area_purchase_game');
    }

    function injectButton(section) {
        if (!section) return;
        if (document.getElementById(BUTTON_ID)) return;

        const title = section.querySelector('h2.title');
        if (!title) return;

        const btn = document.createElement('a');
        btn.id = BUTTON_ID;
        btn.className = 'btn_green_steamui btn_medium';
        btn.style.marginBottom = '12px';
        btn.style.display = 'inline-block';
        btn.textContent = 'Add via LuaTools';
        btn.onclick = function(e) {
            e.preventDefault();
            // CDP binding — calls Python backend via Runtime.addBinding
            if (typeof __stplugin_download === 'function') {
                __stplugin_download(currentAppid);
            }
        };

        title.parentNode.insertBefore(btn, title.nextSibling);
        console.log('[STPlugin] Button injected for app', currentAppid);
    }

    function checkAndInject() {
        const appid = getAppidFromUrl();
        if (!appid) return;
        if (appid !== currentAppid) {
            currentAppid = appid;
            const oldBtn = document.getElementById(BUTTON_ID);
            if (oldBtn) oldBtn.remove();
        }
        const section = findPurchaseSection(appid);
        injectButton(section);
    }

    checkAndInject();

    const observer = new MutationObserver(checkAndInject);
    observer.observe(document.body, { childList: true, subtree: true });

    let lastUrl = window.location.href;
    new MutationObserver(() => {
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
```

**Diff from current version:**
- Line change: `btn.onclick` handler replaces `window.parent.postMessage(...)` with `__stplugin_download(currentAppid)`
- Guard: `if (typeof __stplugin_download === 'function')` prevents errors if CDP binding isn't registered
- Console message updated to indicate CDP mode

### 4.5 `py_modules/websockets/` — New Dependency

The `websockets` Python package (pure Python, no native extensions) must be bundled in `py_modules/`. This is the standard Decky plugin approach for Python dependencies.

- Package: `websockets` >= 12.0
- Pure Python implementation, works on Windows and Linux
- Used for opening CDP WebSocket connections to the store webview

## 5. Data Flow

### Happy Path

```
1. Plugin loads → Plugin._main() → StoreInjector.start()
2. StoreInjector._discover_loop() polls /json every 3s
3. User navigates to store game page → CEF creates webview
4. Next poll discovers the store webview (URL contains store.steampowered.com)
5. StoreInjector connects to webview via WebSocket (webSocketDebuggerUrl)
6. CDP: Runtime.enable
7. CDP: Page.enable
8. CDP: Runtime.addBinding("__stplugin_download")
9. CDP: Page.addScriptToEvaluateOnNewDocument(INJECTED_SCRIPT)
10. Injected script runs → finds .game_area_purchase_game → inserts button
11. User clicks "Add via LuaTools" button
12. Button onclick calls __stplugin_download("730")
13. CDP fires Runtime.bindingCalled event on WebSocket
14. StoreInjector receives event → extracts appid "730"
15. StoreInjector calls decky.emit("stplugin_store_download", "730")
16. Frontend addEventListener fires → startDownload(730) → toast notification
```

### Store Page Navigation

```
1. User clicks another game on store → webview navigates to new URL
2. Page.addScriptToEvaluateOnNewDocument ensures script re-runs on new page
3. INJECTED_SCRIPT checks window.__stplugin_injected guard
4. Since __stplugin_injected is from old context, it's undefined → script runs again
5. New button injected for new appid
6. No WebSocket reconnection needed — Runtime.addBinding persists across navigations
```

### WebSocket Disconnection

```
1. Store webview closes or CDP WebSocket drops
2. StoreInjector._connect_and_inject() exits the message loop
3. _discover_loop() resumes after RECONNECT_DELAY (2s)
4. If store page is still open, /json still lists the tab → reconnect
5. If store page is closed, _find_store_tab() returns None → wait for user to visit store again
```

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| CDP endpoint unreachable | `httpx.ConnectError` caught in `_find_store_tab()`, logged, retry after 3s |
| Store tab not found | `_find_store_tab()` returns None, retry loop continues silently |
| WebSocket URL missing | Logged warning, skip injection, retry |
| WebSocket connection refused | `ConnectionClosed` exception caught, retry after 2s |
| `Runtime.addBinding` fails | CDP response has `error` field, logged, retry |
| `Page.addScriptToEvaluateOnNewDocument` fails | CDP response has `error` field, logged, retry |
| `Runtime.bindingCalled` with invalid payload | `ValueError`/`TypeError` caught, warning logged, event skipped |
| Plugin reload | `_unload()` cancels tasks, closes WebSocket |
| Double injection guard | `window.__stplugin_injected` prevents re-injection in same context |
| CDP binding not yet registered | `typeof __stplugin_download === 'function'` check prevents ReferenceError |

## 7. Cross-Platform Notes

| Platform | Store Rendering | CDP Target Discovery | Expected Behavior |
|----------|----------------|---------------------|-------------------|
| **Windows BPM** | CEF webview (store.steampowered.com) | Store appears as `/json` target with `webSocketDebuggerUrl` | Full injection via CDP WebSocket |
| **SteamOS (Steam Deck)** | React components in GamepadUI | Store does NOT appear in `/json` as a separate target | `find_store_tab` returns None → no injection (graceful degradation) |

**Note:** On SteamOS, the store is React-rendered within GamepadUI. A future enhancement could add React-based injection as a fallback. This spec only addresses the Windows BPM case.

## 8. Dependency Changes

| Package | Action | Reason |
|---------|--------|--------|
| `websockets` | **Add** to `py_modules/` | CDP WebSocket client for store webview connection |
| `httpx` | Keep (already used) | CDP target discovery via `/json` |
| `@decky/api` executeInTab | **Remove** import | No longer needed |
| `@decky/api` callable("find_store_tab") | **Remove** | Replaced by Python-side CDP discovery |

## 9. Testing Plan

### Unit Tests (Python)

| Test | Description |
|------|-------------|
| `test_find_store_tab_returns_tab` | When /json returns a tab with store URL, returns full tab dict |
| `test_find_store_tab_returns_none_no_store` | When no store tab in /json, returns None |
| `test_find_store_tab_returns_none_error` | When httpx raises ConnectionError, returns None |
| `test_send_cdp_increments_id` | Each call increments the ID counter |
| `test_bindingCalled_parses_appid` | Runtime.bindingCalled with name="__stplugin_download" and payload="730" yields appid=730 |

### Integration Test (Manual)

1. Build: `pnpm run build`
2. Deploy to Windows Decky Loader
3. Restart Steam BPM
4. Navigate to Store → any game page
5. Verify: "Add via LuaTools" button appears after the purchase section title
6. Click button → verify toast: "Downloading Lua for App {appid}..."
7. Navigate to different game → button updates for new appid
8. Reload plugin → button re-injects automatically
9. Check backend logs: `[StoreInjector] Found store tab`, `[StoreInjector] Connected to store webview`, `[StoreInjector] Script injected`
10. Navigate away from store → WebSocket closes gracefully
11. Return to store → WebSocket reconnects, button re-appears

## 10. File Changes Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/store_injector.py` | **Create** | ~150 |
| `backend/__init__.py` | **Modify** | +1 (export) |
| `src/patches/storeButton.tsx` | **Rewrite** | 133→25 |
| `main.py` | **Modify** | +5 (import, lifecycle), -15 (remove find_store_tab) |
| `py_modules/websockets/` | **Add** | Vendored package |
| `tests/test_store_tab.py` | **Rewrite** | Update for StoreInjector |

## 11. Exclusions

- **No React patching fallback** for SteamOS (out of scope for this spec)
- **No dual-mode detection** (CDP vs React) — CDP is the only mode
- **No CSS injection** into the store webview (future enhancement)
- **No store front page (non-game) injection** — only game pages with `.game_area_purchase_game`