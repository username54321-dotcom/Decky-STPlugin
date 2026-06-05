# Frontend Refactor for Maintainability

**Date:** 2026-06-03
**Status:** Approved
**Scope:** TypeScript/React frontend only — no backend changes

## Motivation

The frontend has grown from a simple prototype into a working plugin with 5 files / 750 lines. Several maintainability issues have accumulated:

| Problem | Detail |
|---------|--------|
| `DownloadPanel.tsx` monolithic | 360 lines (48% of codebase), 13 `useState` calls, 3 `useEffect` calls, mixed concerns |
| Duplicated restart confirmation | Same 3-state flow in `index.tsx` and `DownloadPanel.tsx` (~30 duplicated lines) |
| No shared types | 5 inline type definitions, only `GameSearchResult` is shared across files |
| No custom hooks | Data fetching, debounced search, download lifecycle all inline in component body |
| No constants file | Route paths, settings keys, strings repeated across files |
| Dead prop | `GameSearchDropdown` receives `onClose` but never calls it |
| All inline styles | No CSS modules or shared style objects (kept for this round — CSS changes deferred) |

## Guiding Principles

- **Behavior-preserving** — no UX changes, no IPC contract changes, no visual changes
- **Moderate depth** — extract hooks and sub-components but don't over-engineer (no CSS modules, no service layer, no state library)
- **Feature co-location** — organize by feature domain (download, settings, installed) rather than by file type (components, hooks, types)
- **YAGNI** — only create structure that solves a current problem, not anticipated future ones

## Target File Structure

```
src/
├── index.tsx                           # definePlugin() + MainPanel (~70 lines, down from 130)
│
├── shared/                             # Cross-feature code used by 2+ features
│   ├── types.ts                        # All shared TypeScript interfaces
│   ├── constants.ts                    # Route paths, settings keys, magic strings
│   ├── components/
│   │   └── RestartButton.tsx           # Shared restart UI (deduplicated from 2 places)
│   └── hooks/
│       └── useRestartSteam.ts          # Shared restart state machine (3-state: idle/confirming/restarting)
│
├── download/                           # Download feature domain
│   ├── DownloadPanel.tsx               # Orchestrator only (~150 lines, down from 360)
│   ├── DownloadForm.tsx                # AppID/Search input + API source selection
│   ├── DownloadProgress.tsx            # Progress bar + Cancel button
│   ├── PostDownloadRestart.tsx         # Post-download restart prompt
│   ├── GameSearchDropdown.tsx          # Search results dropdown (moved from components/, dead `onClose` prop removed)
│   └── hooks/
│       ├── useDownloadLifecycle.ts     # Download state machine (start, progress, cancel, done, error)
│       └── useDebouncedSearch.ts       # Debounced game name search with cleanup
│
├── installed/
│   └── InstalledApps.tsx               # Installed scripts list (uses shared types)
│
└── settings/
    └── SettingsPanel.tsx               # Settings form (uses shared types + constants)
```

## Component Responsibilities

### `shared/types.ts` — Centralized Type Definitions

All interfaces live here. Nothing defined inline in components.

```ts
export interface GameSearchResult { id: number; name: string; img: string; }
export interface ApiSource { name: string; url: string; }
export interface DownloadProgress { task_id: string; phase: string; percent: number; message: string; appid?: number; error?: string; }
export interface InstalledApp { appid: number; name: string; }
export interface Settings { fastDownload: boolean; morrenusApiKey: string; }
export type RestartState = "idle" | "confirming" | "restarting";
```

### `shared/constants.ts` — Magic Strings

```ts
export const ROUTES = {
  main: "/stplugin",
  download: "/stplugin/download",
  installed: "/stplugin/installed",
  settings: "/stplugin/settings",
};
export const SETTINGS_KEYS = {
  fastDownload: "fastDownload",
  apiKey: "morrenusApiKey",
};
export const PLUGIN_NAME = "STPlugin";
```

### `shared/components/RestartButton.tsx` — Shared Restart UI

Replaces the duplicated restart confirmation flow currently in `index.tsx` (MainPanel) and `DownloadPanel.tsx` (`handlePostDownloadRestart`).

Props:
- `onComplete?: () => void` — optional callback after successful restart (e.g., dismiss post-download prompt)

Uses `useRestartSteam` hook internally. Renders:
1. **idle** → "Restart Steam" button
2. **confirming** → Warning text + Cancel / "Yes, Restart" buttons
3. **restarting** → Disabled "Restarting..." button

Handles errors via `toaster.toast()`. No parent props needed for error handling — self-contained.

### `shared/hooks/useRestartSteam.ts` — Restart State Machine

Encapsulates the 3-state restart confirmation logic:

```ts
function useRestartSteam(onComplete?: () => void): {
  restartState: RestartState;
  handleRestart: () => void;
  handleCancel: () => void;
}
```

