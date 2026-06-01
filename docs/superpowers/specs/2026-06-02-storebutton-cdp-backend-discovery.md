# Store Button CDP Backend Discovery — Design Spec

**Date:** 2026-06-02
**Status:** Approved
**Supersedes:** `2026-06-02-store-webview-injection-design.md` (partial — only the `findStoreTab` section)

## 1. Problem

The `findStoreTab()` function in `src/patches/storeButton.tsx` calls `fetch("http://localhost:8080/json")` from the frontend (origin `https://steamloopback.host`). Decky's backend at `localhost:8080` does not return CORS headers, causing the fetch to be blocked:

```
Access to fetch at 'http://localhost:8080/json' from origin 'https://steamloopback.host'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

The frontend runs in Steam's CEF context (origin `steamloopback.host`), while Decky's CDP endpoint (`http://localhost:8080/json`) is a different origin. Browsers block cross-origin requests without proper CORS headers. Since we can't read an opaque response, the `no-cors` workaround won't help.

## 2. Solution

**Move CDP tab discovery from the TypeScript frontend to the Python backend**, where `localhost:8080` is same-host (no CORS). The frontend calls the backend via `callable`, receives the store tab ID, and proceeds with the existing `executeInTab` injection.

This is a **two-line change to the frontend** (replace `findStoreTab` with a `callable`) and a **~20-line addition to the Python Plugin class**.

## 3. Architecture

```
┌─ Frontend (TypeScript) ─────────────────────────┐
│                                                  │
│  registerStoreButtonPatch()                      │
│    │                                             │
│    ├─ tryInject() retry loop                     │
│    │   ├─ findStoreTab() ──callable──┐           │
│    │   │   (was: fetch /json)         │           │
│    │   ├─ executeInTab(tabId, ...)   │           │
│    │   └─ setTimeout(retry, 2000)    │           │
│    │                                  │           │
│    └─ window.addEventListener(       │           │
│         "message", onMessage)         │           │
└──────────────────────────────────────┼───────────┘
                                       │
                          RPC via WebSocket
                                       │
┌─ Backend (Python) ───────────────────┼───────────┐
│                                      ▼            │
│  class Plugin:                                    │
│    async find_store_tab() -> str | None:          │
│      httpx.get("http://localhost:8080/json")      │
│      → parse tabs → find store.steampowered.com   │
│      → return tab["id"] or None                   │
└──────────────────────────────────────────────────┘
```

Everything else — `executeInTab`, the injected script (`getInjectedScript()`), the `postMessage` bridge, the retry loop, and the cleanup — remains **unchanged**.

## 4. Component Changes

### 4.1 `main.py` — New `find_store_tab` callable

Add one async method to the `Plugin` class:

```python
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

- Uses `httpx` (already imported in `main.py` for `start_download_from_url`, line 130)
- Timeout: 5 seconds per attempt (retry loop handles longer waits)
- Returns `None` for any failure — frontend retries

### 4.2 `src/patches/storeButton.tsx` — Replace `findStoreTab` function

**Remove** the `findStoreTab` function (lines 12-24) and the `CefTab` interface (lines 5-10).

**Replace** with a single callable:

```typescript
const findStoreTab = callable<[], string | null>("find_store_tab");
```

The rest of the file — `getInjectedScript()` (lines 26-105), `registerStoreButtonPatch()` (lines 107-153) — stays **completely unchanged**.

### 4.3 No other files changed

- `src/index.tsx` — unchanged (already imports and calls `registerStoreButtonPatch`)
- `plugin.json` — unchanged
- Backend modules (`downloads.py`, `api_manifest.py`, `steam_paths.py`) — unchanged

## 5. Data Flow

### Happy Path

1. Plugin loads → `registerStoreButtonPatch()` starts retry loop
2. User navigates to store game page → CEF webview created
3. Next retry tick → frontend calls `findStoreTab()` → Python fetches `localhost:8080/json` → returns tab ID
4. Frontend calls `executeInTab(tabId, false, getInjectedScript())`
5. Injected script runs in webview → finds `.game_area_purchase_game` → inserts "Add via LuaTools" button
6. User clicks button → `window.parent.postMessage({ stplugin_download: appid })`
7. Frontend `message` listener fires → calls `startDownload(appid)` → toast appears

### Error Paths

| Scenario | Handling |
|---|---|
| Port 8080 unreachable | `httpx.ConnectError` → caught, logged, returns `None` → frontend retries |
| `/json` returns non-200 | `resp.raise_for_status()` → exception → returns `None` |
| Response not valid JSON | `.json()` raises → caught → returns `None` |
| No store tab in list | Returns `None` → frontend retries up to 15 attempts |
| Tab ID is empty string | Returns `None` → frontend retries |
| `executeInTab` fails | Logged to console; no retry (tab exists but injection failed) |

All error paths are **non-fatal**. After 15 failures (30 seconds total), the retry loop gives up with a console warning.

## 6. Testing

### Unit Test (Python)

```python
async def test_find_store_tab():
    """Verify find_store_tab extracts the correct tab ID from CDP JSON."""
    mock_tabs = [
        {"id": "ABC123", "url": "https://steamloopback.host/", "type": "page", "title": "Steam"},
        {"id": "STORE_TAB_ID", "url": "https://store.steampowered.com/app/730/?IN_CLIENT=true", "type": "page", "title": "CS2 on Steam"},
    ]
    mock_resp = Mock()
    mock_resp.json.return_value = mock_tabs
    mock_resp.raise_for_status.return_value = None
    
    with patch("httpx.AsyncClient.get", AsyncMock(return_value=mock_resp)):
        result = await plugin.find_store_tab()
    
    assert result == "STORE_TAB_ID"
```

### Manual Verification (Windows Decky)

1. Load plugin in Windows Decky Loader
2. Check console: no more CORS errors
3. Navigate to a store game page (e.g., CS2)
4. Verify console: `[STPlugin] Store injection script deployed to tab <id>`
5. Verify green "Add via LuaTools" button appears below the purchase section title
6. Click the button → verify toast: "Downloading Lua for App 730..."
7. Check console: no errors

## 7. Cross-Platform Notes

- **Windows BPM (primary):** CEF webview store → this fix is essential
- **Steam Deck (SteamOS):** Store is React-rendered → `executeInTab` may still work, but the React patch approach would be preferred. This spec doesn't address that path — it only fixes the broken tab discovery for the CDP injection path.

## 8. Exclusions

- No change to the injected script or `postMessage` bridge
- No change to the retry loop logic (keep 15 attempts, 2s interval)
- No change to `executeInTab` usage
- No new dependencies (httpx already in use)
- No dual-path (React + CDP) implementation — out of scope
