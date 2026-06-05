# Frontend Polish & Layout Restructure

**Date:** 2026-06-03
**Status:** Approved
**Scope:** TypeScript/React frontend only — no backend changes

## Motivation

The frontend is functional but lacks visual polish. Three categories of issues:

| Problem | Detail |
|---------|--------|
| Top-bar clipping | QAM panel content starts at y=0 and overlaps with the QAM header bar — top components are partially hidden |
| Flat visual hierarchy | Everything uses the same `ButtonItem`/`PanelSectionRow` pattern with no differentiation between sections, labels, actions, or states |
| Raw component styling | Text-based progress (no `ProgressBar`), inline JS hover handlers, no loading spinners, no modals for confirmations, no error boundary |

## Guiding Principles

- **Modern/refined style** — card-like sections, subtle borders, clear visual hierarchy
- **Leverage Decky's component surface** — use `ProgressBarWithInfo`, `ConfirmModal`, `SteamSpinner`, `ControlsList`, `ErrorBoundary` (all already in `@decky/ui` but unused)
- **No CSS files** — stick with inline styles + Steam CSS custom properties (`var(--gp…)`) + `staticClasses`
- **No backend changes** — IPC contract, Python code, and tests unchanged
- **Windows-first** — gamepad focus wrappers (`Focusable`) skipped; Steam native components handle it automatically

## Top-Bar Safe-Area Fix

**Problem:** QAM panels render with a fixed header bar. Plugin `PanelSection` content starts at y=0, overlapping with that header. Top elements (section titles, first buttons) get clipped.

**Fix:** Every panel root gets a wrapper `div` with `paddingTop`. Applied consistently across all four entry points:

- `MainPanel` (in `index.tsx`) — wraps the `<PanelSection>` content
- `DownloadPanel.tsx` — wraps the `<PanelSection>`
- `InstalledApps.tsx` — wraps the `<PanelSection>`
- `SettingsPanel.tsx` — wraps the `<PanelSection>`

Shared padding value stored in `src/shared/styles.ts` as a design token.

## Per-Panel Restructure

### MainPanel (`src/index.tsx`)

**Before:** Flat list of 3 `ButtonItem`s + `RestartButton` at bottom. No header, no visual separation.

**After:** Plugin name subtitle under `titleView`, navigation buttons grouped, `RestartButton` visually separated:

```
┌──────────────────────────────┐
│  STPlugin                    │  ← titleView (existing)
│  Lua script downloader       │  ← subtitle in staticClasses.Label
├──────────────────────────────┤
│  Download Lua Script    →    │
│  Installed Scripts     →    │
│  Settings              →    │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  Restart Steam               │
└──────────────────────────────┘
```

New components used:
- `ControlsList` — groups the navigation buttons with proper spacing
- `staticClasses.Label` — subtitle text

`RestartButton` uses `ConfirmModal` instead of inline confirming state (see RestartButton section below).

### DownloadPanel (`src/download/DownloadPanel.tsx`)

**Before:** Text-based progress display, raw div for "Download complete!", no loading states.

**After:** Same 3-state machine (form → progress → done), but each state uses proper Decky components:

**Form state** — `DownloadForm` gets layout polish (see below).

**Progress state** — `DownloadProgress` replaced with `ProgressBarWithInfo`:
```
┌──────────────────────────────┐
│  Download Lua Script         │
│  ════════════════════ 67%    │  ← ProgressBarWithInfo
│  Downloading files...        │  ← sOperationText
│  ≈ 12 seconds remaining      │  ← sTimeRemaining (optional)
│  [Cancel Download]           │
└──────────────────────────────┘
```

**Done state** — `PostDownloadRestart` restructured:
```
┌──────────────────────────────┐
│  Download Lua Script         │
│  ✓ Download complete!        │  ← var(--gpSystemGreen)
│  [Restart Steam]  [Close]    │  ← ControlsList
└──────────────────────────────┘
```

