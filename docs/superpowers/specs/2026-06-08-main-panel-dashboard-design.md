# Main Panel Dashboard — Design Spec

**Date:** 2026-06-08
**Scope:** Visual polish + code cleanup of the QAM MainPanel (menu hub), converting it from a simple navigation menu into a status dashboard.

---

## 1. Overview

The current MainPanel (defined inline in `src/index.tsx`, ~87 lines) is a bare navigation list — three `ButtonItem` links (Download, Installed, Settings) and a Restart button. This spec redesigns it as a **status dashboard** with a header, quick stats, styled navigation tiles, and a footer. Simultaneously, the code is extracted from `index.tsx` into its own file with sub-components.

**No backend changes** — uses existing IPC callables.

---

## 2. Architecture & File Structure

### New Files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/MainPanel.tsx` | Extracted status dashboard component | 80 |
| `src/main/StatsCard.tsx` | Quick stats card — installed scripts count | 40 |
| `src/main/NavTile.tsx` | Reusable nav tile (icon, title, description, navigate) | 30 |
| `src/main/styles.ts` | MainPanel-specific style constants | 25 |

### Modified Files

| File | Change |
|------|--------|
| `src/index.tsx` | Thin down to ~35 lines. MainPanel is now an import, not an inline component. |
| `openspec/specs/frontend.md` | Update QAM Panels section for new MainPanel structure |
| `openspec/specs/architecture.md` | Add `src/main/` directory to file tree |

### Component Tree After
```
index.tsx (thin, ~35 lines)
├── MainPanel (new, extracted from index.tsx)
│   ├── Header — plugin name + version + update badge
│   ├── StatsCard (new) — installed scripts count
│   ├── NavTile (new) ×3 — Download / Installed / Settings
│   └── RestartButton (existing) — repositioned to footer
├── DownloadPanel (unchanged)
├── InstalledApps (unchanged)
├── SettingsPanel (unchanged)
```

### What Moves Out of index.tsx
- The entire `MainPanel` function component
- All MainPanel-specific imports (`PanelSection`, `PanelSectionRow`, `ButtonItem`, `Field`, `ControlsList`, `staticClasses`, `Navigation`, `RestartButton`)
- The update-check banner logic

### What Stays in index.tsx
- `definePlugin()` call
- `routerHook.addRoute()` for all 4 routes
- `patchLibraryApp()` setup
- `onDismount()` cleanup
- Component imports (MainPanel imported instead of defined inline)

---

## 3. Visual Layout

The MainPanel has 4 vertical zones:

### Zone 1: Header
```
┌─────────────────────────────────┐
│  STPlugin          v1.2.3  ⬆️   │
│  Lua Script Manager             │
└─────────────────────────────────┘
```
- Plugin name ("STPlugin") in bold, left-aligned
- Version number right-aligned (from `useUpdateStatus` hook)
- Subtitle: "Lua Script Manager" in muted text (`var(--gpSystemLighterGrey)`)
- If update available: green "Update Available" badge next to version

### Zone 2: Quick Stats Card
```
┌─────────────────────────────────┐
│  📦  12 scripts installed       │
└─────────────────────────────────┘
```
- Single `PanelSection` with background `var(--gpBackgroundLight)` and rounded border
- Icon: `FaCubes` (from react-icons/fa)
- Count fetched from existing `get_installed_apps()` callable
- States: loaded (real count), empty ("No scripts installed"), loading/error ("—")

### Zone 3: Navigation Tiles
```
┌─────────────────────────────────┐
│  📥  Download Lua Script        │
│      Search & install scripts   │
├─────────────────────────────────┤
│  📦  Installed Scripts          │
│      Manage & re-download       │
├─────────────────────────────────┤
│  ⚙️  Settings                   │
│      Configure plugin options   │
└─────────────────────────────────┘
```
- Each tile: `NavTile` component with `Focusable` wrapper for gamepad
- Icon (left, ~24px), title (bold), description (muted, smaller, below title)
- Subtle background highlight on hover/focus (`var(--gpBackgroundLight)`)
- Separated by thin dividers
- Icons: `FaDownload` (Download), `FaBox` (Installed), `FaCog` (Settings)

### Zone 4: Footer
```
┌─────────────────────────────────┐
│         Restart Steam           │
└─────────────────────────────────┘
```
- Existing `RestartButton` component, repositioned to bottom
- Separated from nav tiles by a light divider

