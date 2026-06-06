# Design: Discover Progress Bar Per-Game Increment

**Date**: 2026-06-06
**Status**: Approved
**Approach**: A — consolidate to one event per game + event loop yield

## Problem

When discovering locally installed Lua scripts via "Discover Installed," the progress bar stays at 0% throughout the operation and only jumps to 100% when complete. Users expect the bar to increment once per game discovered.

### Root Cause

Two factors:
1. `discover_installed()` yields **two** `"processing"` events per game — one before name resolution (no `app_name`) and one after (with `app_name`). Both have the same `current` value, so the bar doesn't visually move between them for a given game.
2. The rapid emission of events combined with React 18 automatic batching can cause multiple state updates to coalesce, showing only the final state.

## Design

### Files Changed

| File | Change |
|------|--------|
| `backend/downloads.py` | Remove duplicate pre-resolution `yield` in `discover_installed()` |
| `main.py` | Add `await asyncio.sleep(0)` after `decky.emit()` in `discover_installed_apps()` |
| `tests/test_discover.py` | Update test expectations if needed |

**Zero frontend changes.** The `DiscoverModal` component already handles per-game events correctly via `setProgress()`.

### Change 1: `backend/downloads.py` — `discover_installed()`

Remove lines 481-487 — the first `yield` block inside the per-app loop that emits `{step: "processing", current: i, ...}` with no `app_name`. After the change, only one `"processing"` event is yielded per game, after name and image resolution complete.

**Before** (pseudocode):
```
for each appid:
    yield { step: "processing", current: i, message: "Resolving..." }  ← REMOVED
    resolve name (HTTP)
    resolve image (HTTP)
    yield { step: "processing", current: i, app_name, img_url }         ← KEPT
```

**After** (pseudocode):
```
for each appid:
    resolve name (HTTP)
    resolve image (HTTP)
    yield { step: "processing", current: i, total: N, app_name, img_url }
```

### Change 2: `main.py` — `discover_installed_apps()`

Add `await asyncio.sleep(0)` after each `decky.emit()` to force the event loop to yield control and flush pending IPC messages:

```python
async for event in discover_installed():
    await decky.emit("discover_progress", event)
    await asyncio.sleep(0)  # ← ADDED
    if event.get("step") == "error":
        return {"success": False, "error": event.get("error", "Unknown error")}
    if event.get("step") == "done":
        total = event.get("total", 0)
```

### Data Flow (After Change)

```
User clicks "Discover Installed"
  → discoverInstalledApps() IPC call
  → Python discover_installed_apps()
      → scan directory
      → emit "scanning" event  → sleep(0) → frontend: spinner
      → for each appid:
          → HTTP resolve name + image
          → emit "processing" event (current=i, app_name) → sleep(0)
          → frontend: progress bar moves to i/N*100%
      → emit "done" event → sleep(0) → frontend: checkmark
```

### Event Sequence (Before vs After)

| Before | After |
|--------|-------|
| scanning (current=0) | scanning (current=0) |
| processing (current=1, no name) | — |
| processing (current=1, with name) | processing (current=1, with name) |
| processing (current=2, no name) | — |
| processing (current=2, with name) | processing (current=2, with name) |
| ... | ... |
| done (current=N) | done (current=N) |

**Result**: Exactly one progress bar increment per discovered game.

## Error Handling

No changes needed. The existing `try/except` in `discover_installed_apps()` catches all failures. The `asyncio.sleep(0)` cannot throw. Name resolution failures produce `name = f"App {appid}"` as fallback, which is still emitted as a valid event.

## Testing

- Update `tests/test_discover.py` if it asserts two processing events per appid
- Verify that the discover flow still completes successfully
- Manually verify the progress bar increments per game in the Decky UI

## Scope

This is a single, focused change. No refactoring, no new dependencies, no frontend changes.