- `handleRestart()`: idle → confirming. confirming → restarting (calls `restart_steam` IPC). On success, calls `onComplete`. On error, toasts and resets to idle.
- `handleCancel()`: confirming → idle.

### `download/DownloadPanel.tsx` — Orchestrator

Composes sub-components, manages the download lifecycle hook. Does NOT render form inputs, progress bars, or restart prompts directly.

```tsx
function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <PanelSection title="Download Lua Script">
      {!download.isActive && !showRestartPrompt && (
        <DownloadForm onStart={download.start} />
      )}
      {download.isActive && (
        <DownloadProgress state={download.state} onCancel={download.cancel} />
      )}
      {showRestartPrompt && (
        <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
      )}
    </PanelSection>
  );
}
```

Orchestrator state:
- `showRestartPrompt` — single `useState` boolean to toggle between form and post-download prompt
- All download state lives in `useDownloadLifecycle()` hook

Down from ~360 lines / 13 `useState` calls to ~150 lines / 1 `useState` call.

### `download/DownloadForm.tsx` — Input Form

All input logic in one component:
- Mode toggle: App ID / Search (two `ButtonItem`s, mutually exclusive)
- App ID mode: `TextField` + resolved game name display
- Search mode: `TextField` + `GameSearchDropdown`
- API source `DropdownItem` (only when `!fastDownload` and sources available)
- "Start Download" `ButtonItem` (disabled when no input or downloading)

Props: `onStart(appid: number, sourceName?: string): void`

Owns `useDebouncedSearch` internally. Handles `get_app_name`, `get_api_sources`, `get_settings` fetches on mount. No download lifecycle logic — delegates to parent via `onStart`.

### `download/DownloadProgress.tsx` — Progress Display

Pure presentational component. Displays:
- Percent bar + message text
- Cancel button

Props: `state: DownloadProgress`, `onCancel: () => void`

### `download/PostDownloadRestart.tsx` — Post-Download Prompt

Shown after download completes. Renders "Download complete! Restart Steam to apply?" message + `RestartButton`.

Props: `onDismiss: () => void` — called when user dismisses without restarting.

Uses the shared `RestartButton` component internally.

### `download/GameSearchDropdown.tsx` — Search Results

Moved from `src/components/` into `download/` (only used by `DownloadForm`). Changes:
- Remove unused `onClose` prop (currently received but never called)
- Props become: `{ results: GameSearchResult[], onSelect: (result: GameSearchResult) => void }`
- Behavior unchanged: scrollable dropdown with 120x45 images, "No results found" empty state, hover highlight

### `download/hooks/useDownloadLifecycle.ts` — Download State Machine

Encapsulates the full download lifecycle:

```ts
function useDownloadLifecycle(onComplete: () => void): {
  isActive: boolean;
  state: DownloadProgress | null;
  start(appid: number, source?: string): void;
  cancel(): void;
}
```

Internal behavior:
- `start()`: calls `start_download` IPC, stores `currentTaskId`, sets initial progress state
- `cancel()`: calls `cancel_download` IPC, sets phase to `"cancelled"`, clears taskId
- Registers `download_progress` event listener filtered by `currentTaskId`
- On phase `"done"`: calls `onComplete` callback (orchestrator uses it to show restart prompt)
- On phase `"error"`: toasts error message, resets state
- Cleans up event listener on unmount

Extracted from `DownloadPanel.tsx` lines ~90-130 and ~160-190 of the current code.

### `download/hooks/useDebouncedSearch.ts` — Debounced Search

```ts
function useDebouncedSearch(query: string, inputMode: "appid" | "search"): {
  results: GameSearchResult[];
  searching: boolean;
}
```

- 300ms debounce on `query` changes
- Only fires when `inputMode === "search"`
- Cancels previous in-flight search on new keystroke (via AbortController or flag)
- Returns empty array when query is empty
- Cleans up on unmount

### `installed/InstalledApps.tsx` — Minor Cleanup

- Imports `InstalledApp` from `shared/types.ts` instead of defining inline
- Behavior unchanged

### `settings/SettingsPanel.tsx` — Minor Cleanup

- Imports `Settings` from `shared/types.ts` instead of defining inline
- Imports `SETTINGS_KEYS` from `shared/constants.ts` instead of string literals
- Behavior unchanged

### `src/index.tsx` — Entry Point

- MainPanel replaces inline restart confirmation logic with `<RestartButton />`
- Imports from new paths (`shared/types.ts`, `shared/constants.ts`)
- Route registration unchanged
- Drops from ~130 lines to ~70 lines

## IPC Organization

Each feature folder defines its own `callable` bindings at module scope. No central IPC registry (follows existing Decky pattern).

| Feature | IPC Methods |
|---------|-------------|
| `shared/` | `restart_steam` |
| `download/` | `start_download`, `cancel_download`, `get_app_name`, `get_api_sources`, `search_games` |
| `installed/` | `get_installed_apps`, `delete_app` |
| `settings/` | `get_settings`, `set_setting`, `refresh_api_manifest` |

