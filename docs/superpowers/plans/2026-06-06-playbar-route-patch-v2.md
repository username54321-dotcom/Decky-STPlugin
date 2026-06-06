# PlayBar Route Patch v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the PlayBar patch from `findModuleExport` module patching to `routerHook.addPatch` route patching, following the Decky wiki's official pattern and the ProtonDB Badges plugin reference.

**Architecture:** Replace `findModuleExport(LibraryApp)` → `afterPatch(LibraryApp, "type")` with `routerHook.addPatch('/library/app/:appId')` → `findInReactTree(renderFunc)` → `afterPatch(routeProps, "renderFunc")`. The `ScriptStatusIcon` component, cache logic, fingerprints, and navigation state bridge remain unchanged.

**Tech Stack:** TypeScript, React, `@decky/ui` (`afterPatch`, `createReactTreePatcher`, `findInReactTree`, `Navigation`), `@decky/api` (`routerHook`, `callable`, `addEventListener`, `removeEventListener`)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/patches/PlayBarPatch.tsx` | **Rewrite** | Route patch registration, `ScriptStatusIcon` component, installed-apps cache, download event listener. Export `patchLibraryApp`, `removeAppid`, `refreshCache`. |
| `src/index.tsx` | **Modify** | Import `patchLibraryApp` replacing `registerPlayBarPatch`. Same registration pattern (async `.then()`). |
| `openspec/specs/frontend.md` | **Modify** | Update PlayBar Patch section to document route patching approach. |
| `openspec/specs/architecture.md` | **No change** | Existing entry `PlayBarPatch.tsx` at line 36 is correct; no structural changes. |

---

### Task 1: Rewrite `PlayBarPatch.tsx` — Route-based patching

**Files:**
- Modify: `src/patches/PlayBarPatch.tsx` (full rewrite of the `registerPlayBarPatch` function)

- [ ] **Step 1: Add `routerHook` import, remove `findModuleExport` import**

Open `src/patches/PlayBarPatch.tsx`. Change the imports at lines 1-8:

```typescript
import React, { useEffect, useState } from "react";
import {
  afterPatch,
  createReactTreePatcher,
  findInReactTree,
  Navigation,
} from "@decky/ui";
import { callable, addEventListener, removeEventListener, routerHook } from "@decky/api";
import { FaCheck, FaDownload } from "react-icons/fa";
import { ROUTES } from "../shared/constants";
import { setPendingAppid } from "../shared/navigationState";
import type { InstalledApp } from "../shared/types";
```

Removes: `findModuleExport` from `@decky/ui` imports.
Adds: `routerHook` from `@decky/api` imports.

- [ ] **Step 2: Replace `registerPlayBarPatch` with `patchLibraryApp`**

Replace lines 90-157 (the `let _unpatch` line through the end of `registerPlayBarPatch`) with:

```typescript
export async function patchLibraryApp(): Promise<() => void> {
  await refreshCache();

  const downloadListener = addEventListener(
    "download_progress",
    (_taskId: string, data: any) => {
      if (data?.phase === "done" && data?.appid) {
        addAppid(data.appid);
      }
    }
  );

  const patchRef = routerHook.addPatch(
    "/library/app/:appId",
    (tree: any) => {
      // Find the route renderer component (has renderFunc)
      const routeProps = findInReactTree(tree, (x: any) => x?.renderFunc);
      if (!routeProps) {
        console.warn("[STPlugin] Could not find route renderer in tree — PlayBar icon disabled");
        return tree;
      }

      const handler = createReactTreePatcher(
        [
          (subtree: any) =>
            findInReactTree(subtree, (node: any) => {
              const str = node?.type?.toString?.() || "";
              return PLAY_BAR_FINGERPRINTS.some((fp) => str.includes(fp));
            }),
        ],
        (args: any[]) => {
          const [props, ret] = args;
          const appid = props?.appid ?? props?.nAppID ?? props?.appId;
          if (!appid || !ret?.props?.children) return ret;

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
      );

      afterPatch(routeProps, "renderFunc", handler);
      return tree;
    }
  );

  console.log("[STPlugin] PlayBar route patch registered");

  return () => {
    routerHook.removePatch("/library/app/:appId", patchRef);
    removeEventListener("download_progress", downloadListener);
    console.log("[STPlugin] PlayBar route patch unregistered");
  };
}
```

- [ ] **Step 3: Update exports at bottom of file**

The exports at line 159 currently export `refreshCache` and `removeAppid`. Replace with:

```typescript
export { patchLibraryApp, refreshCache, removeAppid };
```

Wait — `refreshCache` and `removeAppid` are already exported at line 159 via named function declarations. Verify the file ends with:

```typescript
export { refreshCache, removeAppid };
```

Change to:

```typescript
export { patchLibraryApp, refreshCache, removeAppid };
```

> Note: `patchLibraryApp` is the new public export replacing `registerPlayBarPatch`. `refreshCache` and `removeAppid` remain unchanged.

- [ ] **Step 4: Verify the file is internally consistent**

Check that no reference to `_unpatch`, `registerPlayBarPatch`, `findModuleExport`, or `LibraryApp` remains in the file. Run:

```bash
rg "(_unpatch|registerPlayBarPatch|findModuleExport|LibraryApp)" src/patches/PlayBarPatch.tsx
```

Expected: **no matches**

---

### Task 2: Update `index.tsx` — Wire up new patch function

**Files:**
- Modify: `src/index.tsx` (import and call site only)

- [ ] **Step 1: Update the import at line 17**

Open `src/index.tsx`. Change line 17 from:

```typescript
import { registerPlayBarPatch } from "./patches/PlayBarPatch";
```

To:

```typescript
import { patchLibraryApp } from "./patches/PlayBarPatch";
```

- [ ] **Step 2: Update the call site at lines 122-123**

Change lines 122-123 from:

```typescript
  registerPlayBarPatch().then((cleanup) => {
```

To:

```typescript
  patchLibraryApp().then((cleanup) => {
```

The rest of the block (lines 121, 123-124) remains identical:
```typescript
  let cleanupPlayBarPatch: (() => void) | null = null;
  patchLibraryApp().then((cleanup) => {
    cleanupPlayBarPatch = cleanup;
  });
```

- [ ] **Step 3: Verify cleanup in `onDismount`**

Check line 137. It should still read:

```typescript
      cleanupPlayBarPatch?.();
```

This remains correct — the returned cleanup function from `patchLibraryApp` internally calls both `routerHook.removePatch` and `removeEventListener`.

- [ ] **Step 4: Verify no stale references in index.tsx**

Run:

```bash
rg "registerPlayBarPatch" src/index.tsx
```

Expected: **no matches**

---

### Task 3: Update OpenSpec living specs

**Files:**
- Modify: `openspec/specs/frontend.md` (lines 33-41)

- [ ] **Step 1: Update the PlayBar Patch section**

Open `openspec/specs/frontend.md`. Replace lines 33-41:

```
## PlayBar Patch

Uses `findModuleExport` + `afterPatch` + `createReactTreePatcher` to inject a script-status icon into Steam's library PlayBar:
- Finds LibraryApp module, patches its render to walk the tree for PlayBar
- Multi-fingerprint fallback: "PlayBar", "PlayButton", "GameActions", "AppActions"
- Injects `<ScriptStatusIcon>` component next to the play button
- Icon shows green checkmark if Lua script installed, gray download arrow if not
- Click navigates to installed panel (if installed) or download panel with appid pre-filled (if not)
- Installed appids cached in module-level Set, refreshed on download/delete events
```

With:

```
## PlayBar Patch

Uses `routerHook.addPatch` (route patching) + `afterPatch` + `createReactTreePatcher` to inject a script-status icon into Steam's library PlayBar:
- Hooks into `/library/app/:appId` route via `routerHook.addPatch`
- Finds the route renderer (`renderFunc`) in the React tree
- Patches `renderFunc` to walk the rendered tree for PlayBar
- Multi-fingerprint fallback: "PlayBar", "PlayButton", "GameActions", "AppActions"
- Injects `<ScriptStatusIcon>` component next to the play button
- Icon shows green checkmark if Lua script installed, gray download arrow if not
- Click navigates to installed panel (if installed) or download panel with appid pre-filled (if not)
- Installed appids cached in module-level Set, refreshed on download/delete events
- Cleanup via `routerHook.removePatch` in `onDismount`
```

- [ ] **Step 2: Verify architecture.md needs no change**

Run:

```bash
rg "PlayBarPatch" openspec/specs/architecture.md
```

Expected: Match at line 36. The file structure hasn't changed — `src/patches/PlayBarPatch.tsx` still exists with the same role. No edit needed.

---

### Task 4: Build and test

**Files:**
- No changes — verification only

- [ ] **Step 1: Run the build**

```bash
pnpm run build
```

Expected: **build succeeds**, produces `dist/index.js`, no TypeScript errors.

- [ ] **Step 2: Run the test suite**

```bash
pnpm test
```

Expected: **all 37 tests pass** (same test count — no new tests needed for React tree patching since it's not unit-testable).

- [ ] **Step 3: Check for any new console warnings in build output**

Review the build output for any warnings about unused imports (removed `findModuleExport`) or missing exports (new `patchLibraryApp`).

Expected: **no new warnings**

---

### Task 5: Commit all changes

**Files:**
- `src/patches/PlayBarPatch.tsx`
- `src/index.tsx`
- `openspec/specs/frontend.md`

- [ ] **Step 1: Stage the changes**

```bash
git add src/patches/PlayBarPatch.tsx src/index.tsx openspec/specs/frontend.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: migrate PlayBar patch from findModuleExport to routerHook.addPatch"
```

- [ ] **Step 3: Verify clean working tree**

```bash
git status
```

Expected: **working tree clean** (only the committed files, no untracked changes related to this feature).

---

## Self-Review Checklist

- [x] Spec coverage: All requirements from `2026-06-06-playbar-route-patch-v2-design.md` are covered:
  - Route patching entry point (Task 1)
  - renderFunc discovery + afterPatch (Task 1)
  - createReactTreePatcher + fingerprint matching (Task 1)
  - Cleanup via routerHook.removePatch (Task 1)
  - index.tsx integration (Task 2)
  - Living spec updates (Task 3)
  - Build/test verification (Task 4)
- [x] Placeholder scan: No TBD, TODO, or vague instructions. All code is concrete.
- [x] Type consistency: `patchLibraryApp()` returns `Promise<() => void>`, consumed in `index.tsx` via `.then()` — matches the existing pattern exactly. `routerHook.addPatch` returns a patch ref used in `routerHook.removePatch` — matches Decky API.
