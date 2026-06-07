# Search Results: Installed Script Indicator

**Date:** 2026-06-07
**Status:** Draft
**Approach:** Local fetch + prop passing (Frontend-side merge)

## Problem

When searching for games in the download form, users cannot tell which scripts they've already installed. They must switch to the Installed Apps panel to check, then return to search. This is friction, especially when browsing multiple games.

## Goal

Add a visual "Installed" badge to game search results for scripts that have already been downloaded — without changing any backend code or IPC contracts.

## Design

### Data Flow (Frontend-side merge)

The `DownloadForm` component (the search form's parent) orchestrates fetching the installed app IDs and passing them down:

1. **On mount**: `DownloadForm` calls `get_installed_apps()` → extracts `appid` values → stores as `installedAppids: number[]` state.
2. **Reactive refresh**: A `useEffect` registers a `download_progress` event listener. When any download completes (`phase === "done"`), it re-fetches the installed set. This updates the badge in real time — even if the user is still viewing search results.
3. **Prop drilling**: `installedAppids` is passed to `GameSearchDropdown` as a prop.
4. **Client-side matching**: `GameSearchDropdown` checks `installedAppids.includes(result.id)` for each result and renders a badge for matches.

```
┌──────────────────────────────────────────────────────┐
│  DownloadForm                                        │
│                                                      │
│  on mount: get_installed_apps() → [730, 440, …]     │
│  on download_progress "done": re-fetch               │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  GameSearchDropdown                             ││
│  │  prop: installedAppids={[730, 440, ...]}        ││
│  │                                                 ││
│  │  [art]  Counter-Strike 2          [Installed]   ││
│  │  [art]  Portal 2                                ││
│  │  [art]  Team Fortress 2           [Installed]   ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### Badge UI

- **Position**: Right edge of each result row, pushed by `marginLeft: "auto"` in the existing flex container.
- **Colors**: Green `#5cb85c` text on `rgba(92, 184, 92, 0.15)` background (matches PlayBar icon installed color).
- **Typography**: `11px`, weight `600`, `letterSpacing: "0.5px"`.
- **Shape**: `padding: 2px 6px`, `borderRadius: 4px`.
- **Text**: `"Installed"` — hardcoded English, consistent with project convention.
- **Selection**: Badge is purely visual. Clicking the row still calls `onSelect(result)` and starts the download flow normally (inform only — no blocking).

### Files Changed

**`src/DownloadForm.tsx`** (~12 lines added):
- New `callable` binding: `getInstalledApps`
- New state: `installedAppids: number[]`
- New `useEffect`: fetch on mount + `download_progress` listener with cleanup
- Pass `installedAppids` to `<GameSearchDropdown>`

**`src/download/components/GameSearchDropdown.tsx`** (~15 lines added):
- New prop: `installedAppids` in `GameSearchDropdownProps`
- Destructure with default `[]`
- Conditional badge `<span>` inside each result row

### Files Unchanged

| File | Reason |
|------|--------|
| `src/shared/types.ts` | `GameSearchResult` remains `{id, name, img}` — matching is client-side |
| `backend/downloads.py` | No backend changes needed |
| `main.py` | No new IPC methods |
| `src/patches/PlayBarPatch.tsx` | Independent cache — no coupling |
| `openspec/specs/api-contracts.md` | No new IPC endpoints |

### Error Handling

- If `get_installed_apps()` fails: catch the error, keep `installedAppids = []`. No badges shown, no crash.
- Event listener cleanup: `removeEventListener` on unmount to prevent leaks.

### Testing

| Scenario | Expected |
|----------|----------|
| Uninstalled game in search | No badge |
| Installed game in search | Green "Installed" badge on that result |
| Mixed results | Badges only on installed results |
| Download completes | Badge appears reactively (event listener) |
| Backend fetch fails | No badges, no crash |
| Search with no results | "No results found" unchanged |
| Zero installed apps | All results show without badges |

### Alternatives Considered

| Approach | Reason Not Chosen |
|----------|-------------------|
| Shared `useInstalledApps` hook | YAGNI — only one consumer; unnecessary abstraction |
| Backend `installed` flag in `search_games` | Would change IPC contract and backend; no benefit over frontend merge |
| Module-level singleton from PlayBarPatch | Ties two independent features together; creates import coupling |

### Status

All sections approved during brainstorming. Ready for implementation.
