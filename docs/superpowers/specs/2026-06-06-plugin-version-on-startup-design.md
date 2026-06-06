# Design: Plugin Version on Startup

**Date**: 2026-06-06
**Status**: Approved
**Approach**: Option 1 — dedicated `get_plugin_version` IPC method

## Problem

After every Steam restart, the Settings panel shows `"Current Version: 0.1.0"` instead of the real version (`1.0.3`). The version only corrects itself after the user manually clicks "Check for Updates" (calls GitHub API) or the 2-hour background update timer fires. This means the version display is wrong 100% of the time on fresh startup.

### Root Cause

`src/update/hooks/useUpdateStatus.ts` line 11 hardcodes `currentVersion: "0.1.0"` as the initial React state. This stale value was set when the auto-update system was first prototyped and never updated to match `package.json` (`"version": "1.0.3"`).

The only ways the version gets updated to the real value are:
1. User clicks "Check for Updates" → calls `check_for_updates()` IPC → Python reads `decky.DECKY_PLUGIN_VERSION`
2. Background `update_available` event fires → carries `current_version` from Python

Both require a network call to GitHub API. Neither happens automatically on plugin mount. So the hardcoded fallback persists indefinitely.

## Design

### Overview

Add a lightweight IPC method `get_plugin_version()` that returns `decky.DECKY_PLUGIN_VERSION` (the true version source of truth). The frontend calls it once on mount to initialize `currentVersion`, replacing the stale hardcoded value.

No network calls are needed. The version is served from the Python runtime's `decky` module, which Decky Loader populates from `package.json` at plugin load time.

### Files Changed

| File | Change | Lines |
|------|--------|-------|
| `main.py` | Add `get_plugin_version()` method on `Plugin` class | +3 |
| `src/update/hooks/useUpdateStatus.ts` | Add callable binding + on-mount effect | +10 |
| `openspec/specs/api-contracts.md` | Document new IPC call | +5 |
| `openspec/specs/backend.md` | Document new backend method | +3 |
| `tests/test_version.py` (new) | Unit test for the IPC method | +~15 |

### Change 1: `main.py` — New IPC Method

Insert after the `install_update` method (after line 422):

```python
async def get_plugin_version(self) -> str:
    """Return the current plugin version from decky.DECKY_PLUGIN_VERSION."""
    return getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0")
```

- Uses same safe `getattr` pattern as `backend/auto_update.py:_get_current_version()`
- No new imports needed (`decky` already imported on line 14)
- Returns `"0.0.0"` as fallback if `DECKY_PLUGIN_VERSION` is somehow unset (should never happen in practice)

### Change 2: `useUpdateStatus.ts` — Fetch Version on Mount

**New callable binding** (after line 6, alongside existing `checkForUpdates` and `installUpdate`):

```typescript
const getPluginVersion = callable<[], string>("get_plugin_version");
```

**New on-mount effect** to fetch the real version as soon as the component mounts:

```typescript
useEffect(() => {
    getPluginVersion()
        .then(version => {
            setStatus(prev => ({ ...prev, currentVersion: version }));
        })
        .catch(() => {
            // Silently keep the hardcoded fallback — no worse than today
        });
}, []);
```

**Why keep the hardcoded `"0.1.0"` fallback?** Defensive programming. If the IPC call fails (e.g., backend crash during startup), the fallback ensures the UI always shows something rather than an empty string. The IPC call resolves within the same microtask (local Python call over loopback), so the flash of stale version is imperceptible in practice.

### Data Flow

```
Plugin loads after Steam restart
  → SettingsPanel mounts
  → useUpdateStatus initializes state with currentVersion: "0.1.0" (fallback)
  → useEffect fires
  → getPluginVersion() IPC call
  → Python: get_plugin_version() → getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0") → "1.0.3"
  → setStatus({ currentVersion: "1.0.3" })
  → SettingsPanel re-renders → "Current Version: 1.0.3" ✅
```

The existing `checkForUpdates()` and `update_available` event continue to work as before. They may override `currentVersion` later (should be the same value), but that's harmless.

### Error Handling

| Failure | Behavior |
|---------|----------|
| IPC call fails (timeout, network, backend not ready) | Silently fall back to hardcoded `"0.1.0"` — same as today |
| `DECKY_PLUGIN_VERSION` environment variable not set | `getattr` returns `"0.0.0"` as fallback |
| `checkForUpdates` later overrides | Works correctly — version gets updated again (should match) |

### Testing

**New file: `tests/test_version.py`**

```python
"""Tests for the get_plugin_version IPC method."""

import decky
from main import Plugin

@pytest.mark.asyncio
async def test_get_plugin_version():
    plugin = Plugin()
    version = await plugin.get_plugin_version()
    assert version == decky.DECKY_PLUGIN_VERSION
    assert isinstance(version, str)
    assert len(version) > 0
```

The existing `conftest.py` mock sets `DECKY_PLUGIN_VERSION = "0.1.0"`, so the test will verify against that value. When the mock is updated to match the real version in CI, the test passes automatically.

## Scope

This is a small, focused change. No refactoring, no new dependencies, no network calls, no configuration changes. The existing auto-update system is untouched — it still works exactly as before.
