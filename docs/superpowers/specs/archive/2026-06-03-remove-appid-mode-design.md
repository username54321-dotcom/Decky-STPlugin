# Remove AppID Download Mode — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Feature:** Remove the AppID text field input mode from the download form, leaving only search-by-name.

---

## Motivation

Users should discover and download Lua scripts by searching for game names, not by guessing or looking up Steam AppIDs. The AppID text field is an unnecessary power-user holdover from the Millennium plugin. Removing it simplifies the UI and reduces the learning curve.

---

## Scope

### In Scope

- Remove the `[App ID]` / `[Search]` mode toggle from `DownloadForm.tsx`
- Remove the AppID `TextField`, `resolveName` callback, `resolving` spinner, and all associated state
- Make the game name search field the primary (and only) input method
- Simplify `useDebouncedSearch` hook — remove the `mode` parameter
- Keep the `appidInput` state internally (it's populated when the user selects a search result)
- Keep the API Source dropdown
- Keep the Start Download button

### Out of Scope

- No backend changes — `start_download(appid, ...)` still receives an AppID internally
- No changes to `start_download_from_url` (backend method, not exposed in current UI)
- No changes to installed apps or settings panels
- No changes to tests (backend tests unaffected)

---

## Files Changed

| File | Change Type |
|------|-------------|
| `src/download/DownloadForm.tsx` | Remove AppID mode, toggle, resolve logic |
| `src/download/hooks/useDebouncedSearch.ts` | Remove `mode` parameter |

**All backend files:** unchanged.

---

## Detailed Changes

### `src/download/DownloadForm.tsx`

**Removed imports:**
- `ButtonItem` (no longer used — the toggle buttons are gone)
- `SteamSpinner` (no longer used — the resolving spinner is gone)

**Removed state:**
- `inputMode: "appid" | "search"` — the mode toggle
- `resolving: boolean` — the spinner during name resolution

**Kept state (unchanged semantics):**
- `appidInput: string` — populated when user selects a search result
- `resolvedName: string` — shown after selecting a search result
- `searchQuery: string` — drives the debounced search
- `searchOpen: boolean` — controls dropdown visibility
- `sources, selectedSource, fastDownload` — API source picking

**Removed callbacks:**
- `handleModeChange` — no longer needed
- `resolveName` — blur-triggered `get_app_name()` call (was AppID-mode-only)

**Kept callbacks:**
- `handleSearchSelect` — unchanged, populates `appidInput` + `resolvedName`
- `handleStart` — unchanged, parses `appidInput` and calls `onStart(id, source)`

**Removed JSX:**
- The `ControlsList` with two `ButtonItem` (mode toggle)
- The entire `{inputMode === "appid" && (...)}` block
- The `{resolving && (...)}` spinner section

**Restructured JSX:**
- The `{inputMode === "search" && (...)}` block becomes unconditional content
- The API Source dropdown appears once (no longer duplicated)

### `src/download/hooks/useDebouncedSearch.ts`

**Before:**
```typescript
export function useDebouncedSearch(query: string, mode: "appid" | "search")
```

**After:**
```typescript
export function useDebouncedSearch(query: string)
```

Remove the `mode !== "search"` guard on line 14. The hook now fires the debounced search whenever `query.trim()` is non-empty. When the query is empty (e.g., after hitting selection), it returns `[]` naturally.

---

## Data Flow (After Change)

```
User types game name
       │
       ▼
useDebouncedSearch — 300ms debounce
       │
       ▼
Backend search_games(query) → Steam /search/suggest proxy
       │
       ▼
GameSearchDropdown shows [{id, name, img}, ...]
       │
       ▼  User clicks result
handleSearchSelect: appidInput = result.id, resolvedName = result.name
       │
       ▼
User picks API source (or uses Fast Download / Auto)
       │
       ▼
[Start Download] → onStart(appid, source) → backend download_lua()
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty query, Start clicked | Button disabled (existing) |
| Search returns no results | "No results found" shown (existing) |
| User selects game, then searches again | Previous selection cleared, dropdown re-opens |
| Network error on search | Silent `[]` return (existing) |
| API source fetch fails | Dropdown hidden, empty source passed (existing) |

No new edge cases introduced.

---

## Testing

- All existing backend tests (37/37) continue to pass — no backend changes
- Manual verification steps:
  1. Open download panel → search field should be visible (no mode toggle)
  2. Type a game name → results dropdown appears after debounce
  3. Select a result → appid is populated, name shown
  4. Click Start Download → download begins normally
  5. Verify no regression: installed apps, settings, URL download (backend only)

---

## Implementation Order

1. `useDebouncedSearch.ts` — remove `mode` parameter and guard
2. `DownloadForm.tsx` — remove AppID mode code, restructure to search-only
3. Build verification: `pnpm build` succeeds
4. Manual verification (steps above)
