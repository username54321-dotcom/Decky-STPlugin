# Gamepad Focusability Enhancement

**Date:** 2026-06-07
**Status:** Draft
**Goal:** Make all interactive elements in the STPlugin gamepad-focusable, matching the `<Focusable>` pattern used in `InstalledAppCard.tsx`.

## Background

Steam Deck users navigate the UI via gamepad (D-pad/joystick). Native `<button>` and clickable `<div>` elements are **not** focusable by gamepad unless wrapped in Decky's `<Focusable>` component. `ButtonItem`, `DialogButton`, and `ConfirmModal` are inherently gamepad-focusable — elements using those need no changes.

## Current State

### Already Gamepad-Focusable (No Changes)

| File | Reason |
|------|--------|
| `src/installed/components/InstalledAppCard.tsx` | Uses `<Focusable>` wrapping — the reference pattern |
| `src/InstalledApps.tsx` | All buttons use `ButtonItem` |
| `src/DownloadPanel.tsx` | All use `ButtonItem` |
| `src/DownloadForm.tsx` | All use Decky components |
| `src/download/components/DownloadProgress.tsx` | `ButtonItem` |
| `src/download/components/PostDownloadRestart.tsx` | `ButtonItem` |
| `src/installed/components/DiscoverModal.tsx` | `DialogButton` |
| `src/shared/components/RestartButton.tsx` | `ButtonItem` + `ConfirmModal` |
| `src/update/components/UpdateInstalledModal.tsx` | `ConfirmModal` |
| `src/installed/components/SkeletonCard.tsx` | Loading placeholders, not interactive |

### NOT Gamepad-Focusable (Need Changes)

| # | File | Elements | Lines |
|---|------|----------|-------|
| 1 | `src/index.tsx` | 3 native `<button>`s: View, Install, Dismiss (update banner) | 49, 61, 79 |
| 2 | `src/SettingsPanel.tsx` | 2 native `<button>`s: View Release, Install Now (update banner) | 134, 146 |
| 3 | `src/shared/components/PageLayout.tsx` | 1 clickable `<div>`: ← Back navigation | 27 |
| 4 | `src/patches/PlayBarPatch.tsx` | 1 clickable `<div>`: "ST" status badge | 71 |
| 5 | `src/download/components/GameSearchDropdown.tsx` | N search result rows as clickable `<div>`s | 48 |

## Design

### Pattern

Every problematic element gets wrapped in Decky's `<Focusable>` component:

```tsx
import { Focusable } from "@decky/ui";

// For native <button> (mouse + gamepad):
<Focusable onActivate={handler}>
  <button onClick={handler}>Label</button>
</Focusable>

// For clickable <div> (mouse + gamepad):
<Focusable onActivate={handler}>
  <div onClick={handler} style={{ cursor: "pointer" }}>Content</div>
</Focusable>
```

`onActivate` handles gamepad/keyboard activation. `onClick` remains on the inner element for mouse clicks. Both input methods continue to work.

### Per-File Changes

#### 1. `src/index.tsx` — Update banner buttons

- Add `Focusable` to the `@decky/ui` import (line 1-10)
- Wrap each of the 3 `<button>` elements (View, Install, Dismiss) in `<Focusable onActivate={...}>`
- For View and Dismiss: `onActivate` receives the same handler as `onClick`
- For Install: the button is disabled when `updateStatus.installing` is true. Pass `onActivate={updateStatus.installing ? undefined : installHandler}` to prevent gamepad activation while disabled

#### 2. `src/SettingsPanel.tsx` — Update banner buttons

- Add `Focusable` to the `@decky/ui` import
- Wrap the 2 `<button>` elements (View Release, Install Now) in `<Focusable onActivate={...}>`
- For Install Now: pass `onActivate={updateStatus.installing ? undefined : installHandler}` to prevent gamepad activation while disabled

#### 3. `src/shared/components/PageLayout.tsx` — Back navigation

- Add `Focusable` to the `@decky/ui` import
- Wrap the clickable `<div>` in `<Focusable onActivate={() => Navigation.Navigate(ROUTES.main)}>`
- Keep `onClick` on the `<div>` for mouse clicks

#### 4. `src/patches/PlayBarPatch.tsx` — ST status badge

- Add `Focusable` to the `@decky/ui` import (currently imports `afterPatch`, `createReactTreePatcher`, `findInReactTree`, `Navigation`)
- Wrap the `<div>` in `<Focusable onActivate={handleClick}>`
- Keep `onClick` on the `<div>` for mouse clicks

#### 5. `src/download/components/GameSearchDropdown.tsx` — Search results

- Add `Focusable` to the `@decky/ui` import (currently imports `staticClasses`)
- Wrap each result `<div>` in `<Focusable onActivate={() => onSelect(result)}>`
- Keep `onClick` on the `<div>` for mouse clicks
- Keep `onMouseEnter`/`onMouseLeave` hover state management (this provides the visual background highlight for mouse users; Focusable provides focus ring separately for gamepad focus — both are needed)

### What Does NOT Change

- All existing `onClick` handlers remain in place for mouse users
- No CSS/style changes
- No component restructuring (GameSearchDropdown keeps its custom markup with images)
- No type changes
- No new files

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| `onActivate` fires AND `onClick` fires | For gamepad: only `onActivate` fires. For mouse: only `onClick` fires. No double-fire. |
| Disabled button (Install/Install Now when installing) | `<Focusable>` wraps a disabled `<button>`. `Focusable.onActivate` does not check the child's `disabled` attribute, so the handler must guard against the disabled state. Wrap the handler: `onActivate={disabled ? undefined : handler}` or check `updateStatus.installing` inside the handler before proceeding. |
| Focusable injected into Steam DOM (PlayBarPatch) | `<Focusable>` works in any React tree, including Steam's patched routes. No issue. |
| Multiple Focusable items in a list (GameSearchDropdown) | Each row gets its own `<Focusable>`. Gamepad navigation flows naturally between them. |

### Verification

1. `pnpm build` must succeed without errors
2. Mouse clicks must continue to work on all affected elements
3. Gamepad focus must be able to reach each element (tested via Steam Deck or Decky Windows build with controller)

## Files Changed

```
src/index.tsx                                  (+Focusable import, 3x Focusable wrapping)
src/SettingsPanel.tsx                          (+Focusable import, 2x Focusable wrapping)
src/shared/components/PageLayout.tsx           (+Focusable import, 1x Focusable wrapping)
src/patches/PlayBarPatch.tsx                   (+Focusable import, 1x Focusable wrapping)
src/download/components/GameSearchDropdown.tsx (+Focusable import, Nx Focusable wrapping, remove hover state)
```

## References

- `src/installed/components/InstalledAppCard.tsx` — Reference pattern (lines 153-179)
- Decky `Focusable` component: standard wrapper from `@decky/ui` for gamepad focusability
