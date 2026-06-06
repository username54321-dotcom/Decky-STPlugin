# PlayBar Script Status Icon — Design Spec

**Date:** 2026-06-06  
**Status:** Approved  
**Feature:** Inject a clickable icon next to the Play button in Steam's library game details page indicating whether a Lua script is installed for that game.

---

## Overview

This feature patches Steam's `LibraryApp` React component to inject a `ScriptStatusIcon` next to the play button in the library game details page (GamepadUI). The icon shows whether a Lua script is installed for the current game and provides context-aware navigation to the download or installed apps panel.

## Target

**Library game details page** — the React-based page where users click "Play" to launch a game. This is NOT the store game page (which is a CEF webview and cannot be React-patched).

## Approach

**PlayBar patch + `get_installed_apps()` cache** — no backend changes required.

- Patch `LibraryApp` via `findModuleExport` + `afterPatch` + `createReactTreePatcher`
- Cache installed appids in a module-level `Set<number>`
- Inject `ScriptStatusIcon` component into the PlayBar render output

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/patches/PlayBarPatch.tsx` | Patch registration logic + `ScriptStatusIcon` React component |
| `src/shared/navigationState.ts` | Module-level appid passing for navigation between QAM panels |

### Modified Files

| File | Change |
|------|--------|
| `src/index.tsx` | Register patch on plugin load, unpatch on unload |
| `src/DownloadForm.tsx` | Accept optional initial appid from navigation state |

### No Backend Changes

Reuses existing `get_installed_apps()` callable method.

---

## Component Discovery

### Finding LibraryApp

```ts
import { findModuleExport, afterPatch, createReactTreePatcher, findInReactTree } from "@decky/ui";

const LibraryApp = findModuleExport((e) =>
  e?.toString?.()?.includes("LibraryApp")
);
```

### Finding PlayBar (Multi-Fingerprint Fallback)

Steam's internal component names can change across versions. The patch uses multiple fingerprints:

```ts
const PLAY_BAR_FINGERPRINTS = [
  "PlayBar",
  "PlayButton",
  "GameActions",
  "AppActions",
];

const unpatch = afterPatch(
  LibraryApp,
  "type",
  createReactTreePatcher(
    [
      (tree) => findInReactTree(tree, (node) => {
        const str = node?.type?.toString?.() || "";
        return PLAY_BAR_FINGERPRINTS.some(fp => str.includes(fp));
      }),
    ],
    ([props, ret]) => {
      const appid = props?.appid ?? props?.nAppID ?? props?.appId;
      if (!appid || !ret?.props?.children) return ret;

      // Inject icon
      ret.props.children.push(
        <ScriptStatusIcon key="stplugin-status" appid={Number(appid)} />
      );
      return ret;
    },
    "LibraryApp:PlayBar"
  )
);
```

### Getting the AppID

The `createReactTreePatcher` callback receives `[props, ret]` where `props` is the matched component's props object. Multiple prop names are tried:

- `props.appid`
- `props.nAppID`
- `props.appId`

If none found, skip injection (graceful degradation).

---

## ScriptStatusIcon Component

### Visual States

| State | Icon | Color | Meaning |
|-------|------|-------|---------|
| Installed | ✅ Checkmark | Green | Lua script exists for this game |
| Not installed | ⬇️ Download | Gray | No Lua script found |

Uses `react-icons` icons consistent with the existing plugin (e.g., `FaCheck` / `FaDownload`).

### Click Behavior

| State | Action |
|-------|--------|
| Installed | Navigate to `/stplugin/installed` (Installed Apps panel) |
| Not installed | Set pending appid, navigate to `/stplugin/download` (Download panel with appid pre-filled) |

### Sizing

Small icon, matching Steam's native button sizing. No custom CSS injection — uses inline styles or Decky's built-in styling.

---

## Installed Apps Cache

### Data Structure

```ts
// Module-level in PlayBarPatch.tsx
let _installedAppids: Set<number> = new Set();
```

### Population

- **At plugin startup:** Call `get_installed_apps()`, build Set from returned appids
- **On download complete:** Listen for `download_progress` event with `phase: "done"`, add appid to Set
- **On app delete:** After `delete_app()` callable succeeds, remove appid from Set

### Why Not Per-Render IPC

Calling `get_installed_apps()` on every PlayBar render would be wasteful. The tracking file is small and changes infrequently. A cached Set with event-driven refresh is efficient and always up-to-date for the current session.

---

## Navigation State

### Module: `src/shared/navigationState.ts`

```ts
let _pendingAppid: number | null = null;

export function setPendingAppid(appid: number): void {
  _pendingAppid = appid;
}

export function getPendingAppid(): number | null {
  const id = _pendingAppid;
  _pendingAppid = null; // consume once
  return id;
}
```

### Usage Flow

1. User clicks "not installed" icon
2. `setPendingAppid(appid)` stores the appid
3. `Navigation.Navigate(ROUTES.download)` navigates to download panel
4. `DownloadForm` calls `getPendingAppid()` on mount
5. If non-null, pre-fills the appid input field

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Plugin unload | `unpatch()` called in `onDismount()` — icon disappears cleanly |
| No fingerprint matches | Log warning, skip injection — no crash, icon simply doesn't appear |
| AppID not in props | Try multiple prop names, skip if none found — graceful degradation |
| `get_installed_apps()` fails | Default to "not installed" state — icon shows download icon |
| Navigation fails | Log error — no crash |

---

## Data Flow

```
Plugin loads
  ├─ registerPlayBarPatch()
  │   ├─ findModuleExport("LibraryApp")
  │   ├─ afterPatch + createReactTreePatcher
  │   └─ Cache: get_installed_apps() → Set<number>
  │
  ├─ Event listener: download_progress (phase=done)
  │   └─ Add appid to cached Set
  │
  └─ QAM routes registered

User navigates to library game details
  └─ LibraryApp renders → PlayBar patched
      └─ ScriptStatusIcon(appid) renders
          ├─ Check cached Set
          └─ Show checkmark or download icon

User clicks icon
  ├─ If installed: Navigation.Navigate("/stplugin/installed")
  └─ If not installed: setPendingAppid(appid) → Navigate("/stplugin/download")
      └─ DownloadForm reads getPendingAppid() → pre-fills appid
```

---

## Testing Strategy

| Test | Method |
|------|--------|
| Icon appears on library game page | Manual: navigate to a game in library |
| Icon shows correct state | Manual: check with/without installed script |
| Click navigates correctly | Manual: click icon in both states |
| Icon updates after download | Manual: download a script, verify icon changes |
| Cache refreshes on delete | Manual: delete a script, verify icon changes |
| Graceful degradation | Manual: if fingerprints fail, no crash |
| Unpatch on unload | Manual: unload plugin, verify icon disappears |

---

## Risks

| Risk | Mitigation |
|------|------------|
| PlayBar fingerprint changes in Steam update | Multi-fingerprint fallback; graceful degradation if none match |
| AppID prop name changes | Try multiple prop names; skip if none found |
| Performance impact of patch | Minimal — patch runs once per render, cache is O(1) lookup |
| Icon interferes with Steam UI | Small icon, positioned after play button, no z-index tricks |

---

## Out of Scope

- Store game page injection (CEF webview — cannot be React-patched)
- Custom icon upload
- Per-game icon customization
- Icon on non-library pages
