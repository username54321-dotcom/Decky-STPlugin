# PlayBar Script Status Icon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject a clickable icon next to the Play button in Steam's library game details page that indicates whether a Lua script is installed for that game.

**Architecture:** Patch Steam's `LibraryApp` React component via `findModuleExport` + `afterPatch` + `createReactTreePatcher` to inject a `ScriptStatusIcon` into the PlayBar. Cache installed appids in a module-level `Set<number>` refreshed on download/delete events. No backend changes required.

**Tech Stack:** TypeScript, React, `@decky/ui`, `@decky/api`, `react-icons`

**Spec:** `docs/superpowers/specs/2026-06-06-playbar-script-icon-design.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/navigationState.ts` | Create | Module-level appid passing for QAM navigation |
| `src/patches/PlayBarPatch.tsx` | Create | PlayBar patch registration + ScriptStatusIcon component |
| `src/index.tsx` | Modify | Register patch on load, unpatch on unload |
| `src/DownloadForm.tsx` | Modify | Accept optional initial appid from navigation state |

---

### Task 1: Create Navigation State Module

**Files:**
- Create: `src/shared/navigationState.ts`

This module provides a simple way to pass the appid from the PlayBar icon click to the DownloadForm when navigating between QAM panels.

- [ ] **Step 1: Create the navigation state module**

```ts
// src/shared/navigationState.ts

/**
 * Module-level state for passing an appid between QAM panels.
 * Used by PlayBarPatch to pre-fill the DownloadForm when
 * the user clicks the "not installed" icon.
 */

let _pendingAppid: number | null = null;

/** Store an appid to be consumed by the next panel that reads it. */
export function setPendingAppid(appid: number): void {
  _pendingAppid = appid;
}

/** Read and consume the pending appid (returns null if none). */
export function getPendingAppid(): number | null {
  const id = _pendingAppid;
  _pendingAppid = null;
  return id;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm run build`
