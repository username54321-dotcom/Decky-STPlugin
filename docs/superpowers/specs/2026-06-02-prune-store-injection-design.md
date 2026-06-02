# Prune Store Page Injection — Design Spec

**Date:** 2026-06-02
**Status:** Approved

## Objective

Remove all store page button injection code (frontend, backend, tests) from the project. The plugin becomes purely a QAM-based Lua script downloader with zero store page integration.

## Motivation

The store button injection feature went through three architectural iterations (React patch → `executeInTab` → Python CDP WebSocket) and remains problematic on Windows BPM overlay where the store page is an embedded CEF webview. The feature is being dropped entirely to simplify the plugin surface area.

## Scope

### DELETE (3 files + 1 directory)

| File | Location | Purpose |
|------|----------|---------|
| `storeButton.tsx` | `src/patches/` | Event listener for CDP-emitted download events |
| `store_injector.py` | `backend/` | Python CDP WebSocket injection into Steam store webview |
| `test_store_injector.py` | `tests/` | Unit tests for StoreInjector |
| `src/patches/` | — | Directory becomes empty after `storeButton.tsx` removal → delete |

### EDIT (3 files)

#### 1. `src/index.tsx`

**Remove (line 22):**
```tsx
import { registerStoreButtonPatch } from "./patches/storeButton";
```

**Remove (line 63):**
```tsx
const storeButtonUnpatch = registerStoreButtonPatch();
```

**Remove (line 76):**
```tsx
storeButtonUnpatch?.unpatch?.();
```

**Clean unused imports** — `addEventListener`, `removeEventListener`, `callable`, `toaster` are not used directly in `index.tsx` (child components import their own):

```tsx
// BEFORE
import {
  definePlugin,
  callable,
  addEventListener,
  removeEventListener,
  toaster,
  routerHook,
} from "@decky/api";

// AFTER
import {
  definePlugin,
  routerHook,
} from "@decky/api";
```

Expected result: ~79 lines → ~68 lines.

#### 2. `main.py`

**Remove import (line 14):**
```python
from backend.store_injector import StoreInjector
```

**Remove from `_main` (lines 69-72):**
```python
# Start store page button injection
self._store_injector = StoreInjector()
self.loop = asyncio.get_event_loop()
self.loop.create_task(self._store_injector.start())
```

**Remove from `_unload` (lines 83-84):**
```python
if hasattr(self, "_store_injector"):
    await self._store_injector.stop()
```

All other Plugin methods (`get_steam_path`, `get_app_name`, `start_download`, `cancel_download`, `get_installed_apps`, `delete_app`, `get_api_sources`, `refresh_api_manifest`, `get_settings`, `set_setting`) remain unchanged.

Expected result: 225 lines → ~213 lines.

#### 3. `AGENTS.md`

| Section | Lines | Action |
|---------|-------|--------|
| Current State warning | 11 | Remove store button redesign warning paragraph |
| Feature Scope KEEP | 30 | Remove "store page button injection (React patch)" |
| Rule #5 | 52 | Remove store webview exception; simplify to "No direct DOM manipulation in GamepadUI" |
| Store Page Architecture | 94-122 | Delete entire section (diagram, consequences, Steam Deck note) |
| Project Structure | 61 | Remove `patches/` from directory tree |

### NO CHANGE

All other files remain untouched:
- `src/components/DownloadPanel.tsx`, `InstalledApps.tsx`, `SettingsPanel.tsx`
- `backend/downloads.py`, `api_manifest.py`, `steam_paths.py`
- All other `tests/` files
- `plugin.json`, `package.json`, `tsconfig.json`, `rollup.config.js`
- All `docs/` files (historical record)

## Architecture After Cleanup

```
Decky-STPlugin/
├── src/                        # TypeScript/React frontend
│   ├── index.tsx               # definePlugin() entry point + QAM panel
│   └── components/             # QAM panel components
│       ├── DownloadPanel.tsx   # "Download Lua Script" panel
│       ├── InstalledApps.tsx   # "Installed Scripts" panel
│       └── SettingsPanel.tsx   # "Settings" panel
├── backend/                    # Python modules
│   ├── downloads.py            # Download pipeline
│   ├── api_manifest.py         # API source management
│   └── steam_paths.py          # Steam directory resolution
├── main.py                     # Python Plugin class
├── tests/                      # Python tests (excluding test_store_injector.py)
├── plugin.json                 # Decky manifest
├── package.json                # pnpm + @decky deps
├── tsconfig.json               # TypeScript config
├── rollup.config.js            # @decky/rollup preset
├── docs/                       # Project documentation
└── ltsteamplugin/              # Millennium reference (gitignored)
```

## Verification

After implementation, confirm:

1. `pnpm build` succeeds with zero errors
2. `pytest tests/` — all remaining tests pass (expect ~14 from original 17)
3. `rg -li "storeButton|store_injector|StoreInjector|stplugin_store_download" --glob "*.ts" --glob "*.tsx" --glob "*.py" --glob "*.json" | rg -v "^docs/"` returns zero results
4. `src/patches/` directory no longer exists
5. Plugin loads without errors (no import failures for missing modules)
