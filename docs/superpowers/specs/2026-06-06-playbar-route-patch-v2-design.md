# PlayBar Route Patch v2 — Design Spec

**Date:** 2026-06-06  
**Status:** Updated — fingerprint changed to ProtonDB prop-matching style  
**Feature:** Rewrite the PlayBar patch from `findModuleExport` module patching to `routerHook.addPatch` route patching, following the Decky wiki's official pattern.

---

## Overview

The current PlayBar patch (`PlayBarPatch.tsx`) uses `findModuleExport` to locate Steam's `LibraryApp` module and patches it directly. This approach is fragile — if the module name, export structure, or React tree changes in a Steam update, the patch silently fails.

This redesign replaces the module-patching approach with **route patching** (`routerHook.addPatch`), which is the Decky wiki's officially recommended pattern. The patch hooks into the router directly at the `/library/app/:appId` route, receiving the full React tree and drilling down to find the PlayBar component.

## Motivation

- **Current approach is not visible** — the `findModuleExport` + `createReactTreePatcher` chain is failing in practice
- **Decky wiki recommends route patching** — the official plugin development guide explicitly prescribes `routerHook.addPatch` for injecting into Steam's UI
- **ProtonDB Badges plugin uses this pattern** — a production-proven, open-source reference exists
- **Route patching is at the correct abstraction level** — hooks into the navigation system rather than guessing at internal module names

## Target

**Library game details page** (`/library/app/:appId`) — the React-based page where users see the Play button, game info, achievements, etc. This is NOT the store page (which is a CEF webview and cannot be React-patched).

## Approach

Follow the ProtonDB Badges plugin pattern:

1. `routerHook.addPatch('/library/app/:appId', handler)` — hook into the route
2. `findInReactTree(tree, x => x?.renderFunc)` — find the route renderer
3. `afterPatch(routeProps, "renderFunc", createReactTreePatcher([...], callback))` — hook into rendering
4. Locate PlayBar in rendered output via fingerprint matching
5. Splice `<ScriptStatusIcon />` into the PlayBar's children array

## Architecture

### Files Changed

| File | Change | Severity |
|------|--------|----------|
| `src/patches/PlayBarPatch.tsx` | Rewrite: `findModuleExport` → `routerHook.addPatch`; `afterPatch(LibraryApp, "type")` → `afterPatch(routeProps, "renderFunc")` | Major |
| `src/index.tsx` | Replace async `registerPlayBarPatch()` promise with direct `patchLibraryApp()` call; cleanup uses `routerHook.removePatch` | Minor |

### Files Unchanged

All other files are unaffected. The `ScriptStatusIcon` component, installed-apps cache (`_installedAppids`), download event listener, `navigationState.ts`, `DownloadForm.tsx`, and `InstalledApps.tsx` all remain as-is.

### Component Tree Walk

```
Route Tree (from routerHook.addPatch)
└── findInReactTree(tree, x => x?.renderFunc)
    └── afterPatch(routeProps, "renderFunc", handler)
        └── createReactTreePatcher([findPlayBar], modifyCallback)
            └── findInReactTree(ret, fingerprintMatch)
                └── ret.props.children.splice(pos, 0, <ScriptStatusIcon />)
```

### Data Flow (unchanged from v1)

1. Plugin startup → `refreshCache()` populates `_installedAppids: Set<number>`
2. User navigates to `/library/app/:appId` → route patch fires → tree walk → finds PlayBar → injects icon
3. `ScriptStatusIcon` reads `_installedAppids.has(appid)` → shows green check or gray download arrow
4. Click → `setPendingAppid(appid)` + `Navigation.Navigate(ROUTES.download)` (or `ROUTES.installed`)
5. Download complete → event listener fires → `addAppid(appid)` → cache updates → icon re-renders via `useEffect` polling
6. Delete via InstalledApps → `removeAppid(appid)` → cache updates

### Integration Surface

**`src/patches/PlayBarPatch.tsx`** exports:
- `patchLibraryApp(): PatchRef` — registers the route patch, the download event listener, and triggers `refreshCache()`. Returns the patch reference for cleanup.
- `removeAppid(appid: number): void` — removes an appid from the cache (used by `InstalledApps.tsx`)
- `refreshCache(): Promise<void>` — re-fetches installed apps (exported for potential future use)

**`src/index.tsx`** changes:
```typescript
// Registration (was async, now direct):
const playBarPatch = patchLibraryApp();

// Cleanup (was _unpatch?.(), now):
onDismount() {
  routerHook.removePatch('/library/app/:appId', playBarPatch);
  // ...existing cleanup...
}
```

### Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| `renderFunc` not found in tree | Return tree unchanged; log warning |
| No component with `appid` prop in rendered tree | `findInReactTree` returns null; skip injection silently |
| AppID missing from props | Guard `if (!appid) return ret` |
| Duplicate injection | Check `children.some(c => c?.key === "stplugin-status")` |
| Plugin unload | `routerHook.removePatch` removes route hook; event listener removed via returned cleanup |
| Cache refresh fails at startup | Error caught, cache stays empty → all icons show "not installed" |
| Route never visited | Patch never fires — no overhead, no error |

### Fingerprint (ProtonDB-style prop matching)

```typescript
(node: any) => node?.props?.appid != null
```

Instead of matching function names (which are minified in production Steam builds), the step function finds any React element that receives an `appid` prop. This is the same pattern used by the ProtonDB Badges plugin — it's immune to minification and survives Steam UI updates. The first component with `appid` (typically the page wrapper) is patched, and the icon is injected into its rendered children.

### Testing Strategy

The React tree structure is internal to Steam and cannot be unit-tested. Verification strategy:

1. **CEF debugging:** `console.log` at each step (found renderFunc? found PlayBar? did we inject?) to verify tree structure
2. **Visual verification:** Navigate to multiple game pages on Deck, confirm icon appears
3. **Regression:** Verify Download/InstalledApps panels still navigate correctly from icon clicks
4. **Plugin unload:** Verify icon disappears and no console errors on plugin unload

### Migration from v1

| Concern | v1 (findModuleExport) | v2 (route patch) |
|---------|----------------------|-------------------|
| Entry point | `findModuleExport(LibraryApp)` | `routerHook.addPatch('/library/app/:appId')` |
| Tree entry | `afterPatch(LibraryApp, "type")` | `afterPatch(routeProps, "renderFunc")` |
| Registration | `async registerPlayBarPatch(): Promise<() => void>` | `patchLibraryApp(): PatchRef` |
| Cleanup | `_unpatch?.()` + `removeEventListener` | `routerHook.removePatch(route, ref)` + `removeEventListener` (in returned cleanup) |
| ScriptStatusIcon | Unchanged | Unchanged |
| Cache | Unchanged | Unchanged |
| Navigation state | Unchanged | Unchanged |
| Fingerprint | `node?.type?.toString?.()` name matching (`PLAY_BAR_FINGERPRINTS`) | `node?.props?.appid != null` prop-based (ProtonDB-style) |

---

## References

- [Decky Wiki: Route Patching](https://wiki.deckbrew.xyz/en/plugin-dev/route-patching)
- [ProtonDB Badges patchLibraryApp.tsx](https://github.com/OMGDuke/protondb-decky/blob/main/src/lib/patchLibraryApp.tsx)
- [Existing PlayBar v1 design spec](docs/superpowers/specs/2026-06-06-playbar-script-icon-design.md)
