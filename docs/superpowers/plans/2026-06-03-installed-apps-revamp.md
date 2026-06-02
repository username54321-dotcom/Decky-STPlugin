# Installed Apps Page Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the Installed Apps page with card layout, capsule images, disk-based name caching, and bug fixes.

**Architecture:** Backend changes add name caching to `loadedappids.txt` and fix the delete bug. Frontend changes replace the flat list with card components showing capsule images, loading skeletons, and proper empty/error states.

**Tech Stack:** Python (backend), TypeScript/React (frontend), Decky UI components (`@decky/ui`, `@decky/api`)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/downloads.py` | Modify | Add `_remove_loaded_app()`, update `_track_installed()` to store names, update `get_installed_apps()` to parse names, add parallel resolution |
| `main.py` | Modify | Update `get_installed_apps()` to use parallel resolution |
| `src/shared/styles.ts` | Modify | Add card-specific style constants |
| `src/installed/InstalledAppCard.tsx` | Create | Card component for individual app |
| `src/installed/SkeletonCard.tsx` | Create | Loading skeleton component |
| `src/installed/InstalledApps.tsx` | Rewrite | Complete rewrite with card layout, states, and error handling |

---

### Task 1: Fix Delete Bug — Add `_remove_loaded_app()`

**Files:**
- Modify: `backend/downloads.py:415-424`

- [ ] **Step 1: Add `_remove_loaded_app()` function**

Add this function before `remove_lua()` in `backend/downloads.py`:

```python
def _remove_loaded_app(appid: int) -> None:
    """Remove appid from the loaded app tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return
    tracking_file = get_lua_dir(steam_path) / "loadedappids.txt"
    if not tracking_file.exists():
        return
    lines = tracking_file.read_text().splitlines()
    prefix = f"{appid}:"
    new_lines = [line for line in lines if not line.strip().startswith(prefix)]
    # Also handle legacy format (plain appid without name)
    new_lines = [line for line in new_lines if line.strip() != str(appid)]
    if len(new_lines) != len(lines):
        tracking_file.write_text("\n".join(new_lines) + "\n")
```

- [ ] **Step 2: Update `remove_lua()` to call `_remove_loaded_app()`**

Replace the existing `remove_lua()` function:

```python
def remove_lua(appid: int) -> bool:
    """Delete the .lua file and remove from tracking for the given app ID."""
    steam_path = get_steam_path()
    if not steam_path:
        return False
    lua_file = get_lua_dir(steam_path) / f"{appid}.lua"
    if lua_file.exists():
        lua_file.unlink()
    _remove_loaded_app(appid)
    return True
```

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "fix: remove appid from tracking file on delete"
```

---

### Task 2: Update `_track_installed()` to Store Names

**Files:**
- Modify: `backend/downloads.py:375-386`

- [ ] **Step 1: Update `_track_installed()` signature and implementation**

Replace the existing function:

```python
def _track_installed(appid: int, lua_dir: Path, name: str = "") -> None:
    """Append appid:name to loaded app tracking file."""
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        existing = set()
        if tracking_file.exists():
            for line in tracking_file.read_text().splitlines():
                existing.add(line.strip())
        entry = f"{appid}:{name}" if name else str(appid)
        if entry not in existing:
            with tracking_file.open("a", encoding="utf-8") as f:
                f.write(f"{entry}\n")
    except Exception:
        pass
```

- [ ] **Step 2: Update `download_lua()` to pass name to `_track_installed()`**

In `backend/downloads.py`, find the call to `_track_installed(appid, lua_dir)` (around line 297) and update it to resolve and pass the name:

```python
                    # Track installed app with name
                    app_name = await resolve_app_name(appid)
                    _track_installed(appid, lua_dir, app_name)
```

- [ ] **Step 3: Update `start_download_from_url()` in `main.py` to pass name**

In `main.py`, find the call to `_track_installed(appid, lua_dir)` (around line 165) and update it:

```python
                from backend.downloads import _track_installed, resolve_app_name
                app_name = await resolve_app_name(appid)
                _track_installed(appid, lua_dir, app_name)
```

- [ ] **Step 4: Commit**

```bash
git add backend/downloads.py main.py
git commit -m "feat: store app name in tracking file on install"
```

---

### Task 3: Update `get_installed_apps()` to Parse Names

**Files:**
- Modify: `backend/downloads.py:397-412`

- [ ] **Step 1: Update `get_installed_apps()` to parse `appid:name` format**

Replace the existing function:

```python
def get_installed_apps() -> list[dict[str, Any]]:
    """Return list of installed app IDs from the tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return []
    lua_dir = get_lua_dir(steam_path)
    tracking_file = lua_dir / "loadedappids.txt"
    if not tracking_file.exists():
        return []

    apps = []
    for line in tracking_file.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            # New format: appid:name
            parts = line.split(":", 1)
            try:
                appid = int(parts[0])
                name = parts[1] if len(parts) > 1 else ""
                apps.append({"appid": appid, "name": name})
            except ValueError:
                continue
        elif line.isdigit():
            # Legacy format: plain appid
            apps.append({"appid": int(line), "name": ""})
    return apps
