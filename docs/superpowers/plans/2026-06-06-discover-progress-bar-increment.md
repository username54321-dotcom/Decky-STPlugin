# Discover Progress Bar Per-Game Increment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the discover progress bar increment once per game discovered, instead of staying at 0% until all games are complete.

**Architecture:** Two backend-only changes. Remove the duplicate pre-resolution `yield` in `discover_installed()` so each game emits one `"processing"` event instead of two. Add `await asyncio.sleep(0)` after each `decky.emit()` in `discover_installed_apps()` to force the event loop to flush pending IPC messages. No frontend changes needed.

**Tech Stack:** Python 3.10+, asyncio, Decky plugin framework

---

### File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/downloads.py:480-514` | Modify | Remove the first `yield` block in the per-app loop (lines 481-487) |
| `main.py:237-238` | Modify | Add `await asyncio.sleep(0)` after `decky.emit()` in `discover_installed_apps()` |

No new files. No frontend changes.

---

### Task 1: Remove duplicate pre-resolution event in `discover_installed()`

**Files:**
- Modify: `backend/downloads.py:480-514`

- [ ] **Step 1: Remove the first `yield` block in the per-app loop**

In `backend/downloads.py`, inside `discover_installed()`, locate the `for i, appid in enumerate(appids, start=1):` loop (line 480). Delete lines 481-487 — the first `yield` that emits `{step: "processing", current: i, ...}` without `app_name`.

The loop body currently looks like this:

```python
# Process each app
for i, appid in enumerate(appids, start=1):
    yield {
        "step": "processing",
        "current": i,
        "total": total,
        "appid": appid,
        "message": f"Resolving {appid}...",
    }

    try:
        name = await resolve_app_name(appid)
    except Exception:
        name = ""
    if not name:
        name = f"App {appid}"

    try:
        img_url = await _resolve_image_url(name)
    except Exception:
        img_url = ""

    try:
        _track_installed(appid, lua_dir, name, img_url)
    except Exception:
        pass

    yield {
        "step": "processing",
        "current": i,
        "total": total,
        "appid": appid,
        "app_name": name,
        "img_url": img_url,
        "message": f"Added {name}",
    }
```

Change it to:

```python
# Process each app
for i, appid in enumerate(appids, start=1):
    try:
        name = await resolve_app_name(appid)
    except Exception:
        name = ""
    if not name:
        name = f"App {appid}"

    try:
        img_url = await _resolve_image_url(name)
    except Exception:
        img_url = ""

    try:
        _track_installed(appid, lua_dir, name, img_url)
    except Exception:
        pass

    yield {
        "step": "processing",
        "current": i,
        "total": total,
        "appid": appid,
        "app_name": name,
        "img_url": img_url,
        "message": f"Added {name}",
    }
```

- [ ] **Step 2: Run existing discover tests to verify they still pass**

```bash
cd D:\Git\Decky-STPlugin
pytest tests/test_discover.py -v
```

Expected: All 8 tests pass. The `test_discovers_lua_files` test uses `assert len(events) >= 4`, which remains valid (4 events: scanning, 2 processing, done).

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "fix: remove duplicate pre-resolution event in discover_installed"
```

---

### Task 2: Add event loop yield in `discover_installed_apps()`

**Files:**
- Modify: `main.py:238`

- [ ] **Step 1: Add `await asyncio.sleep(0)` after the emit**

In `main.py`, inside the `discover_installed_apps` method, add `await asyncio.sleep(0)` on a new line after `await decky.emit("discover_progress", event)`.

Current code (lines 236-250):

```python
total = 0
try:
    async for event in discover_installed():
        await decky.emit("discover_progress", event)
        if event.get("step") == "error":
            return {"success": False, "error": event.get("error", "Unknown error")}
        if event.get("step") == "done":
            total = event.get("total", 0)
    return {"success": True, "discovered": total}
except Exception as exc:
    decky.logger.error(f"discover_installed_apps failed: {exc}")
    await decky.emit("discover_progress", {
        "step": "error", "total": 0, "current": 0,
        "message": str(exc), "error": str(exc),
    })
    return {"success": False, "error": str(exc)}
```

Change to:

```python
total = 0
try:
    async for event in discover_installed():
        await decky.emit("discover_progress", event)
        await asyncio.sleep(0)
        if event.get("step") == "error":
            return {"success": False, "error": event.get("error", "Unknown error")}
        if event.get("step") == "done":
            total = event.get("total", 0)
    return {"success": True, "discovered": total}
except Exception as exc:
    decky.logger.error(f"discover_installed_apps failed: {exc}")
    await decky.emit("discover_progress", {
        "step": "error", "total": 0, "current": 0,
        "message": str(exc), "error": str(exc),
    })
    return {"success": False, "error": str(exc)}
```

- [ ] **Step 2: Verify `asyncio` is already imported in `main.py`**

Check that `import asyncio` exists at the top of `main.py`. It should already be there (used elsewhere). If missing, add it.

- [ ] **Step 3: Run all tests**

```bash
cd D:\Git\Decky-STPlugin
pytest tests/ -v
```

Expected: All 37 tests pass.

- [ ] **Step 4: Verify the build still produces output**

```bash
cd D:\Git\Decky-STPlugin && pnpm run build
```

Expected: Build succeeds, `dist/index.js` produced.

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "fix: yield event loop after each discover_progress emit"
```
