# Discover Installed Scripts — Design Spec

## Problem

The Installed Apps panel only shows scripts that were downloaded through the plugin, because it relies on `loadedappids.txt` which is only written to by the download pipeline. If a user has `.lua` files in the `stplug-in/` directory from other sources (manual placement, other tools), they are invisible.

## Solution

Add a "Discover Installed" button that scans the `stplug-in/` directory for `.lua` files, resolves their names and images via Steam APIs, and rebuilds `loadedappids.txt` from scratch. Processing is done incrementally — each app is resolved and added to the tracking file one at a time, with the frontend showing a live-growing list in a modal dialog.

## Scope

- Scan `stplug-in/` for `{digits}.lua` files
- Resolve names via existing `resolve_app_name()` (cache → applist → Steam Store API)
- Resolve images via Steam search suggest API (query by resolved name)
- Rebuild `loadedappids.txt` from scratch: clear file at start, then append per app as resolved
- Modal dialog with live progress and growing app list
- Per-app errors are non-fatal (skip and continue); fatal errors stop processing
- Frontend handles missing images gracefully with placeholder

## Architecture

### Backend

#### `discover_installed()` in `backend/downloads.py`

New function that:

1. Gets Steam path and lua directory (existing `get_steam_path()`, `get_lua_dir()`)
2. Scans directory for files matching `\d+\.lua` pattern
3. Extracts appids from filenames
4. Clears `loadedappids.txt` (delete or truncate existing file)
5. For each appid (sequentially):
   - Calls `resolve_app_name(appid)` — existing function with cache/applist/Store API chain
   - Calls `_resolve_image_url(app_name)` — new helper using search suggest API
   - Appends entry to `loadedappids.txt` via existing `_track_installed()` (harmless dedup on growing file)
   - Yields progress data back to caller
6. Returns summary (total discovered, any per-app errors)

Uses `AsyncGenerator` pattern to yield progress events as each app is processed.

#### `_resolve_image_url(app_name: str)` in `backend/downloads.py`

New helper function:
- Queries `https://store.steampowered.com/search/suggest?term={name}&cc=US&l=english&realm=1&f=jsonfull&require_type=game,software`
- Parses JSON response, takes first result's `img` field
- Returns empty string on failure (non-fatal)
- Rate-limited via existing `_rate_limit()` mechanism

#### `discover_installed_apps()` in `main.py`

New RPC method on `Plugin` class:
- Clears `loadedappids.txt` at the start (fresh rebuild)
- Calls `discover_installed()` async generator
- For each yielded progress, emits `decky.emit("discover_progress", payload)`
- On completion, emits `step: "done"` event
- On fatal error, emits `step: "error"` event
- Returns `{"success": True/False, "discovered": N, "error": "..."}`

### Frontend

#### `DiscoverModal.tsx` — new component in `src/installed/components/`

Modal dialog that:
- Listens to `discover_progress` events via `addEventListener`
- Shows step indicator: "Scanning..." → "Processing 3/15..."
- Displays a live-growing list of discovered apps (name + thumbnail)
- Current app being resolved shows a spinner placeholder
- On done: summary count + "Done" button (calls `onComplete` callback to refresh list)
- On error: red error banner + "Close" button
- Uses Decky's `ConfirmModal` or custom modal structure

#### Button in `InstalledApps.tsx`

- "Discover Installed" button in the page header (FaSearch or similar icon)
- Visible in all states (loaded, empty, error)
- Opens `DiscoverModal`
- On modal close with success, calls `loadApps()` to refresh

## Progress Event Structure

```
Event name: "discover_progress"

Payload:
{
  step: "scanning" | "processing" | "done" | "error",
  current: number,        // current item index (1-based, only during "processing")
  total: number,          // total .lua files found
  appid?: number,         // appid being processed (during "processing")
  app_name?: string,      // resolved name (set once resolved)
  img_url?: string,       // resolved image URL (set once resolved)
  message: string,        // human-readable status
  error?: string,         // error detail (on "error" step)
}
```

### Step Details

| Step | When | Payload | Frontend Display |
|------|------|---------|-----------------|
| `scanning` | Directory scan complete | `total: N` | "Found N Lua scripts" |
| `processing` | Per-app, before resolution | `current: i, total: N, appid: X` | Spinner on app X |
| `processing` | Per-app, after resolution | `current: i, total: N, appid: X, app_name, img_url` | App added to list |
| `done` | All apps processed | `total: N` | Summary + Done button |
| `error` | Fatal error | `error: "..."` | Error banner + Close button |

## Error Handling

### Non-Fatal (per-app, continue processing)

| Error | Behavior |
|-------|----------|
| `resolve_app_name()` returns empty | Use `"App {appid}"` as name |
| Suggest API fails/no result | Leave `img_url` empty |
| Suggest API rate limit hit | Skip image, continue |
| Single entry write fails | Log warning, continue |

### Fatal (stop processing)

| Error | Behavior |
|-------|----------|
| Steam path not found | Emit `step: "error"`, stop |
| Lua directory can't be created | Emit `step: "error"`, stop |

### No .lua files found

Not an error — emit `step: "done", total: 0, message: "No Lua scripts found"`.

## Data Format

Tracking file `loadedappids.txt` uses the existing format (pipe-delimited):

```
appid|name|img_url
```

Example:
```
730|Counter-Strike 2|https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg
440|Team Fortress 2|https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg
```

The `_sanitize_title()` function is applied to names (strip control chars, normalize whitespace) — same as the existing download pipeline.

## Files Modified

| File | Change |
|------|--------|
| `backend/downloads.py` | Add `discover_installed()`, `_resolve_image_url()` |
| `main.py` | Add `discover_installed_apps()` RPC method |
| `src/InstalledApps.tsx` | Add "Discover Installed" button, import DiscoverModal |
| `src/installed/components/DiscoverModal.tsx` | New — modal dialog with live progress |
| `src/shared/types.ts` | Add `DiscoverProgress` interface |

## Files NOT Modified

- `backend/steam_paths.py` — no changes needed
- `backend/api_manifest.py` — no changes needed
- Existing download pipeline — untouched

## Frontend Placeholder for Missing Images

When `img_url` is empty in the live list, show a styled placeholder div with a gamepad icon (FaGamepad) in the existing card thumbnail area. The `InstalledAppCard` component already handles image errors via `onError` — extend this to also handle empty/missing `img_url`.

## Testing Strategy

1. **Backend unit tests**: Test `discover_installed()` with mock filesystem (temp dir with .lua files). Test `_resolve_image_url()` with mocked HTTP responses. Test error cases (no Steam path, empty directory).
2. **Frontend**: Manual testing of modal UI — verify live list updates, error display, done state.
3. **Integration**: Place .lua files in a test directory, run discover, verify `loadedappids.txt` is correctly populated.

## YAGNI Exclusions

- No "re-discover" or auto-discover on plugin load (manual button only)
- No diffing of existing tracking file (full rebuild each time)
- No parallel processing of apps (sequential is simpler, rate-limited anyway)
- No caching of suggest API results (only used during discover, not a hot path)
