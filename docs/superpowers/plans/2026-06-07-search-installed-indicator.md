# Search Results: Installed Script Indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a green "Installed" badge on game search results that already have a script downloaded.

**Architecture:** Frontend-only change. `DownloadForm` fetches installed app IDs on mount and via `download_progress` events, passes the ID list to `GameSearchDropdown` as a prop. `GameSearchDropdown` checks each result's ID against the list and conditionally renders a badge. No backend, type, or IPC changes.

**Tech Stack:** TypeScript, React, Decky UI (`@decky/ui`, `@decky/api`)

---

### Task 1: Add badge rendering to GameSearchDropdown

**Files:**
- Modify: `src/download/components/GameSearchDropdown.tsx`

- [ ] **Step 1: Add `installedAppids` prop to the component**

Add `installedAppids` to the props interface and destructure it with a default:

```tsx
export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  installedAppids: number[];
  onSelect: (result: GameSearchResult) => void;
}

export function GameSearchDropdown({ results, installedAppids = [], onSelect }: GameSearchDropdownProps) {
```

- [ ] **Step 2: Add the badge element inside each result row**

After the name `<span>` (line 99), before the closing `</div>` of the flex container (line 100), add:

```tsx
{installedAppids.includes(result.id) && (
  <span
    style={{
      marginLeft: "auto",
      fontSize: "11px",
      padding: "2px 6px",
      borderRadius: "4px",
      color: "#5cb85c",
      background: "rgba(92, 184, 92, 0.15)",
      fontWeight: 600,
      letterSpacing: "0.5px",
      flexShrink: 0,
    }}
  >
    Installed
  </span>
)}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/download/components/GameSearchDropdown.tsx
git commit -m "feat: add installedAppids prop and badge to GameSearchDropdown"
```

---

### Task 2: Fetch and pass installed app IDs from DownloadForm

**Files:**
- Modify: `src/DownloadForm.tsx`

- [ ] **Step 1: Add callable binding and state**

Add import for `InstalledApp` type alongside existing type imports (line 13):
```tsx
import type { GameSearchResult, ApiSource, InstalledApp } from "./shared/types";
```

Add `addEventListener`, `removeEventListener` import alongside existing `callable` import (line 8):
```tsx
import { callable, addEventListener, removeEventListener } from "@decky/api";
```

Add the IPC binding alongside existing ones (after line 19):
```tsx
const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");
```

Add state variable alongside existing state (after line 34):
```tsx
const [installedAppids, setInstalledAppids] = useState<number[]>([]);
```

- [ ] **Step 2: Add fetch-on-mount + event-driven refresh effect**

Add this `useEffect` after the existing effects (after line 58):
```tsx
useEffect(() => {
  // Fetch on mount
  getInstalledApps()
    .then((apps) => setInstalledAppids(apps.map((a) => a.appid)))
    .catch(() => {});

  // Refresh when any download completes
  const unsub = addEventListener("download_progress", (_taskId: string, data: any) => {
    if (data?.phase === "done") {
      getInstalledApps()
        .then((apps) => setInstalledAppids(apps.map((a) => a.appid)))
        .catch(() => {});
    }
  });

  return () => removeEventListener("download_progress", unsub);
}, []);
```

- [ ] **Step 3: Pass `installedAppids` to GameSearchDropdown**

Change the `GameSearchDropdown` usage (lines 89-93):
```tsx
<GameSearchDropdown
  results={searchResults}
  installedAppids={installedAppids}
  onSelect={handleSearchSelect}
/>
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/DownloadForm.tsx
git commit -m "feat: fetch installed app IDs and pass to GameSearchDropdown"
```

---

### Task 3: Verify end-to-end and run tests

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All 37 tests pass. No regressions.

- [ ] **Step 2: Final commit if tests revealed fixes**

```bash
git add -A
git commit -m "test: verify installed badge does not break existing tests"
```

- [ ] **Step 3: Print summary of changes**

```bash
git log --oneline -5
git diff --stat HEAD~5
```

Expected: Shows 2 files changed, ~30 lines added total across both commits.
