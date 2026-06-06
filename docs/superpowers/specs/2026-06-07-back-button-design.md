# Back Button for Subpages — Design Spec

**Date:** 2026-06-07
**Status:** Approved (not yet implemented)

## Problem

The plugin has 3 subpages (`DownloadPanel`, `InstalledApps`, `SettingsPanel`) that are navigated to from the main `MainPanel`. There is currently no way to return to the main menu once on a subpage — users must close and reopen the QAM panel or switch plugins.

## Goal

Add a "← Back" button in the top-left title area of each subpage that navigates to the main menu (`/stplugin`).

## Design

### Approach: Back button built into `PageLayout`

A `showBack` boolean prop is added to the shared `PageLayout` component. When true, a header row with "← Back" + page title is rendered above the content area. When false, existing behavior is preserved.

**Rationale:** The navigation model is simple (main → subpage, always). Hardcoding `ROUTES.main` in `PageLayout` avoids duplication across call sites. A single component change + one-word prop additions in 3 files is minimal, consistent, and testable.

### Component Changes

#### `src/shared/components/PageLayout.tsx`

**Interface:**
```tsx
interface PageLayoutProps {
  title: string;
  showBack?: boolean;    // new — default false preserves existing behavior
  children: React.ReactNode;
}
```

**Rendering logic:**
- When `showBack` is `true`: render a custom header row (flex row with left-aligned "← Back" link + title), then `<PanelSection>` without its own `title` prop for children
- When `showBack` is `false` / undefined: render `<PanelSection title={title}>` — identical to current behavior

**Header row layout:**
```
┌──────────────────────────────┐
│ ← Back    Download Lua Script│   ← clickable flex row, marginBottom: 12px
├──────────────────────────────┤
│                              │
│          children            │   ← PanelSection content
│                              │
└──────────────────────────────┘
```

**Styling (inline, following existing patterns):**
- "← Back": `display: flex, alignItems: center, cursor: pointer, gap: 4px;` — arrow is `fontSize: 16px`, text is `fontSize: 13px, color: var(--gpSystemLighterGrey)`
- Title: `marginLeft: 16px, fontWeight: bold, fontSize: 14px`
- Row: `display: flex, alignItems: center, marginBottom: 12px`

**Back behavior:** `onClick={() => Navigation.Navigate(ROUTES.main)}`

**New imports needed:**
- `Navigation` from `@decky/ui`
- `ROUTES` from `../../shared/constants` (relative path from `src/shared/components/`)

#### `src/DownloadPanel.tsx`

Change: `<PageLayout title="Download Lua Script">` → `<PageLayout title="Download Lua Script" showBack>`

#### `src/InstalledApps.tsx`

Change in all 4 render branches:
1. Loading state (`state === "loading"`)
2. Error state (`state === "error"`)
3. Empty state (`apps.length === 0`)
4. Loaded state (default)

All change from `<PageLayout title="Installed Scripts">` → `<PageLayout title="Installed Scripts" showBack>`

#### `src/SettingsPanel.tsx`

Change: `<PageLayout title="Settings">` → `<PageLayout title="Settings" showBack>`

### Edge Cases

| Scenario | Behavior |
|---|---|
| Active download in progress | DownloadPanel unmounts → `useDownloadLifecycle` cleanup runs (handles cancellation) |
| Post-download restart prompt shown | Prompt dismissed, user returns to main menu |
| Loading / error state in InstalledApps | Back works immediately, no side effects |
| Multiple rapid clicks on "← Back" | Each click calls `Navigation.Navigate` — Decky handles dedup |
| Main page | Not applicable — main page doesn't use `PageLayout` |

### Testing

No new tests needed. Existing 37/37 tests pass unchanged — the change adds a UI navigation element with no new logic. Manual test: navigate to each subpage and verify "← Back" appears and navigates to the main menu.

## Files Changed

| File | Change |
|---|---|
| `src/shared/components/PageLayout.tsx` | Add `showBack` prop, conditional header row |
| `src/DownloadPanel.tsx` | Add `showBack` to PageLayout usage |
| `src/InstalledApps.tsx` | Add `showBack` to PageLayout usage (4 branches) |
| `src/SettingsPanel.tsx` | Add `showBack` to PageLayout usage |
