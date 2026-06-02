# Installed Apps Page Revamp — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Scope:** Full revamp of the Installed Apps page (UI, performance, bug fixes)

---

## Problem Statement

The current Installed Apps page has several issues:

1. **Layout broken** — Title is clipped, action buttons overflow their container to the right
2. **Slow discovery** — 5-7 second load time on every page open due to serial API calls for name resolution
3. **Delete bug** — Deleting an app removes the `.lua` file but leaves the entry in `loadedappids.txt`, causing phantom entries
4. **No visual polish** — Plain text list with no app images, no loading states, no empty/error states
5. **Missing features** — No capsule images, no app count, no skeleton loading

---

## Design

### 1. Card Layout

Each installed app renders as a card:

```
┌─────────────────────────────────────────────┐
│ ┌──────────┐  App Name                      │
│ │ Capsule  │  App ID: 730                   │
│ │  Image   │                                │
│ │          │              [↻] [🗑]          │
│ └──────────┘                                │
└─────────────────────────────────────────────┘
```

**Card specs:**
- Background: `var(--gpBackgroundLight)`
- Border: `1px solid var(--gpBackgroundMedium)` with `8px` border-radius
- Padding: `12px`
- Gap between cards: `8px`
- Capsule image: `120x45px` (Steam's `capsule_231x87` scaled down)
- App name: `staticClasses.Label` with `font-weight: 600`
- App ID: muted text below name (`var(--gpSystemLighterGrey)`)
- Action buttons: top-right corner, horizontal row

**Hover/focus state:**
- Background lightens to `var(--gpBackgroundMedium)`
- Subtle border highlight
- Uses Steam's native `:focus-visible` styles for GamepadUI navigation

### 2. Capsule Images

**URL construction (on the fly, no caching):**
```
https://cdn.akamai.steamstatic.com/steam/apps/{appid}/capsule_231x87.jpg
```

**Image handling:**
- `loading="lazy"` attribute for viewport-based loading
- On error: fallback to `FaGamepad` icon
- No local caching — let browser handle HTTP caching

### 3. Data Flow & Caching

**New `loadedappids.txt` format:**
```
730:Counter-Strike 2
440:Team Fortress 2
570:Dota 2
```

**How it works:**

| Action | What happens |
|--------|--------------|
| **Install app** | `_track_installed(appid, name)` writes `appid:name` to file |
| **Delete app** | `_remove_loaded_app(appid)` removes the line from file |
| **Load page** | `get_installed_apps()` reads file, returns `appid` + `name` instantly |
| **Name missing** | Only resolve names for entries without `:name` suffix (fallback) |

**Parallel resolution:** Use `asyncio.gather()` for any uncached names instead of sequential loop.

### 4. Actions

| Action | Icon | Behavior |
|--------|------|----------|
| **Re-download** | `FaRedo` | Confirmation modal → `startDownload(appid)` → toast |
| **Delete** | `FaTrash` | Confirmation modal → delete `.lua` + remove from tracking file → toast → refresh |

**No swipe-to-delete.** Icon buttons only.

### 5. States

**Loading state (skeleton):**
- 3 animated skeleton cards with pulse effect
- Capsule placeholder: solid color block
- Text placeholders: gray bars

**Empty state:**
- `FaBoxOpen` icon centered
- Primary: "No Lua scripts installed yet."
- Secondary: "Download one from the Search tab."

**Error state (page-level):**
- `FaExclamationTriangle` icon
- "Failed to load installed scripts."
- Retry button

**Per-app error (re-download fails):**
- Red left border on card
- Error text: "Download failed — click to retry"
- Clicking card triggers re-download

### 6. Performance

| Optimization | Impact |
|--------------|--------|
| Disk-based name cache | Subsequent loads: **<100ms** (was 5-7s) |
| Parallel name resolution | First load: **2-3s** (was 5-7s) |
| Frontend state caching | Only refetch on mount or after mutation |
| Lazy image loading | Reduces initial network requests |

---

## Bug Fixes

### Delete Bug (Critical)

**Root cause:** `remove_lua()` in `backend/downloads.py:415-424` only deletes the `.lua` file but never touches `loadedappids.txt`.

**Fix:** Add `_remove_loaded_app(appid)` function:
```python
def _remove_loaded_app(appid: int) -> None:
    steam_path = get_steam_path()
    if not steam_path:
        return
    tracking_file = get_lua_dir(steam_path) / "loadedappids.txt"
    if not tracking_file.exists():
        return
    lines = tracking_file.read_text().splitlines()
    prefix = f"{appid}:"
    new_lines = [line for line in lines if not line.strip().startswith(prefix)]
    if len(new_lines) != len(lines):
        tracking_file.write_text("\n".join(new_lines) + "\n")
```

Call from `remove_lua()` after deleting `.lua` file.

### Layout Overflow

**Root cause:** Flex row with name and buttons has no `overflow: hidden` and buttons push outside container.

**Fix:** Card layout with explicit width constraints and `flex-shrink: 0` on button group.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/installed/InstalledApps.tsx` | Complete rewrite — card layout, skeleton loading, empty/error states |
| `backend/downloads.py` | Add `_remove_loaded_app()`, update `remove_lua()`, update `_track_installed()` to store names, update `get_installed_apps()` to parse names |
| `src/shared/types.ts` | No changes needed (`InstalledApp` already has `appid` + `name`) |
| `src/shared/styles.ts` | Add card styles (background, border, radius, padding) |

## New Files

| File | Purpose |
|------|---------|
| `src/installed/InstalledAppCard.tsx` | Card component for individual app |
| `src/installed/SkeletonCard.tsx` | Loading skeleton component |

---

## Out of Scope

- Swipe-to-delete (user declined)
- App file size or install date display
- Sorting/filtering/search
- Non-English locales
- Download progress on re-download (handled elsewhere)