```

- [ ] **Step 2: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: parse app names from tracking file"
```

---

### Task 4: Parallel Name Resolution in `main.py`

**Files:**
- Modify: `main.py:185-190`

- [ ] **Step 1: Update `get_installed_apps()` to use parallel resolution**

Replace the existing method in the `Plugin` class:

```python
    async def get_installed_apps(self) -> list[dict[str, Any]]:
        """Return list of installed Lua scripts with resolved names."""
        apps = get_installed_apps()
        # Only resolve names for apps missing them
        uncached = [app for app in apps if not app.get("name")]
        if uncached:
            names = await asyncio.gather(
                *[resolve_app_name(app["appid"]) for app in uncached]
            )
            for app, name in zip(uncached, names):
                app["name"] = name
        return apps
```

- [ ] **Step 2: Commit**

```bash
git add main.py
git commit -m "perf: parallel name resolution for uncached apps"
```

---

### Task 5: Add Card Styles to `styles.ts`

**Files:**
- Modify: `src/shared/styles.ts`

- [ ] **Step 1: Add card-specific style constants**

Add to the end of `src/shared/styles.ts`:

```typescript
export const CARD = {
  background: "var(--gpBackgroundLight)",
  border: "1px solid var(--gpBackgroundMedium)",
  borderRadius: "8px",
  padding: "12px",
  gap: "8px",
  hoverBackground: "var(--gpBackgroundMedium)",
  capsuleWidth: "120px",
  capsuleHeight: "45px",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/styles.ts
git commit -m "feat: add card style constants"
```

---

### Task 6: Create `InstalledAppCard` Component

**Files:**
- Create: `src/installed/InstalledAppCard.tsx`

- [ ] **Step 1: Create the InstalledAppCard component**

