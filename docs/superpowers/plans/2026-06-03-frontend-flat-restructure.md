# Frontend Flat Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all main page files flat to `src/` root, with page-specific components in per-page `components/` subfolders and page-specific hooks in per-page `hooks/` subfolders.

**Architecture:** Pure file restructure — no behavior changes. Page-level files (`DownloadPanel`, `DownloadForm`, `InstalledApps`, `SettingsPanel`) move to `src/`. Their sub-components move into `src/<page>/components/`. Import paths update accordingly. `shared/` stays as-is.

**Tech Stack:** TypeScript, React, Rollup (`@decky/rollup`)

---

## Target Structure

```
src/
├── index.tsx                              (no change)
├── DownloadPanel.tsx                      (moved from download/)
├── DownloadForm.tsx                       (moved from download/)
├── InstalledApps.tsx                      (moved from installed/)
├── SettingsPanel.tsx                      (moved from settings/)
├── download/
│   ├── components/
│   │   ├── DownloadProgress.tsx           (moved from download/)
│   │   ├── GameSearchDropdown.tsx         (moved from download/)
│   │   └── PostDownloadRestart.tsx        (moved from download/)
│   └── hooks/
│       ├── useDebouncedSearch.ts          (no change)
│       └── useDownloadLifecycle.ts        (no change)
├── installed/
│   └── components/
│       ├── InstalledAppCard.tsx           (moved from installed/)
│       └── SkeletonCard.tsx               (moved from installed/)
└── shared/                                (no change)
    ├── types.ts
    ├── styles.ts
    ├── constants.ts
    ├── components/
    │   ├── PageLayout.tsx
    │   └── RestartButton.tsx
    └── hooks/
        └── useRestartSteam.ts
```

---

### Task 1: Create directory structure and move files

**Files:**
- Create: `src/download/components/`
- Create: `src/installed/components/`
- Move: 8 files to new locations

- [ ] **Step 1: Create new component directories**

```bash
mkdir -p src/download/components src/installed/components
```

- [ ] **Step 2: Move page files to src/ root**

```bash
mv src/download/DownloadPanel.tsx src/DownloadPanel.tsx
mv src/download/DownloadForm.tsx src/DownloadForm.tsx
mv src/installed/InstalledApps.tsx src/InstalledApps.tsx
mv src/settings/SettingsPanel.tsx src/SettingsPanel.tsx
```

- [ ] **Step 3: Move download sub-components**

```bash
mv src/download/DownloadProgress.tsx src/download/components/DownloadProgress.tsx
mv src/download/GameSearchDropdown.tsx src/download/components/GameSearchDropdown.tsx
mv src/download/PostDownloadRestart.tsx src/download/components/PostDownloadRestart.tsx
```

- [ ] **Step 4: Move installed sub-components**

```bash
mv src/installed/InstalledAppCard.tsx src/installed/components/InstalledAppCard.tsx
mv src/installed/SkeletonCard.tsx src/installed/components/SkeletonCard.tsx
```

- [ ] **Step 5: Clean up empty directories**

```bash
rmdir src/settings
# download/ and installed/ still have hooks/components subdirs, so keep them
```

- [ ] **Step 6: Verify file structure**

Run: `find src -type f | sort`
Expected:
```
src/DownloadForm.tsx
src/DownloadPanel.tsx
src/InstalledApps.tsx
src/SettingsPanel.tsx
src/download/components/DownloadProgress.tsx
src/download/components/GameSearchDropdown.tsx
src/download/components/PostDownloadRestart.tsx
src/download/hooks/useDebouncedSearch.ts
src/download/hooks/useDownloadLifecycle.ts
src/index.tsx
src/installed/components/InstalledAppCard.tsx
src/installed/components/SkeletonCard.tsx
src/shared/components/PageLayout.tsx
src/shared/components/RestartButton.tsx
src/shared/constants.ts
src/shared/hooks/useRestartSteam.ts
src/shared/styles.ts
src/shared/types.ts
```

---

### Task 2: Update imports in DownloadPanel.tsx

**Files:**
- Modify: `src/DownloadPanel.tsx`

- [ ] **Step 1: Update all imports**