---

## 4. Data Flow & Error Handling

### Data Flow
```
MainPanel mounts
  ├── useUpdateStatus() hook → update badge in header
  └── useEffect → callable("get_installed_apps") → StatsCard count
```

- **Update status**: Reuses existing `useUpdateStatus` hook (no duplication)
- **Installed count**: `useState<number>` + `useEffect` calls `get_installed_apps()` on mount. Extracts only `.length`.
- **Navigation**: `NavTile` onClick calls `Navigation.Navigate(ROUTES.xxx)` — same pattern as today.

### States

| State | Behavior |
|-------|----------|
| Loading (count) | StatsCard shows "—" placeholder (no spinner) |
| Loaded | StatsCard shows real count (e.g., "12 scripts installed") |
| Error (count) | StatsCard shows "—" silently. Error logged to `decky.logger`. No user-facing banner. |
| No scripts | StatsCard shows "No scripts installed" with muted style |
| Update available | Header shows "Update Available" badge |
| No update | Header shows version only |

### Error Handling Philosophy
- Installed count is a **non-critical dashboard stat**. Failures are logged but never shown to user as banners/toasts on the main menu.
- Update check failures handled silently by the existing `useUpdateStatus` hook.

---

## 5. Component Props & Interfaces

### NavTile Props
```ts
interface NavTileProps {
  icon: React.ReactNode;      // React icon component
  title: string;              // Bold label (e.g., "Download Lua Script")
  description: string;        // Muted sub-label (e.g., "Search & install scripts")
  route: string;              // Navigation target (e.g., ROUTES.download)
}
```

### StatsCard Props
```ts
interface StatsCardProps {
  installedCount: number | null;  // null = loading/error
}
```

### MainPanel State
```ts
const [installedCount, setInstalledCount] = useState<number | null>(null);
const updateStatus = useUpdateStatus();
```

---

## 6. Styling

### Approach
- Follows existing pattern: no CSS files. Inline `style={}` objects using constants.
- Uses Steam CSS custom properties: `var(--gpBackgroundLight)`, `var(--gpSystemLighterGrey)`, etc.
- `src/main/styles.ts` exports MainPanel-specific constants:
  - `HEADER` — title, subtitle, version badge styles
  - `STATS_CARD` — card container, icon, count text styles
  - `NAV_TILE` — tile container, icon, title, description, hover styles
  - `FOOTER` — divider, restart button area styles

### Dependencies
- `@decky/ui`: `PanelSection`, `PanelSectionRow`, `Field`, `Focusable`, `Navigation`, `staticClasses`, `ErrorBoundary`
- `react-icons/fa`: `FaDownload`, `FaBox`, `FaCog`, `FaCubes`
- Existing: `RestartButton`, `useUpdateStatus`, `ROUTES`

---

## 7. Testing

| What | Type | Assertion |
|------|------|-----------|
| `NavTile` renders icon + title + description | Unit | Find title text, description text, icon present |
| `NavTile` navigates on click | Unit | Mock `Navigation.Navigate`, click tile, verify called with correct route |
| `StatsCard` shows count when loaded | Unit | `installedCount=12` → renders "12 scripts installed" |
| `StatsCard` shows placeholder when null | Unit | `installedCount=null` → renders "—" |
| `StatsCard` shows empty message when 0 | Unit | `installedCount=0` → renders "No scripts installed" |
| `MainPanel` fetches count on mount | Unit | Mock `get_installed_apps`, verify called |
| `index.tsx` renders without crash | Smoke | Existing test suite passes |

Tests use **Vitest + React Testing Library** (already configured). New test file: `src/__tests__/MainPanel.test.tsx`.

---

## 8. Spec Updates (Post-Implementation)

| Spec | Update |
|------|--------|
| `openspec/specs/frontend.md` | QAM Panels section: MainPanel is now a dashboard with StatsCard + NavTile sub-components |
| `openspec/specs/architecture.md` | Add `src/main/` directory to file tree |

---

## 9. Non-Goals

- Styling changes to DownloadPanel, InstalledApps, SettingsPanel, or any modals
- New IPC callables (reuses existing `get_installed_apps`, `useUpdateStatus`)
- CSS files or CSS modules (follows existing inline-style pattern)
- Internationalization (English hardcoded, consistent with project scope)