Each `callable` is defined exactly once. Currently `start_download` is duplicated in `DownloadPanel.tsx` and `InstalledApps.tsx` — this will be deduplicated by having `InstalledApps` import it from `download/` (or define its own local binding). Preference: each feature defines its own local `callable` binding to keep features independent.

## Data Flow

```
Python Backend
     │
     │  callable() IPC + emit("download_progress")
     ▼
Custom Hooks (only stateful layer)
     │
     │  return { state, actions }
     ▼
Orchestrator Components (DownloadPanel)
     │
     │  pass props
     ▼
Presentational Components (DownloadForm, Progress, PostDownload, RestartButton)
```

- **Hooks** own all IPC interaction (`callable`, `addEventListener`). Components never call IPC directly.
- **Orchestrators** call hooks, compose sub-components, pass props down.
- **Presentational components** receive props, render UI, call callbacks. No state, no effects.

## Error Handling

| Scenario | Handler | Behavior |
|----------|---------|----------|
| Backend IPC fails | try/catch in hook | `toaster.toast("Error: ...")` + reset state |
| Download phase `"error"` | `useDownloadLifecycle` event listener | `toaster.toast("Download failed: ...")` + reset |
| Delete app fails | try/catch in InstalledApps | `toaster.toast("Failed to delete")` |
| Settings persist fails | try/catch in SettingsPanel | Silent (optimistic update already applied) |
| Steam restart fails | `useRestartSteam` | `toaster.toast("Restart failed")` + reset to idle |
| Search returns empty | `useDebouncedSearch` | Empty array — GameSearchDropdown shows "No results found" |
| Image load error | GameSearchDropdown `onError` | Hide `<img>`, show text-only row |

## Edge Cases

| Case | Handling |
|------|----------|
| Rapid start/cancel | `useDownloadLifecycle` tracks `currentTaskId` — cancel clears it, new start overwrites |
| Unmount during download | `useEffect` cleanup removes event listener; backend continues; user sees progress on re-navigate |
| New download while restart prompt shown | `DownloadPanel` checks `!download.isActive` before rendering form or prompt. Starting dismisses prompt. |
| Empty installed apps | `InstalledApps` shows "No Lua scripts installed yet." |
| Concurrent feature panels | Can't happen — Decky QAM routes are exclusive |

## Testing Strategy

- **TypeScript compilation:** `tsc --noEmit` catches type errors across new file structure
- **Rollup build:** `pnpm build` must produce valid bundle (catches import errors, missing exports)
- **Existing tests:** 37/37 Python backend tests remain unchanged (IPC contract preserved)
- **No new component tests** — out of scope for this refactor
- **Manual smoke test:** Navigate all 4 routes, start/cancel download, search game, change settings, delete app, restart Steam

## Files Summary

| Action | File |
|--------|------|
| **CREATE** | `src/shared/types.ts` |
| **CREATE** | `src/shared/constants.ts` |
| **CREATE** | `src/shared/components/RestartButton.tsx` |
| **CREATE** | `src/shared/hooks/useRestartSteam.ts` |
| **CREATE** | `src/download/DownloadForm.tsx` |
| **CREATE** | `src/download/DownloadProgress.tsx` |
| **CREATE** | `src/download/PostDownloadRestart.tsx` |
| **CREATE** | `src/download/hooks/useDownloadLifecycle.ts` |
| **CREATE** | `src/download/hooks/useDebouncedSearch.ts` |
| **MODIFY** | `src/index.tsx` — use RestartButton, import from new paths |
| **MOVE + MODIFY** | `src/components/DownloadPanel.tsx` → `src/download/DownloadPanel.tsx` — orchestrator rewrite |
| **MOVE + MODIFY** | `src/components/GameSearchDropdown.tsx` → `src/download/GameSearchDropdown.tsx` — remove dead `onClose` prop |
| **MODIFY** | `src/installed/InstalledApps.tsx` — use shared types |
| **MODIFY** | `src/settings/SettingsPanel.tsx` — use shared types + constants |
| **DELETE** | `src/components/` — empty directory after moves |

## What Does NOT Change

- No backend Python changes
- No IPC contract changes
- No visual/UX changes
- No new dependencies
- No CSS changes (inline styles kept as-is)
- No new tests (existing 37 tests + compilation + build suffice)
- No store page injection (already pruned)
- No i18n/locales (English hardcoded — deferred feature)

## Rollback Safety

Every modification is a pure extraction or reorganization:
- Components can be reverted to their inline state if a hook proves problematic
- Feature folders can be flattened back to `src/components/` if co-location doesn't work
- Types and constants can be inlined back if centralized files cause issues

No architectural lock-in. All changes are mechanical.