Replace the import block in `src/DownloadPanel.tsx` with:

```tsx
import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./download/components/DownloadProgress";
import { PostDownloadRestart } from "./download/components/PostDownloadRestart";
import { useDownloadLifecycle } from "./download/hooks/useDownloadLifecycle";
import { PageLayout } from "./shared/components/PageLayout";
```

Changes:
- `./DownloadForm` — stays same (both files now at `src/` root)
- `./DownloadProgress` → `./download/components/DownloadProgress`
- `./PostDownloadRestart` → `./download/components/PostDownloadRestart`
- `./hooks/useDownloadLifecycle` → `./download/hooks/useDownloadLifecycle`
- `../shared/components/PageLayout` → `./shared/components/PageLayout`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors for DownloadPanel

---

### Task 3: Update imports in DownloadForm.tsx

**Files:**
- Modify: `src/DownloadForm.tsx`

- [ ] **Step 1: Update all imports**

Replace the import block in `src/DownloadForm.tsx` with:

```tsx
import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaGamepad } from "react-icons/fa";
import { GameSearchDropdown } from "./download/components/GameSearchDropdown";
import { useDebouncedSearch } from "./download/hooks/useDebouncedSearch";
import type { GameSearchResult } from "./shared/types";
import type { ApiSource } from "./shared/types";
import { CARD } from "./shared/styles";
```

Changes:
- `./GameSearchDropdown` → `./download/components/GameSearchDropdown`
- `./hooks/useDebouncedSearch` → `./download/hooks/useDebouncedSearch`
- `../shared/types` → `./shared/types`
- `../shared/styles` → `./shared/styles`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors for DownloadForm

---

### Task 4: Update imports in InstalledApps.tsx

**Files:**
- Modify: `src/InstalledApps.tsx`

- [ ] **Step 1: Update all imports**

Replace the import block in `src/InstalledApps.tsx` with:

```tsx
import { ButtonItem, staticClasses } from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaBoxOpen, FaExclamationTriangle, FaSync } from "react-icons/fa";
import type { InstalledApp } from "./shared/types";
import { CARD, SPACING } from "./shared/styles";
import { PageLayout } from "./shared/components/PageLayout";
import { InstalledAppCard } from "./installed/components/InstalledAppCard";
import { SkeletonCard } from "./installed/components/SkeletonCard";
```

Changes:
- `../shared/types` → `./shared/types`
- `../shared/styles` → `./shared/styles`
- `../shared/components/PageLayout` → `./shared/components/PageLayout`
- `./InstalledAppCard` → `./installed/components/InstalledAppCard`
- `./SkeletonCard` → `./installed/components/SkeletonCard`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors for InstalledApps

---

### Task 5: Update imports in SettingsPanel.tsx

**Files:**
- Modify: `src/SettingsPanel.tsx`

- [ ] **Step 1: Update all imports**

Replace the import block in `src/SettingsPanel.tsx` with:

```tsx
import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";
import type { Settings } from "./shared/types";
import { SETTINGS_KEYS } from "./shared/constants";
import { SPACING, BORDER } from "./shared/styles";
import { PageLayout } from "./shared/components/PageLayout";
```

Changes:
- `../shared/types` → `./shared/types`
- `../shared/constants` → `./shared/constants`
- `../shared/styles` → `./shared/styles`
- `../shared/components/PageLayout` → `./shared/components/PageLayout`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors for SettingsPanel

---

### Task 6: Update imports in DownloadProgress.tsx

**Files:**
- Modify: `src/download/components/DownloadProgress.tsx`

- [ ] **Step 1: Update imports**

Replace line 3 in `src/download/components/DownloadProgress.tsx`:

```tsx
import type { DownloadProgress as DownloadProgressType } from "../../shared/types";
```

Change: `../shared/types` → `../../shared/types` (one level deeper now)

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 7: Update imports in GameSearchDropdown.tsx

**Files:**
- Modify: `src/download/components/GameSearchDropdown.tsx`

- [ ] **Step 1: Update imports**

Replace lines 3-4 in `src/download/components/GameSearchDropdown.tsx`:

```tsx
import type { GameSearchResult } from "../../shared/types";
import { COLOR, BORDER } from "../../shared/styles";
```

