# Game Name Search for Download Panel

**Date:** 2026-06-02  
**Status:** Approved  
**Topic:** Add game name search with autocomplete to the Download panel, replacing the requirement to know App IDs.

---

## Goal

Allow users to find games by typing a name (instead of a numeric App ID), with results appearing live as they type, including game capsule images. The existing App ID input is preserved as a fallback mode.

---

## Architecture

### New components

| Component | Layer | Description |
|-----------|-------|-------------|
| `Plugin.search_games(query)` | Backend (`main.py`) | New async IPC method. Proxies Steam `/search/suggest` endpoint. Returns `[{id, name, img}]`. |
| `GameSearchDropdown` | Frontend (`src/components/GameSearchDropdown.tsx`) | New React component. Renders search result rows with image + name below the search input. |
| Mode toggle + search input | Frontend (`src/components/DownloadPanel.tsx`) | Modified. Adds radio toggle (App ID / Search) and conditional input rendering. |

### What does NOT change

- `backend/downloads.py` — no changes to download pipeline
- `backend/api_manifest.py` — no changes
- `start_download(id, source)` callable — same parameters, same behavior
- `InstalledApps.tsx`, `SettingsPanel.tsx`, `MainPanel` — no changes
- All existing IPC methods — preserved as-is

---

## Backend: `search_games(query)`

### Location

`main.py` — new async method on `Plugin` class.

### Signature

```python
async def search_games(self, query: str) -> list[dict[str, Any]]:
```

### Behavior

1. If `query` is empty or only whitespace after `.strip()`, return `[]` immediately (no HTTP call).
2. GET `https://store.steampowered.com/search/suggest` with query parameters:
   - `term=<query>` (URL-encoded)
   - `cc=US`
   - `l=english`
   - `realm=1`
   - `f=jsonfull`
   - `require_type=game,software`
3. Use `httpx` with a 10-second timeout (consistent with existing download pipeline timeouts).
4. If the request fails (timeout, connection error, non-200), return `[]` silently — no error toasts, no logging beyond a `logger.debug()`.
5. On success, parse the JSON array. Map each item to `{id: int(item["id"]), name: str(item["name"]), img: str(item["img"])}`. Return the list.

### Response format

```json
[
  {
    "id": 440,
    "name": "Team Fortress 2",
    "img": "https://cdn.cloudflare.steamstatic.com/steam/apps/440/capsule_sm_120.jpg"
  }
]
```

### Error handling

| Scenario | Return |
|----------|--------|
| Empty/whitespace query | `[]` |
| `httpx.ConnectError` / `httpx.TimeoutException` | `[]` + `logger.debug()` |
| Non-200 response | `[]` + `logger.debug()` |
| Malformed JSON response | `[]` + `logger.debug()` |
| Missing fields in response item | Skip that item |

### Testing

Unit tests in the existing pytest suite:
- Mock `httpx` → normal response returns parsed list
- Mock `httpx` → empty query returns `[]`
- Mock `httpx` → connection error returns `[]`
- Mock `httpx` → 500 response returns `[]`

---

## Frontend: `DownloadPanel.tsx` modifications

### New state

```typescript
const [inputMode, setInputMode] = useState<"appid" | "search">("appid");
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
const [searchOpen, setSearchOpen] = useState(false);
```

### New callable

```typescript
const searchGames = callable<[string], GameSearchResult[]>("search_games");
```

Where `GameSearchResult = { id: number; name: string; img: string }`.

### Mode toggle

A row of two radio-style buttons ("App ID" | "Search") rendered above the input area. Uses Decky's `ToggleField` or a simple `ButtonItem` pair. The active mode controls which input is shown below.

### Search input (mode = "search")

- Text field replacing the App ID numeric field.
- On every keystroke: update `searchQuery`, reset a 300ms debounce timer.
- When the debounce fires: if `searchQuery.trim()` is empty, set `searchResults = []`, `searchOpen = false`. Otherwise, call `searchGames(query)` → set results.
- If results are non-empty, set `searchOpen = true` (show dropdown).
- If results are empty, show a subtle "No results found" label.

### Search dropdown (`GameSearchDropdown`)

- Rendered below the search input when `searchOpen === true`.
- Each row: game capsule image (left, ~60px height, `object-fit: contain`) + game name (right).
- Clicking a row:
  1. Sets `appidInput` to the game's `id` (string).
  2. Sets `resolvedName` to the game's `name`.
  3. Sets `searchOpen = false` (close dropdown).
  4. Clears `searchResults`.
- Clicking outside the dropdown closes it (blur handler on the search input).
- Results list is scrollable if results exceed available space.

### App ID input (mode = "appid")

- Existing numeric input, unchanged.
- Existing blur-to-resolve-name behavior, unchanged.

### Mode switch behavior

- Switching from "appid" → "search": clears `appidInput` and `resolvedName` (start fresh). Focuses search input.
- Switching from "search" → "appid": closes dropdown, clears `searchQuery` and `searchResults`. Restores `appidInput` and `resolvedName` to whatever was set when the user clicked a search result (start fresh if no result was ever selected during this search session).

### Start Download button

- Same `handleStart` logic as today — reads `parseInt(appidInput)`.
- Disabled when `appidInput` is empty or not a valid positive integer.
- Works identically regardless of which mode selected the app ID.

### Debounce cleanup

- `useEffect` cleanup clears the timer on unmount or mode switch.
- Prevents API calls after navigation away.

### Edge case: user types an app ID in search mode

No special handling. Steam `/search/suggest` returns the game matching that number. Behaves correctly.

---

## New Component: `GameSearchDropdown`

### Props

```typescript
interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
  onClose: () => void;
}
```

### Rendering

- A container `div` positioned directly below the search input.
- Styled with a border, background matching Decky's dark theme, max-height with overflow-y scroll.
- Each result row:
  - `img` tag for the capsule image (fallback to a generic icon on load error).
  - Game `name` as text.
- "No results found" text when `results` is empty.
- Uses Decky's `staticClasses` where applicable for consistent theming.

### Testing

- Renders results list correctly.
- Clicking a row calls `onSelect` with the correct result.
- Clicking outside calls `onClose`.
- Empty results shows "No results found".
- Image load error shows fallback icon.

---

## Data Flow Summary

```
User types "witcher"
  → 300ms debounce
    → searchGames("witcher") [frontend]
      → Plugin.search_games("witcher") [Python]
        → httpx.get("store.steampowered.com/search/suggest?term=witcher&...")
        ← [{id: 292030, name: "The Witcher 3: Wild Hunt", img: "..."}, ...]
      ← results
    → setSearchResults(results), setSearchOpen(true)

User clicks result
  → setAppidInput("292030")
  → setResolvedName("The Witcher 3: Wild Hunt")
  → setSearchOpen(false)

User clicks "Start Download"
  → startDownload(292030, source?)  [same as today]
    → download_lua(task_id, 292030, ...)
```

---

## Testing Summary

| Layer | Test | Framework |
|-------|------|-----------|
| Backend `search_games` | Success, empty query, API error, timeout | pytest (existing) |
| `GameSearchDropdown` | Render, select, close, empty state, image fallback | Jest + react-testing-library |
| `DownloadPanel` mode toggle | Renders both modes, toggle switches UI, preserve selection on switch | Jest + react-testing-library |
| `DownloadPanel` search | Debounce behavior, result selection updates state, Start button enabled | Jest + react-testing-library |
| Existing tests | All 17 existing tests must continue to pass | pytest + Jest |