New components used:
- `ProgressBarWithInfo` — replacing text-based progress display
- `ControlsList` — horizontal button grouping in PostDownloadRestart

### DownloadForm (`src/download/DownloadForm.tsx`)

**Before:** Toggle buttons with minimal styling, search results dropdown with JS hover handlers.

**After:** Better input grouping with `ControlsList`, proper visual separation:

```
┌──────────────────────────────┐
│  [App ID]  [Search]          │  ← ControlsList (toggle group)
│                              │
│  Enter App ID                │  ← TextField
│  Counter-Strike 2            │  ← resolved name (Label)
│                              │
│  Source: [First Working ▼]  │  ← DropdownItem (if !fastDownload)
│                              │
│  [Start Download]            │
└──────────────────────────────┘
```

Improvements:
- `ControlsList` wraps the App ID / Search toggle buttons with consistent spacing
- Increased gap between toggle row and input field
- `SteamSpinner` shown while `get_app_name` IPC is in-flight (replaces blank wait)
- Resolved game name displayed more prominently
- Source picker only shown when `fastDownload` is off (unchanged)
- Start Download button at consistent position below all inputs

### DownloadProgress (`src/download/DownloadProgress.tsx`)

**Before:** Raw text for phase, message, and percentage with a Cancel `ButtonItem`.

**After:** Replaced with `ProgressBarWithInfo`:
- `nProgress={state.percent}` — visual bar (0-100)
- `sOperationText={state.message}` — current operation description
- `sTimeRemaining` — shown when backend provides an estimate (optional)
- `indeterminate` — shown during early phases when percent is unknown
- Cancel button below the progress bar