Change: `../shared/types` → `../../shared/types`, `../shared/styles` → `../../shared/styles`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 8: Update imports in PostDownloadRestart.tsx

**Files:**
- Modify: `src/download/components/PostDownloadRestart.tsx`

- [ ] **Step 1: Update imports**

Replace lines 3-4 in `src/download/components/PostDownloadRestart.tsx`:

```tsx
import { RestartButton } from "../../shared/components/RestartButton";
import { COLOR, SPACING } from "../../shared/styles";
```

Change: `../shared/components/RestartButton` → `../../shared/components/RestartButton`, `../shared/styles` → `../../shared/styles`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 9: Update imports in InstalledAppCard.tsx

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx`

- [ ] **Step 1: Update imports**

Replace lines 5-6 in `src/installed/components/InstalledAppCard.tsx`:

```tsx
import type { InstalledApp } from "../../shared/types";
import { CARD, SPACING } from "../../shared/styles";
```

Change: `../shared/types` → `../../shared/types`, `../shared/styles` → `../../shared/styles`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 10: Update imports in SkeletonCard.tsx

**Files:**
- Modify: `src/installed/components/SkeletonCard.tsx`

- [ ] **Step 1: Update imports**

Replace line 2 in `src/installed/components/SkeletonCard.tsx`:

```tsx
import { CARD } from "../../shared/styles";
```

Change: `../shared/styles` → `../../shared/styles`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 11: Update imports in RestartButton.tsx

**Files:**
- Modify: `src/shared/components/RestartButton.tsx`

- [ ] **Step 1: No changes needed**

`RestartButton.tsx` imports from `../hooks/useRestartSteam` — this relative path is still valid since both files stay in `shared/`. No changes required.

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No errors

---

### Task 12: Update imports in index.tsx

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Update page imports**

Replace lines 18-20 in `src/index.tsx`:

```tsx
import { DownloadPanel } from "./DownloadPanel";
import { InstalledApps } from "./InstalledApps";
import { SettingsPanel } from "./SettingsPanel";
```

Changes:
- `./download/DownloadPanel` → `./DownloadPanel`
- `./installed/InstalledApps` → `./InstalledApps`
- `./settings/SettingsPanel` → `./SettingsPanel`

- [ ] **Step 2: Verify build compiles**

Run: `npx rollup -c 2>&1 | head -20`
Expected: No import resolution errors

---

### Task 13: Full build verification and cleanup

**Files:**
- Verify: entire `src/` directory

- [ ] **Step 1: Run full build**

Run: `npx rollup -c`
Expected: Build succeeds, produces `dist/index.js` with no errors

- [ ] **Step 2: Verify no stale files remain**

Run: `find src/download -name "*.tsx" -not -path "*/components/*" -not -path "*/hooks/*"`
Expected: No output (all .tsx files should be in components/ or hooks/)

Run: `find src/installed -name "*.tsx" -not -path "*/components/*"`
Expected: No output

Run: `test -d src/settings && echo "STALE" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Update AGENTS.md**

Update the project structure section in `AGENTS.md` to reflect the new flat layout:

```
src/
├── index.tsx
├── DownloadPanel.tsx
├── DownloadForm.tsx
├── InstalledApps.tsx
├── SettingsPanel.tsx
├── download/
│   ├── components/
│   │   ├── DownloadProgress.tsx
│   │   ├── GameSearchDropdown.tsx
│   │   └── PostDownloadRestart.tsx
│   └── hooks/
│       ├── useDebouncedSearch.ts
│       └── useDownloadLifecycle.ts
├── installed/
│   └── components/
│       ├── InstalledAppCard.tsx
│       └── SkeletonCard.tsx
└── shared/
    ├── types.ts
    ├── styles.ts
    ├── constants.ts
    ├── components/
    │   ├── PageLayout.tsx
    │   └── RestartButton.tsx
    └── hooks/
        └── useRestartSteam.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: flatten frontend page files to src/ root

Move page-level components (DownloadPanel, DownloadForm, InstalledApps,
SettingsPanel) to src/ root. Move sub-components into per-page
components/ subfolders. Update all import paths. No behavior changes."
```
