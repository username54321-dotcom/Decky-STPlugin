# Discover Installed Scripts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Discover Installed" button that scans the `stplug-in/` directory for `.lua` files, resolves their names and images via Steam APIs, and rebuilds `loadedappids.txt` — with a live-updating modal showing progress.

**Architecture:** Backend async generator yields per-app progress events via `decky.emit()`. Frontend modal listens to events and displays a live-growing list of discovered apps. Uses existing `resolve_app_name()` for names and Steam search suggest API for images.

**Tech Stack:** Python (httpx, pathlib), TypeScript/React, @decky/ui (ModalRoot, Dialog*, showModal, ProgressBar), @decky/api (callable, addEventListener, removeEventListener)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/downloads.py` | Modify | Add `_resolve_image_url()`, `discover_installed()` |
| `main.py` | Modify | Add `discover_installed_apps()` RPC method |
| `src/shared/types.ts` | Modify | Add `DiscoverProgress` interface |
| `src/installed/components/DiscoverModal.tsx` | Create | Modal dialog with live progress |
| `src/InstalledApps.tsx` | Modify | Add "Discover Installed" button |
| `tests/test_discover.py` | Create | Backend unit tests |

---

### Task 1: Backend — `_resolve_image_url()` helper

**Files:**
- Modify: `backend/downloads.py`
- Create: `tests/test_discover.py`

- [ ] **Step 1: Write failing tests for `_resolve_image_url()`**

```python
# tests/test_discover.py
"""Tests for discover_installed feature."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from backend.downloads import _resolve_image_url


class TestResolveImageUrl:
    """Tests for _resolve_image_url()."""

    @pytest.mark.asyncio
    async def test_returns_img_from_first_result(self):
        """Returns img field from first search suggest result."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "730", "name": "Counter-Strike 2", "img": "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg"},
        ]
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Counter-Strike 2")
            assert result == "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg"

    @pytest.mark.asyncio
    async def test_returns_empty_on_no_results(self):
        """Returns empty string when suggest API returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Nonexistent Game")
            assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_on_exception(self):
        """Returns empty string on network error."""
        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.side_effect = Exception("timeout")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Some Game")
            assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_for_empty_name(self):
        """Returns empty string for empty input."""
        result = await _resolve_image_url("")
        assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_img_field(self):
        """Returns empty string when result has no img field."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "730", "name": "Counter-Strike 2"},
        ]
        mock_response.raise_for_status = MagicMock()

        with patch("backend.downloads.httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.get.return_value = mock_response
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = instance

            result = await _resolve_image_url("Counter-Strike 2")
            assert result == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_discover.py::TestResolveImageUrl -v`
Expected: FAIL (import error — `_resolve_image_url` not defined)

- [ ] **Step 3: Implement `_resolve_image_url()`**

Add to `backend/downloads.py` after the `_fix_mojibake()` function (around line 413):

```python
async def _resolve_image_url(app_name: str) -> str:
    """Resolve image URL for a game via Steam search suggest API.

    Returns the img field from the first result, or empty string on failure.
    """
    if not app_name:
        return ""

    _rate_limit()
    url = (
        "https://store.steampowered.com/search/suggest"
        f"?term={app_name}"
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
            if raw and isinstance(raw, list) and len(raw) > 0:
                img = raw[0].get("img", "")
                if img:
                    return str(img)
    except Exception:
        pass
    return ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_discover.py::TestResolveImageUrl -v`
Expected: All 5 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/downloads.py tests/test_discover.py
git commit -m "feat: add _resolve_image_url() helper for discover"
```

---

### Task 2: Backend — `discover_installed()` async generator

**Files:**
- Modify: `backend/downloads.py`
- Modify: `tests/test_discover.py`

- [ ] **Step 1: Write failing tests for `discover_installed()`**

Append to `tests/test_discover.py`:

```python
from backend.downloads import discover_installed


class TestDiscoverInstalled:
    """Tests for discover_installed() async generator."""

    @pytest.mark.asyncio
    async def test_discovers_lua_files(self, tmp_path):
        """Finds .lua files and yields progress events."""
        # Create mock .lua files
        (tmp_path / "730.lua").write_text("-- CS2 lua")
        (tmp_path / "440.lua").write_text("-- TF2 lua")
        (tmp_path / "readme.txt").write_text("not a lua file")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock) as mock_resolve, \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock) as mock_img:
            mock_resolve.side_effect = lambda appid: {730: "Counter-Strike 2", 440: "Team Fortress 2"}.get(appid, "")
            mock_img.return_value = "https://example.com/img.jpg"

            events = []
            async for event in discover_installed():
                events.append(event)

            # Should have: scanning, 2x processing (with appid), done
            assert len(events) >= 4
            assert events[0]["step"] == "scanning"
            assert events[0]["total"] == 2
            assert events[-1]["step"] == "done"
            assert events[-1]["total"] == 2

    @pytest.mark.asyncio
    async def test_yields_error_on_no_steam_path(self):
        """Yields fatal error when Steam path not found."""
        with patch("backend.downloads.get_steam_path", return_value=None):
            events = []
            async for event in discover_installed():
                events.append(event)

            assert len(events) == 1
            assert events[0]["step"] == "error"
            assert "Steam" in events[0]["error"]

    @pytest.mark.asyncio
    async def test_empty_directory_yields_done_zero(self, tmp_path):
        """Yields done with total=0 when no .lua files found."""
        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path):
            events = []
            async for event in discover_installed():
                events.append(event)

            assert len(events) == 1
            assert events[0]["step"] == "done"
            assert events[0]["total"] == 0

    @pytest.mark.asyncio
    async def test_skips_non_numeric_lua_files(self, tmp_path):
        """Only processes files matching {digits}.lua pattern."""
        (tmp_path / "730.lua").write_text("-- valid")
        (tmp_path / "abc.lua").write_text("-- invalid name")
        (tmp_path / "test123.lua").write_text("-- invalid name")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, return_value="CS2"), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in discover_installed():
                events.append(event)

            scanning = [e for e in events if e["step"] == "scanning"]
            assert scanning[0]["total"] == 1  # Only 730.lua

    @pytest.mark.asyncio
    async def test_writes_tracking_file(self, tmp_path):
        """Appends entries to loadedappids.txt as apps are processed."""
        (tmp_path / "730.lua").write_text("-- CS2")

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, return_value="Counter-Strike 2"), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value="https://img.jpg"):
            events = []
            async for event in discover_installed():
                events.append(event)

            tracking_file = tmp_path / "loadedappids.txt"
            assert tracking_file.exists()
            content = tracking_file.read_text(encoding="utf-8")
            assert "730|Counter-Strike 2|https://img.jpg" in content

    @pytest.mark.asyncio
    async def test_continues_on_per_app_error(self, tmp_path):
        """Continues processing other apps when one fails."""
        (tmp_path / "730.lua").write_text("-- ok")
        (tmp_path / "440.lua").write_text("-- ok")

        call_count = 0
        async def resolve_side_effect(appid):
            nonlocal call_count
            call_count += 1
            if appid == 730:
                raise Exception("API error")
            return "Team Fortress 2"

        with patch("backend.downloads.get_steam_path", return_value=str(tmp_path)), \
             patch("backend.downloads.get_lua_dir", return_value=tmp_path), \
             patch("backend.downloads.resolve_app_name", new_callable=AsyncMock, side_effect=resolve_side_effect), \
             patch("backend.downloads._resolve_image_url", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in discover_installed():
                events.append(event)

            done_events = [e for e in events if e["step"] == "done"]
            assert len(done_events) == 1
            assert done_events[0]["total"] == 2  # Both processed (one with fallback name)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_discover.py::TestDiscoverInstalled -v`
Expected: FAIL (import error — `discover_installed` not defined)

- [ ] **Step 3: Implement `discover_installed()`**

Add to `backend/downloads.py` after `_resolve_image_url()`:

```python
import re as _re


async def discover_installed():
    """Scan stplug-in/ for .lua files, resolve names/images, rebuild tracking file.

    Yields progress dicts with structure:
      {"step": "scanning", "total": N}
      {"step": "processing", "current": i, "total": N, "appid": X}
      {"step": "processing", "current": i, "total": N, "appid": X, "app_name": "...", "img_url": "..."}
      {"step": "done", "total": N}
      {"step": "error", "error": "..."}
    """
    steam_path = get_steam_path()
    if not steam_path:
        yield {"step": "error", "total": 0, "current": 0, "message": "Steam installation not found", "error": "Steam installation not found"}
        return

    lua_dir = get_lua_dir(steam_path)
    lua_dir.mkdir(parents=True, exist_ok=True)

    # Scan for {digits}.lua files
    appids = []
    for f in lua_dir.iterdir():
        if f.is_file() and _re.fullmatch(r"\d+\.lua", f.name):
            try:
                appids.append(int(f.stem))
            except ValueError:
                pass

    appids.sort()
    total = len(appids)

    yield {"step": "scanning", "total": total, "current": 0, "message": f"Found {total} Lua scripts"}

    if total == 0:
        yield {"step": "done", "total": 0, "current": 0, "message": "No Lua scripts found"}
        return

    # Clear existing tracking file
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        if tracking_file.exists():
            tracking_file.unlink()
    except OSError:
        pass

    # Process each app
    for i, appid in enumerate(appids, start=1):
        # Emit "processing" before resolution (shows spinner)
        yield {
            "step": "processing",
            "current": i,
            "total": total,
            "appid": appid,
            "message": f"Resolving {appid}...",
        }

        # Resolve name
        try:
            name = await resolve_app_name(appid)
        except Exception:
            name = ""
        if not name:
            name = f"App {appid}"

        # Resolve image
        try:
            img_url = await _resolve_image_url(name)
        except Exception:
            img_url = ""

        # Track installed
        try:
            _track_installed(appid, lua_dir, name, img_url)
        except Exception:
            pass

        # Emit "processing" after resolution (shows resolved app)
        yield {
            "step": "processing",
            "current": i,
            "total": total,
            "appid": appid,
            "app_name": name,
            "img_url": img_url,
            "message": f"Added {name}",
        }

    yield {"step": "done", "total": total, "current": total, "message": f"Discovered {total} scripts"}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_discover.py -v`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `python -m pytest tests/ -v`
Expected: All tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add backend/downloads.py tests/test_discover.py
git commit -m "feat: add discover_installed() async generator"
```

---

### Task 3: Backend — `discover_installed_apps()` RPC method

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add `discover_installed_apps()` to Plugin class**

Add to `main.py` after the `delete_app` method (around line 201), inside the `Plugin` class:

```python
    # ── Discover Installed ──

    async def discover_installed_apps(self) -> dict[str, Any]:
        """Scan stplug-in/ for .lua files, resolve names and images, rebuild tracking file.

        Emits "discover_progress" events during processing.
        Returns {"success": True, "discovered": N} or {"success": False, "error": "..."}.
        """
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

- [ ] **Step 2: Add import for `discover_installed`**

In `main.py`, update the import from `backend.downloads` (around line 22) to include `discover_installed`:

```python
from backend.downloads import (
    resolve_app_name,
    download_lua,
    get_installed_apps,
    remove_lua,
    create_cancel_event,
    cancel_task,
    cleanup_task,
    USER_AGENT,
    discover_installed,
)
```

- [ ] **Step 3: Verify no syntax errors**

Run: `python -c "from main import Plugin; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat: add discover_installed_apps() RPC method"
```

---

### Task 4: Frontend — `DiscoverProgress` type

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `DiscoverProgress` interface**

Add to `src/shared/types.ts` after the `InstalledApp` interface:

```typescript
export interface DiscoverProgress {
  step: "scanning" | "processing" | "done" | "error";
  current: number;
  total: number;
  appid?: number;
  app_name?: string;
  img_url?: string;
  message: string;
  error?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add DiscoverProgress type"
```

---

### Task 5: Frontend — `DiscoverModal.tsx` component

**Files:**
- Create: `src/installed/components/DiscoverModal.tsx`

- [ ] **Step 1: Create `DiscoverModal.tsx`**

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  callable,
  addEventListener,
  removeEventListener,
} from "@decky/api";
import {
  ModalRoot,
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogButton,
  ProgressBar,
  Spinner,
  staticClasses,
} from "@decky/ui";
import { FaGamepad, FaCheckCircle, FaExclamationTriangle, FaSearch } from "react-icons/fa";
import type { DiscoverProgress } from "../../shared/types";
import { COLOR, CARD } from "../../shared/styles";

const discoverInstalledApps = callable<[], { success: boolean; discovered?: number; error?: string }>(
  "discover_installed_apps"
);

interface DiscoveredApp {
  appid: number;
  name: string;
  img_url: string;
}

interface DiscoverModalProps {
  closeModal: () => void;
  onComplete: () => void;
}

export function DiscoverModal({ closeModal, onComplete }: DiscoverModalProps) {
  const [progress, setProgress] = useState<DiscoverProgress | null>(null);
  const [apps, setApps] = useState<DiscoveredApp[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const startedRef = useRef(false);

  // Listen for progress events
  useEffect(() => {
    const handler = (event: DiscoverProgress) => {
      setProgress(event);

      if (event.step === "processing" && event.app_name) {
        // App resolved — add to list
        setApps((prev) => {
          const exists = prev.some((a) => a.appid === event.appid);
          if (exists) return prev;
          return [
            ...prev,
            {
              appid: event.appid!,
              name: event.app_name!,
              img_url: event.img_url || "",
            },
          ];
        });
      }

      if (event.step === "done" || event.step === "error") {
        setIsRunning(false);
      }
    };

    const unlisten = addEventListener<[DiscoverProgress]>("discover_progress", handler);
    return () => {
      removeEventListener("discover_progress", unlisten);
    };
  }, []);

  // Start discover on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    discoverInstalledApps().catch(() => {
      setIsRunning(false);
    });
  }, []);

  const handleClose = useCallback(() => {
    closeModal();
    onComplete();
  }, [closeModal, onComplete]);

  const handleRetry = useCallback(() => {
    setApps([]);
    setProgress(null);
    setIsRunning(true);
    startedRef.current = false;
    discoverInstalledApps().catch(() => {
      setIsRunning(false);
    });
  }, []);

  const isError = progress?.step === "error";
  const isDone = progress?.step === "done";
  const isProcessing = progress?.step === "processing";
  const isScanning = progress?.step === "scanning";

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <ModalRoot closeModal={handleClose}>
      <DialogHeader>Discover Installed Scripts</DialogHeader>
      <DialogBody>
        {/* Status bar */}
        <div style={{ marginBottom: "12px" }}>
          {isScanning && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Spinner width={16} height={16} />
              <span className={staticClasses.Label}>
                Scanning directory...
              </span>
            </div>
          )}
          {isProcessing && progress && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Spinner width={16} height={16} />
                <span className={staticClasses.Label}>
                  Processing {progress.current}/{progress.total}
                </span>
              </div>
              <ProgressBar nPercent={progressPercent} />
            </div>
          )}
          {isDone && progress && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCheckCircle style={{ color: COLOR.success, fontSize: "16px" }} />
              <span className={staticClasses.Label}>
                Discovered {progress.total} scripts
              </span>
            </div>
          )}
          {isError && progress && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "rgba(255, 0, 0, 0.1)",
                borderRadius: CARD.borderRadius,
                border: "1px solid var(--gpSystemRed)",
              }}
            >
              <FaExclamationTriangle style={{ color: "var(--gpSystemRed)", fontSize: "16px" }} />
              <span className={staticClasses.Label} style={{ color: "var(--gpSystemRed)" }}>
                {progress.error || "An error occurred"}
              </span>
            </div>
          )}
        </div>

        {/* Live app list */}
        {apps.length > 0 && (
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {apps.map((app) => (
              <div
                key={app.appid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 8px",
                  background: CARD.background,
                  borderRadius: CARD.borderRadius,
                }}
              >
                {app.img_url ? (
                  <img
                    src={app.img_url}
                    alt={app.name}
                    style={{
                      width: "80px",
                      height: "30px",
                      objectFit: "cover",
                      borderRadius: "2px",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "80px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: COLOR.backgroundHard,
                      borderRadius: "2px",
                      flexShrink: 0,
                    }}
                  >
                    <FaGamepad style={{ color: COLOR.muted, fontSize: "14px" }} />
                  </div>
                )}
                <span
                  className={staticClasses.Label}
                  style={{
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {app.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state during scanning */}
        {apps.length === 0 && !isError && !isDone && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "24px 0",
            }}
          >
            <FaSearch style={{ fontSize: "24px", color: COLOR.muted }} />
            <span style={{ color: COLOR.muted, fontSize: "13px" }}>
              Looking for Lua scripts...
            </span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {isDone && (
          <DialogButton onClick={handleClose}>
            Done
          </DialogButton>
        )}
        {isError && (
          <>
            <DialogButton onClick={handleRetry}>
              Retry
            </DialogButton>
            <DialogButton onClick={handleClose}>
              Close
            </DialogButton>
          </>
        )}
        {isRunning && (
          <DialogButton disabled>
            Processing...
          </DialogButton>
        )}
      </DialogFooter>
    </ModalRoot>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (some may appear for `@decky/ui` — these are expected since Decky types are loose)

- [ ] **Step 3: Commit**

```bash
git add src/installed/components/DiscoverModal.tsx
git commit -m "feat: add DiscoverModal component"
```

---

### Task 6: Frontend — Button in `InstalledApps.tsx`

**Files:**
- Modify: `src/InstalledApps.tsx`

- [ ] **Step 1: Add imports and button to InstalledApps**

Replace the contents of `src/InstalledApps.tsx` with:

```tsx
import { ButtonItem, staticClasses, showModal } from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect, useCallback } from "react";
import { FaBoxOpen, FaExclamationTriangle, FaSync, FaSearch } from "react-icons/fa";
import type { InstalledApp } from "./shared/types";
import { CARD, SPACING } from "./shared/styles";
import { PageLayout } from "./shared/components/PageLayout";
import { InstalledAppCard } from "./installed/components/InstalledAppCard";
import { SkeletonCard } from "./installed/components/SkeletonCard";
import { DiscoverModal } from "./installed/components/DiscoverModal";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

type PageState = "loading" | "loaded" | "error";

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [state, setState] = useState<PageState>("loading");

  const loadApps = async () => {
    setState("loading");
    try {
      const result = await getInstalledApps();
      setApps(result);
      setState("loaded");
    } catch (err) {
      console.warn("[STPlugin] Failed to load installed apps:", err);
      setState("error");
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDeleteSuccess = (appid: number) => {
    setApps((prev) => prev.filter((app) => app.appid !== appid));
  };

  const handleDiscover = useCallback(() => {
    showModal(
      <DiscoverModal
        closeModal={() => {}}
        onComplete={loadApps}
      />,
      undefined,
      {
        strTitle: "Discover Installed Scripts",
        fnOnClose: () => {},
      }
    );
  }, [loadApps]);

  // Loading state
  if (state === "loading") {
    return (
      <PageLayout title="Installed Scripts">
        <style>{`@keyframes skeleton-pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: CARD.gap }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <PageLayout title="Installed Scripts">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            gap: "16px",
            textAlign: "center",
          }}
        >
          <FaExclamationTriangle
            style={{ fontSize: "32px", color: "var(--gpSystemYellow)" }}
          />
          <div className={staticClasses.Label}>
            Failed to load installed scripts.
          </div>
          <ButtonItem onClick={loadApps}>
            <FaSync style={{ marginRight: "8px" }} />
            Retry
          </ButtonItem>
          <ButtonItem onClick={handleDiscover}>
            <FaSearch style={{ marginRight: "8px" }} />
            Discover Installed
          </ButtonItem>
        </div>
      </PageLayout>
    );
  }

  // Empty state
  if (apps.length === 0) {
    return (
      <PageLayout title="Installed Scripts">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            gap: "12px",
            textAlign: "center",
          }}
        >
          <FaBoxOpen
            style={{ fontSize: "40px", color: "var(--gpSystemLighterGrey)" }}
          />
          <div className={staticClasses.Label}>
            No Lua scripts installed yet.
          </div>
          <div style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}>
            Download one from the Search tab, or discover existing scripts.
          </div>
          <ButtonItem onClick={handleDiscover}>
            <FaSearch style={{ marginRight: "8px" }} />
            Discover Installed
          </ButtonItem>
        </div>
      </PageLayout>
    );
  }

  // Loaded state with cards
  return (
    <PageLayout title="Installed Scripts">
      <div style={{ marginBottom: SPACING.sectionGap }}>
        <ButtonItem layout="below" onClick={handleDiscover}>
          <FaSearch style={{ marginRight: "8px" }} />
          Discover Installed
        </ButtonItem>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: CARD.gap }}>
        {apps.map((app) => (
          <InstalledAppCard
            key={app.appid}
            app={app}
            onDelete={handleDeleteSuccess}
          />
        ))}
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (Decky type looseness is expected)

- [ ] **Step 3: Build the plugin**

Run: `pnpm run build`
Expected: Build succeeds, `dist/index.js` produced

- [ ] **Step 4: Commit**

```bash
git add src/InstalledApps.tsx
git commit -m "feat: add Discover Installed button to InstalledApps panel"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full Python test suite**

Run: `python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify the modal opens correctly**

Manual test:
1. Load plugin in Steam Deck / Decky Loader
2. Go to Installed Apps tab
3. Click "Discover Installed" button
4. Verify modal opens with scanning state
5. Verify apps appear one by one
6. Verify "Done" button closes modal and refreshes list

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat: discover installed scripts feature complete"
```