Expected: Build succeeds (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add src/shared/navigationState.ts
git commit -m "feat: add navigation state module for QAM panel appid passing"
```

---

### Task 2: Create PlayBar Patch Module

**Files:**
- Create: `src/patches/PlayBarPatch.tsx`

This is the core of the feature. It contains:
1. The installed appids cache
2. The `ScriptStatusIcon` React component
3. The `registerPlayBarPatch()` function that patches LibraryApp

- [ ] **Step 1: Create the PlayBarPatch module**

```tsx
// src/patches/PlayBarPatch.tsx

import React, { useEffect, useState } from "react";
import {
  afterPatch,
  createReactTreePatcher,
  findModuleExport,
  findInReactTree,
  Navigation,
} from "@decky/ui";
import { callable,addEventListener } from "@decky/api";
import { FaCheck, FaDownload } from "react-icons/fa";
import { ROUTES } from "../shared/constants";
import { setPendingAppid } from "../shared/navigationState";
import type { InstalledApp } from "../shared/types";

// ── Backend callables ──

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

// ── Installed appids cache ──

let _installedAppids: Set<number> = new Set();

async function refreshCache(): Promise<void> {
  try {
    const apps = await getInstalledApps();
    _installedAppids = new Set(apps.map((a) => a.appid));
  } catch {
    console.warn("[STPlugin] Failed to refresh installed apps cache");
  }
}

function addAppid(appid: number): void {
  _installedAppids.add(appid);
}

function removeAppid(appid: number): void {
  _installedAppids.delete(appid);
}

// ── ScriptStatusIcon component ──

function ScriptStatusIcon({ appid }: { appid: number }) {
  const [installed, setInstalled] = useState(_installedAppids.has(appid));

  // Re-check cache on each render (cache may have been updated)
  useEffect(() => {
    setInstalled(_installedAppids.has(appid));
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (installed) {
      Navigation.Navigate(ROUTES.installed);
    } else {
      setPendingAppid(appid);
      Navigation.Navigate(ROUTES.download);
    }
  };

  const iconStyle: React.CSSProperties = {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    marginLeft: "8px",
    borderRadius: "4px",
    background: installed ? "rgba(92, 184, 92, 0.15)" : "rgba(150, 150, 150, 0.15)",
    transition: "background 0.15s ease",
  };

  return (
    <div
      key="stplugin-status"
      onClick={handleClick}
      style={iconStyle}
      title={installed ? "Lua script installed — click to manage" : "No Lua script — click to download"}
    >
      {installed ? (
        <FaCheck style={{ color: "#5cb85c", fontSize: "12px" }} />
      ) : (
        <FaDownload style={{ color: "#a0a0a0", fontSize: "12px" }} />
      )}
    </div>
  );
}

// ── PlayBar fingerprints ──

const PLAY_BAR_FINGERPRINTS = [
  "PlayBar",
  "PlayButton",
  "GameActions",
  "AppActions",
];

// ── Patch registration ──

let _unpatch: (() => void) | null = null;

/**
 * Register the PlayBar patch to inject ScriptStatusIcon next to the play button.
 * Call once at plugin startup. Returns a cleanup function.
 */
export async function registerPlayBarPatch(): Promise<() => void> {
  // Populate cache on startup
  await refreshCache();

  // Listen for download completion events to update cache
  const downloadListener = addEventListener(
    "download_progress",
    (_taskId: string, data: any) => {
      if (data?.phase === "done" && data?.appid) {
        addAppid(data.appid);
      }
    }
  );

  // Find LibraryApp module
  const LibraryApp = findModuleExport((e: any) =>
    e?.toString?.()?.includes("LibraryApp")
  );

  if (!LibraryApp) {
    console.warn("[STPlugin] Could not find LibraryApp module — PlayBar icon disabled");
    return () => {
      downloadListener?.unregister?.();
    };
  }

  // Patch LibraryApp → PlayBar
  _unpatch = afterPatch(
    LibraryApp,
    "type",
    createReactTreePatcher(
      [
        (tree: any) =>
          findInReactTree(tree, (node: any) => {
            const str = node?.type?.toString?.() || "";
            return PLAY_BAR_FINGERPRINTS.some((fp) => str.includes(fp));
          }),
      ],
      ([props, ret]: [any, any]) => {
        const appid = props?.appid ?? props?.nAppID ?? props?.appId;
        if (!appid || !ret?.props?.children) return ret;

        // Avoid duplicate injection
        const children = Array.isArray(ret.props.children)
          ? ret.props.children
          : [ret.props.children];
        const alreadyInjected = children.some(
          (c: any) => c?.key === "stplugin-status"
        );
        if (alreadyInjected) return ret;

        ret.props.children = [
          ...children,
          <ScriptStatusIcon key="stplugin-status" appid={Number(appid)} />,
        ];
        return ret;
      },
      "LibraryApp:PlayBar"
    )
  );

  console.log("[STPlugin] PlayBar patch registered");

  // Return cleanup function
  return () => {
    _unpatch?.();
    _unpatch = null;
    downloadListener?.unregister?.();
    console.log("[STPlugin] PlayBar patch unregistered");
  };
}

/** Exported for use by other modules (e.g., after delete). */
export { refreshCache, removeAppid };
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm run build`
Expected: Build succeeds (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add src/patches/PlayBarPatch.tsx
git commit -m "feat: add PlayBar patch with ScriptStatusIcon component"
```

---

### Task 3: Register Patch in Plugin Entry Point

**Files:**
- Modify: `src/index.tsx`

Wire the PlayBar patch into the plugin lifecycle: register on load, unpatch on unload.

- [ ] **Step 1: Add import for registerPlayBarPatch**

Add to the imports at the top of `src/index.tsx`:

```ts
import { registerPlayBarPatch, refreshCache, removeAppid } from "./patches/PlayBarPatch";
```

- [ ] **Step 2: Register patch in definePlugin factory**

In the `definePlugin(() => { ... })` factory function, after the route registrations (after line 118), add:

```ts
  // Register PlayBar patch (async — runs in background)
  let cleanupPlayBarPatch: (() => void) | null = null;
  registerPlayBarPatch().then((cleanup) => {
    cleanupPlayBarPatch = cleanup;
  });
```

- [ ] **Step 3: Add cleanup to onDismount**

In the `onDismount()` function (after line 134), add:

```ts
      cleanupPlayBarPatch?.();
```

- [ ] **Step 4: Verify the file compiles**

Run: `pnpm run build`
Expected: Build succeeds (no TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "feat: register PlayBar patch in plugin lifecycle"
```

---

### Task 4: Update DownloadForm to Accept Initial AppID

**Files:**
- Modify: `src/DownloadForm.tsx`

The DownloadForm needs to read the pending appid from navigation state on mount and pre-fill the input.

- [ ] **Step 1: Add import for getPendingAppid**

Add to the imports at the top of `src/DownloadForm.tsx`:

```ts
import { getPendingAppid } from "./shared/navigationState";
```

- [ ] **Step 2: Add useEffect to read pending appid**

In the `DownloadForm` component, after the existing `useEffect` hooks (after line 50), add:

```ts
  // Pre-fill appid from navigation state (e.g., PlayBar icon click)
  useEffect(() => {
    const pending = getPendingAppid();
    if (pending !== null) {
      setAppidInput(String(pending));
    }
  }, []);
```

- [ ] **Step 3: Verify the file compiles**

Run: `pnpm run build`
Expected: Build succeeds (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add src/DownloadForm.tsx
git commit -m "feat: DownloadForm accepts initial appid from navigation state"
```

---

### Task 5: Wire Cache Refresh on Delete

**Files:**
- Modify: `src/InstalledApps.tsx` (line 36 — `handleDeleteSuccess` function)

When a user deletes a script from the Installed Apps panel, the PlayBar cache should be updated so the icon changes state. The delete flow: `InstalledAppCard` → `deleteApp()` callable → `onDelete()` callback → `handleDeleteSuccess()` in `InstalledApps.tsx`.

- [ ] **Step 1: Add import for removeAppid**

Add to the imports at the top of `src/InstalledApps.tsx`:

```ts
import { removeAppid } from "./patches/PlayBarPatch";
```

- [ ] **Step 2: Call removeAppid in handleDeleteSuccess**

Modify the `handleDeleteSuccess` function (line 36-38) to also update the PlayBar cache:

```ts
  const handleDeleteSuccess = (appid: number) => {
    setApps((prev) => prev.filter((app) => app.appid !== appid));
    removeAppid(appid);
  };
```

- [ ] **Step 3: Verify the file compiles**

Run: `pnpm run build`
Expected: Build succeeds (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add src/InstalledApps.tsx
git commit -m "feat: update PlayBar cache on script delete"
```

---

### Task 6: Full Build Verification

- [ ] **Step 1: Run the full build**

Run: `pnpm run build`
Expected: Build succeeds, `dist/index.js` is produced

- [ ] **Step 2: Run existing backend tests**

Run: `pytest tests/ -v`
Expected: All 37 tests pass (no backend changes, so no regressions)

- [ ] **Step 3: Commit any fixes if needed**

---

### Task 7: Update OpenSpec Living Specs

**Files:**
- Modify: `openspec/specs/frontend.md`
- Modify: `openspec/specs/architecture.md`

Per the project's OpenSpec workflow, update the living specs to reflect the new PlayBar patch feature.

- [ ] **Step 1: Update frontend.md — add PlayBar Patch section**

Add a new section documenting the PlayBar patch:

```markdown
### PlayBar Patch
Uses `findModuleExport` + `afterPatch` + `createReactTreePatcher` to inject a script-status icon into Steam's library PlayBar:
- Finds LibraryApp module, patches its render to walk the tree for PlayBar
- Multi-fingerprint fallback: "PlayBar", "PlayButton", "GameActions", "AppActions"
- Injects `<ScriptStatusIcon>` component next to the play button
- Icon shows green checkmark if Lua script installed, gray download arrow if not
- Click navigates to installed panel (if installed) or download panel with appid pre-filled (if not)
- Installed appids cached in module-level Set, refreshed on download/delete events
```

- [ ] **Step 2: Update architecture.md — add new files to file structure**

Add to the file structure section:

```
src/patches/
  PlayBarPatch.tsx        # PlayBar patch + ScriptStatusIcon component
src/shared/
  navigationState.ts      # Module-level appid passing for QAM navigation
```

- [ ] **Step 3: Commit**

```bash
git add openspec/specs/frontend.md openspec/specs/architecture.md
git commit -m "docs: update OpenSpec living specs for PlayBar patch feature"
```

---

### Task 8: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

Update the project status and feature scope to reflect the new PlayBar patch feature.

- [ ] **Step 1: Update feature scope table**

In the "Feature Scope (Decided)" table, add the PlayBar icon to the KEEP list:

```markdown
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection, **game name search** (Steam suggest proxy + dropdown UI), **Steam restart button** (main menu + post-download prompt), **PlayBar script status icon** (library game page indicator + context-aware navigation) |
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with PlayBar patch feature"
```

---

### Task 9: Manual Testing Checklist

These steps require a running Decky Loader instance on a Steam Deck or Windows Decky setup.

- [ ] **Step 1: Install the plugin**

Copy the built `dist/` to the Decky plugins directory and restart Steam.

- [ ] **Step 2: Verify icon appears on library game page**

Navigate to any game in the library. The PlayBar should show a small icon next to the Play button.

- [ ] **Step 3: Verify "not installed" state**

For a game without a Lua script, the icon should show a gray download arrow.

- [ ] **Step 4: Verify click navigates to download panel**

Click the gray download icon. The QAM should open to the Download panel with the game's appid pre-filled.

- [ ] **Step 5: Verify "installed" state**

For a game with an existing Lua script, the icon should show a green checkmark.

- [ ] **Step 6: Verify click navigates to installed panel**

Click the green checkmark icon. The QAM should open to the Installed Apps panel.

- [ ] **Step 7: Verify icon updates after download**

Download a script for a game. Return to the library page. The icon should now show a green checkmark.

- [ ] **Step 8: Verify icon updates after delete**

Delete a script from the Installed Apps panel. Return to the library page. The icon should now show a gray download arrow.

- [ ] **Step 9: Verify graceful degradation**

If the PlayBar fingerprint doesn't match (e.g., Steam update), verify no crash occurs. The icon simply won't appear.

- [ ] **Step 10: Verify unpatch on unload**

Disable/unload the plugin. The icon should disappear from the PlayBar.

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `src/shared/navigationState.ts` | Create navigation state module |
| 2 | `src/patches/PlayBarPatch.tsx` | Create PlayBar patch + ScriptStatusIcon |
| 3 | `src/index.tsx` | Register patch in plugin lifecycle |
| 4 | `src/DownloadForm.tsx` | Accept initial appid from navigation state |
| 5 | `src/InstalledApps.tsx` | Wire cache refresh on delete |
| 6 | — | Full build verification |
| 7 | `openspec/specs/frontend.md`, `openspec/specs/architecture.md` | Update OpenSpec living specs |
| 8 | `AGENTS.md` | Update project status |
| 9 | — | Manual testing checklist |