Phase label removed (progress bar's operation text replaces it). Percentage shown by the bar visually.

Props unchanged: `{ state: DownloadProgress, onCancel: () => void }`.

### PostDownloadRestart (`src/download/PostDownloadRestart.tsx`)

**Before:** Green "Download complete!" label, then `RestartButton`, then "Close" button.

**After:** `ControlsList` for horizontal button layout, success text uses `staticClasses.Label` with `var(--gpSystemGreen)`:

```
✓ Download complete!
[Restart Steam]  [Close]
```

Props unchanged: `{ onDismiss: () => void }`.

### InstalledApps (`src/installed/InstalledApps.tsx`)

**Before:** Simple list with name + re-download + delete buttons. Delete happens instantly with a toast.

**After:** Card-style rows with visual separation, `ConfirmModal` for delete confirmation, `ControlsList` for button groups:

```
┌──────────────────────────────┐
│  Installed Scripts           │
├──────────────────────────────┤
│  Counter-Strike 2            │
│  🔄 Re-download    🗑 Delete │  ← ControlsList
│  ─────────────────────────── │  ← subtle border divider
│  Elden Ring                  │
│  🔄 Re-download    🗑 Delete │
│  ─────────────────────────── │
│  (or empty state)            │
│  No scripts installed yet.   │
└──────────────────────────────┘
```

New components used:
- `ControlsList` — horizontal button grouping per row
- `ConfirmModal` — "Are you sure?" dialog before delete (replaces instant-delete-with-toast)

Delete flow changes:
1. User clicks Delete → `ConfirmModal` opens with "Delete {name}? This cannot be undone."
2. User confirms → IPC `delete_app` called → toast on success/failure → list refreshes
3. User cancels → modal closes, nothing happens

### SettingsPanel (`src/settings/SettingsPanel.tsx`)

**Before:** Flat list of `ToggleField`, `TextField`, `ButtonItem`.

**After:** Visual grouping with subtle dividers:

```
┌──────────────────────────────┐
│  Settings                    │
├──────────────────────────────┤
│  Fast Download         [⚙]   │  ← ToggleField (existing)
│  Skip source picker          │  ← description on ToggleField
│  ─────────────────────────── │  ← subtle border divider
│  Morrenus API Key (optional) │
│  [______________________]   │  ← TextField (existing)
│  ─────────────────────────── │
│  [🔄 Refresh API Sources]    │
└──────────────────────────────┘
```

Improvements:
- `ToggleField` gets its `description` prop set for the subtitle text
- Visual dividers between setting groups (fast download → API key → refresh)
- `ControlsList` wraps the refresh button area for consistent positioning

### RestartButton (`src/shared/components/RestartButton.tsx`)

**Before:** Inline 3-state machine (idle → confirming → restarting) with yellow warning text and inline Cancel/Yes buttons.

**After:** `ConfirmModal` replaces the "confirming" state:

```
User clicks "Restart Steam"
  → ConfirmModal opens: "Restart Steam?"
    "Steam will close and restart. Any running games will be terminated."
    [Cancel]  [Restart Steam]
    → User confirms → restarting state ("Restarting...")
    → User cancels → back to idle
```

New components used:
- `ConfirmModal` — native Steam dialog instead of inline yellow text

Hook `useRestartSteam` simplified: removes `"confirming"` state from the state machine. Instead, `handleRestart()` is called on first click (shows ConfirmModal), and `restart_steam` IPC is called on confirm. State becomes just `"idle" | "restarting"`.

### GameSearchDropdown (`src/download/GameSearchDropdown.tsx`)

**Before:** Hover effect via JavaScript `onMouseEnter`/`onMouseLeave` that directly mutates DOM element styles (`(e.currentTarget as HTMLElement).style.backgroundColor = …`).

**After:** Hover effect via React state. A `hoveredIndex: number | null` state tracks which row the mouse is over. `onMouseEnter`/`onMouseLeave` handlers call `setHoveredIndex(i)` / `setHoveredIndex(null)`. Each row's inline `backgroundColor` reads from state (`hoveredIndex === i ? "var(--gpBackgroundHard)" : "transparent"`). No direct DOM manipulation.

Props unchanged: `{ results: GameSearchResult[], onSelect: (result: GameSearchResult) => void }`.

## New File: `src/shared/styles.ts`

Shared design tokens to replace scattered magic numbers:

```ts
export const SPACING = {
  panelTopPadding: "8px",
  sectionGap: "16px",
  rowGap: "4px",
  controlsGap: "8px",
  dividerMargin: "12px",
};

export const BORDER = {
  divider: "1px solid var(--gpBackgroundLight)",
  cardRadius: "3px",
};

export const COLOR = {
  success: "var(--gpSystemGreen)",
  warning: "var(--gpSystemYellow)",
  muted: "var(--gpSystemLighterGrey)",
  backgroundMedium: "var(--gpBackgroundMedium)",
  backgroundLight: "var(--gpBackgroundLight)",
  backgroundHard: "var(--gpBackgroundHard)",
};
```

Imported by each panel. Magic numbers replaced with named tokens.

## New Components Imported from `@decky/ui`

| Component | Used In | Replaces |
|-----------|---------|----------|
| `ProgressBarWithInfo` | `DownloadProgress.tsx` | Bare text progress display |
| `ControlsList` | `MainPanel`, `DownloadForm`, `PostDownloadRestart`, `InstalledApps`, `SettingsPanel` | Raw `div` with `display: flex` |
| `ConfirmModal` | `RestartButton.tsx`, `InstalledApps.tsx` | Inline confirmation state / instant delete |
| `SteamSpinner` | `DownloadForm.tsx` (game name resolution loading) | No spinner (blank while waiting for `get_app_name`) |
| `ErrorBoundary` | `src/index.tsx` (plugin root) | No error boundary (white screen on crash) |

## Error Handling

| Scenario | Handler | Behavior |
|----------|---------|----------|
| React render crash | `ErrorBoundary` at plugin root | Shows fallback message instead of white screen |
| Name resolution loading | `SteamSpinner` in DownloadForm | Spinner shown while `get_app_name` is in-flight |
| Delete confirmation cancelled | `ConfirmModal` close | No action, no toast |
| Restart confirmation cancelled | `ConfirmModal` close | Back to idle state |
| Progress bar indeterminate | `ProgressBarWithInfo` with `indeterminate={true}` | Animated bar when percent is unknown |

All existing error handling (IPC failures, download errors, toast messages) remains unchanged.

## Data Flow

```
Python Backend
     │
     │  callable() IPC + emit("download_progress")
     ▼
Custom Hooks (no change)
     │
     │  return { state, actions }
     ▼
Orchestrator Components (DownloadPanel)
     │
     │  pass props
     ▼
Presentational Components (DownloadForm, DownloadProgress [updated], etc.)
```

No changes to hooks, IPC bindings, or state management. Only the rendering layer of presentational components changes.

## Edge Cases

| Case | Handling |
|------|----------|
| Progress percent = 0 or unknown | `ProgressBarWithInfo` with `indeterminate={true}` |
| Cancel during progress → rapid re-start | Existing lifecycle hook handles — `cancelDownload` clears `currentTaskId` |
| Empty installed apps | Styled empty state with proper spacing |
| Long game names in InstalledApps | `textOverflow: ellipsis` preserved |
| Search dropdown in DownloadPanel | Hover effect changed from JS handlers to state-based inline style |
| Backend not running | `ErrorBoundary` catches render errors; IPC failures already handled by hooks |

## Testing Strategy

- **TypeScript compilation:** `tsc --noEmit` catches type errors from new imports
- **Rollup build:** `pnpm build` must produce valid bundle
- **Existing tests:** 37/37 Python backend tests remain unchanged
- **No new tests** — style-only changes; visual inspection on Windows Decky build
- **Manual smoke test:**
  1. Open QAM → verify MainPanel has subtitle, grouped buttons, no clipping
  2. Navigate to Download → verify form layout, toggle input modes, search, pick source
  3. Start download → verify `ProgressBarWithInfo` renders with bar and operation text
  4. Complete download → verify post-download prompt with `ControlsList` buttons
  5. Navigate to Installed → verify card rows, delete with `ConfirmModal`
  6. Navigate to Settings → verify grouped sections with dividers
  7. Restart Steam → verify `ConfirmModal` opens instead of inline confirm

## Files Summary

| Action | File |
|--------|------|
| **CREATE** | `src/shared/styles.ts` — design tokens |
| **MODIFY** | `src/index.tsx` — add subtitle, ControlsList, panel padding, ErrorBoundary |
| **MODIFY** | `src/download/DownloadPanel.tsx` — panel padding, layout polish |
| **MODIFY** | `src/download/DownloadForm.tsx` — ControlsList, spacing improvements |
| **MODIFY** | `src/download/DownloadProgress.tsx` — replace with ProgressBarWithInfo |
| **MODIFY** | `src/download/PostDownloadRestart.tsx` — ControlsList, layout polish |
| **MODIFY** | `src/download/GameSearchDropdown.tsx` — replace JS hover with inline style hover |
| **MODIFY** | `src/installed/InstalledApps.tsx` — card rows, ControlsList, ConfirmModal for delete |
| **MODIFY** | `src/settings/SettingsPanel.tsx` — dividers, description prop, layout polish |
| **MODIFY** | `src/shared/components/RestartButton.tsx` — ConfirmModal replaces inline confirming state |
| **MODIFY** | `src/shared/hooks/useRestartSteam.ts` — remove "confirming" state, simplify |

## What Does NOT Change

- No backend Python changes
- No IPC contract changes
- No new dependencies (all components come from `@decky/ui` v4.11.4, already installed)
- No CSS files added
- No changes to download lifecycle, search debouncing, or settings persistence logic
- No i18n/locales (English hardcoded — deferred feature)
- No gamepad `Focusable` wrappers (Steam native components handle gamepad automatically)