```tsx
import { ButtonItem, staticClasses, ControlsList, ConfirmModal, showModal } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState } from "react";
import { FaTrash, FaRedo, FaGamepad, FaExclamationTriangle } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";
import { CARD, SPACING } from "../shared/styles";

const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

interface InstalledAppCardProps {
  app: InstalledApp;
  onDelete: (appid: number) => void;
}

export function InstalledAppCard({ app, onDelete }: InstalledAppCardProps) {
  const [imgError, setImgError] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const capsuleUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${app.appid}/capsule_231x87.jpg`;

  const handleDelete = () => {
    showModal(
      <ConfirmModal
        strTitle="Delete Script?"
        strDescription={`Delete ${app.name || `App ${app.appid}`}? This cannot be undone.`}
        strOKButtonText="Delete"
        strCancelButtonText="Cancel"
        bDestructiveWarning={true}
        onOK={async () => {
          const ok = await deleteApp(app.appid);
          if (ok) {
            toaster.toast({ title: "STPlugin", body: `Deleted ${app.name || `App ${app.appid}`}` });
            onDelete(app.appid);
          } else {
            toaster.toast({ title: "Error", body: "Failed to delete script" });
          }
        }}
      />
    );
  };

  const handleRedownload = async () => {
    setDownloadError(false);
    try {
      await startDownload(app.appid);
      toaster.toast({ title: "STPlugin", body: `Re-downloading ${app.name || `App ${app.appid}`}...` });
    } catch {
      setDownloadError(true);
      toaster.toast({ title: "Error", body: "Failed to re-download script" });
    }
  };

  return (
    <div
      style={{
        background: CARD.background,
        border: downloadError ? "1px solid var(--gpSystemRed)" : CARD.border,
        borderRadius: CARD.borderRadius,
        padding: CARD.padding,
        display: "flex",
        gap: CARD.padding,
        alignItems: "flex-start",
        cursor: downloadError ? "pointer" : "default",
      }}
      onClick={downloadError ? handleRedownload : undefined}
    >
      {/* Capsule Image */}
      <div style={{ flexShrink: 0, width: CARD.capsuleWidth, height: CARD.capsuleHeight }}>
        {imgError ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
            }}
          >
            <FaGamepad style={{ color: "var(--gpSystemLighterGrey)", fontSize: "20px" }} />
          </div>
        ) : (
          <img
            src={capsuleUrl}
            alt={app.name || `App ${app.appid}`}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "4px",
            }}
          />
        )}
      </div>

      {/* App Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={staticClasses.Label}
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {app.name || `App ${app.appid}`}
        </div>
        <div
          style={{
            color: "var(--gpSystemLighterGrey)",
            fontSize: "12px",
            marginTop: "2px",
          }}
        >
          App ID: {app.appid}
        </div>
        {downloadError && (
          <div
            style={{
              color: "var(--gpSystemRed)",
              fontSize: "12px",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaExclamationTriangle style={{ fontSize: "10px" }} />
            Download failed — click to retry
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ flexShrink: 0, display: "flex", gap: SPACING.controlsGap }}>
        <ButtonItem layout="below" onClick={handleRedownload}>
          <FaRedo />
        </ButtonItem>
        <ButtonItem layout="below" onClick={handleDelete}>
          <FaTrash />
        </ButtonItem>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/installed/InstalledAppCard.tsx
git commit -m "feat: add InstalledAppCard component"
```

---

### Task 7: Create `SkeletonCard` Component

**Files:**
- Create: `src/installed/SkeletonCard.tsx`

- [ ] **Step 1: Create the SkeletonCard component**

```tsx
import React from "react";
import { CARD } from "../shared/styles";

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`;

export function SkeletonCard() {
  return (
    <>
      <style>{pulseKeyframes}</style>
      <div
        style={{
          background: CARD.background,
          border: CARD.border,
          borderRadius: CARD.borderRadius,
          padding: CARD.padding,
          display: "flex",
          gap: CARD.padding,
          alignItems: "flex-start",
        }}
      >
        {/* Capsule placeholder */}
        <div
          style={{
            flexShrink: 0,
            width: CARD.capsuleWidth,
            height: CARD.capsuleHeight,
            background: "var(--gpBackgroundMedium)",
            borderRadius: "4px",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />

        {/* Text placeholders */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              height: "14px",
              width: "70%",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "10px",
              width: "40%",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.2s",
            }}
          />
        </div>

        {/* Button placeholders */}
        <div style={{ flexShrink: 0, display: "flex", gap: "8px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.4s",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "var(--gpBackgroundMedium)",
              borderRadius: "4px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite 0.6s",
            }}
          />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/installed/SkeletonCard.tsx
git commit -m "feat: add SkeletonCard loading component"
```

---

### Task 8: Rewrite `InstalledApps.tsx`

**Files:**
- Rewrite: `src/installed/InstalledApps.tsx`

- [ ] **Step 1: Rewrite InstalledApps.tsx**

```tsx
import { ButtonItem, staticClasses } from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaBoxOpen, FaExclamationTriangle, FaSync } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";
import { CARD, SPACING } from "../shared/styles";
import { PageLayout } from "../shared/components/PageLayout";
import { InstalledAppCard } from "./InstalledAppCard";
import { SkeletonCard } from "./SkeletonCard";

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

  // Loading state
  if (state === "loading") {
    return (
      <PageLayout title="Installed Scripts">
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
            Download one from the Search tab.
          </div>
        </div>
      </PageLayout>
    );
  }

  // Loaded state with cards
  return (
    <PageLayout title="Installed Scripts">
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

- [ ] **Step 2: Commit**

```bash
git add src/installed/InstalledApps.tsx
git commit -m "feat: rewrite InstalledApps with card layout and states"
```

---

### Task 9: Verify Build

- [ ] **Step 1: Run build**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify installed apps revamp build"
```
