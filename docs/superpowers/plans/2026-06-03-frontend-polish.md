# Frontend Polish & Layout Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Decky-STPlugin frontend with modern card-style layouts, proper Decky components (ProgressBarWithInfo, ConfirmModal, SteamSpinner, ControlsList, ErrorBoundary), design tokens, and top-bar safe-area padding.

**Architecture:** 11 files modified + 1 new file (`src/shared/styles.ts`). No backend changes. New Decky component imports but no new dependencies. Each task is self-contained — all share the new styles.ts but otherwise can be done in any order.

**Tech Stack:** TypeScript, React, `@decky/ui@4.11.4`, `@decky/api@1.1.3`, `react-icons@5.3.0`

**Files touched:** 11 modify + 1 create. No backend changes.

---

### Task 1: Create shared design tokens

**Files:**
- Create: `src/shared/styles.ts`

- [ ] **Step 1: Create the file**

```typescript
export const SPACING = {
  /** Top padding to clear the QAM header bar on all panels */
  panelTopPadding: "8px",
  /** Gap between major content sections */
  sectionGap: "16px",
  /** Gap within a section row */
  rowGap: "4px",
  /** Gap between controls in a horizontal group */
  controlsGap: "8px",
  /** Vertical margin for divider lines */
  dividerMargin: "12px",
};

export const BORDER = {
  /** Subtle divider line between sections */
  divider: "1px solid var(--gpBackgroundLight)",
  /** Card/border radius (matches Steam's 3px convention) */
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No new errors (pre-existing LSP errors in stale files are expected).

- [ ] **Step 3: Commit**

```bash
git add src/shared/styles.ts
git commit -m "feat: add shared design tokens (spacing, borders, colors)"
```

---

### Task 2: Simplify useRestartSteam hook

**Files:**
- Modify: `src/shared/hooks/useRestartSteam.ts`
- Modify: `src/shared/types.ts` (remove `RestartState` type — or leave it, renamed)

- [ ] **Step 1: Rewrite the hook — remove "confirming" state, expose `confirmRestart`**

The hook no longer manages the confirm/cancel UI. It only does: fire IPC on `confirmRestart()`.

Replace the entire file content:

```typescript
import { useState, useCallback } from "react";
import { callable, toaster } from "@decky/api";

const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

export function useRestartSteam(onComplete?: () => void) {
  const [isRestarting, setIsRestarting] = useState(false);

  const confirmRestart = useCallback(async () => {
    setIsRestarting(true);
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
        onComplete?.();
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setIsRestarting(false);
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setIsRestarting(false);
    }
  }, [onComplete]);

  return { isRestarting, confirmRestart };
}
```

- [ ] **Step 2: Update the RestartState type to match**

In `src/shared/types.ts`, change:

```typescript
export type RestartState = "idle" | "confirming" | "restarting";
```

to:

```typescript
// RestartState removed — useRestartSteam now uses boolean isRestarting internally.
// Kept as export for backwards-compat; consumers should migrate.
export type RestartState = "idle" | "restarting";
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors from `useRestartSteam.ts`. `RestartButton.tsx` will have errors (it still uses old `restartState`/`handleCancel` — fixed in Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/shared/hooks/useRestartSteam.ts src/shared/types.ts
git commit -m "refactor: simplify useRestartSteam — remove confirming state"
```

---

### Task 3: Refactor RestartButton to use ConfirmModal

**Files:**
- Modify: `src/shared/components/RestartButton.tsx`

- [ ] **Step 1: Replace with ConfirmModal-based implementation**

Replace the entire file content:

```typescript
import React, { useState } from "react";
import { PanelSectionRow, ButtonItem, ConfirmModal, showModal } from "@decky/ui";
import { useRestartSteam } from "../hooks/useRestartSteam";

interface RestartButtonProps {
  onComplete?: () => void;
}

export function RestartButton({ onComplete }: RestartButtonProps) {
  const { isRestarting, confirmRestart } = useRestartSteam(onComplete);

  const handleClick = () => {
    showModal(
      <ConfirmModal
        strTitle="Restart Steam?"
        strDescription="Steam will close and restart. Any running games will be terminated."
        strOKButtonText="Restart Steam"
        strCancelButtonText="Cancel"
        onOK={() => confirmRestart()}
      />
    );
  };

  return (
    <PanelSectionRow>
      <ButtonItem
        layout="below"
        onClick={handleClick}
        disabled={isRestarting}
      >
        {isRestarting ? "Restarting..." : "Restart Steam"}
      </ButtonItem>
    </PanelSectionRow>
  );
}
```

> **Note:** If `ConfirmModal` API differs (e.g., uses `closeModal` prop or requires different prop names), adjust accordingly. The intent is: show a native Steam confirmation dialog on click, call `confirmRestart()` when user confirms.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: `RestartButton.tsx` compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/RestartButton.tsx
git commit -m "refactor: use ConfirmModal for RestartButton confirmation"
```

---

### Task 4: Polish MainPanel

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Add subtitle, ControlsList grouping, padding wrapper, ErrorBoundary**

Replace the `MainPanel` function and the `definePlugin` call's `content` in `src/index.tsx`:

The imports at the top need updating. Replace the `@decky/ui` import line with:

```typescript
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
} from "@decky/ui";
```

Add a styles import after existing imports:

```typescript
import { SPACING } from "./shared/styles";
```

Replace the `MainPanel` function entirely:

```typescript
function MainPanel() {
  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <PanelSection title={PLUGIN_NAME}>
        <PanelSectionRow>
          <div
            className={staticClasses.Label}
            style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px", marginBottom: SPACING.sectionGap }}
          >
            Lua script downloader for Steam games
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <ControlsList spacing="standard">
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.download)}
            >
              Download Lua Script
            </ButtonItem>
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.installed)}
            >
              Installed Scripts
            </ButtonItem>
            <ButtonItem
              layout="below"
              onClick={() => Navigation.Navigate(ROUTES.settings)}
            >
              Settings
            </ButtonItem>
          </ControlsList>
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ borderTop: "1px solid var(--gpBackgroundLight)", margin: `${SPACING.dividerMargin} 0` }} />
        </PanelSectionRow>

        <RestartButton />
      </PanelSection>
    </div>
  );
}
```

Also wrap the returned `content` with `ErrorBoundary`. Change:

```typescript
content: <MainPanel />,
```

to:

```typescript
content: (
  <ErrorBoundary>
    <MainPanel />
  </ErrorBoundary>
),
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: polish MainPanel — subtitle, ControlsList, padding, ErrorBoundary"
```

---

### Task 5: Polish DownloadForm

**Files:**
- Modify: `src/download/DownloadForm.tsx`

- [ ] **Step 1: Import ControlsList, SteamSpinner, and styles**

Change the `@decky/ui` import to include new components:

```typescript
import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
  ControlsList,
  SteamSpinner,
} from "@decky/ui";
```

Add style import:

```typescript
import { SPACING } from "../shared/styles";
```

Add a loading state for name resolution:

```typescript
const [resolving, setResolving] = useState(false);
```

- [ ] **Step 2: Replace the mode toggle div with ControlsList**

Change this block (the App ID / Search toggle):

```tsx
<PanelSectionRow>
  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
    <ButtonItem
      layout="below"
      onClick={() => handleModeChange("appid")}
      disabled={inputMode === "appid"}
    >
      App ID
    </ButtonItem>
    <ButtonItem
      layout="below"
      onClick={() => handleModeChange("search")}
      disabled={inputMode === "search"}
    >
      Search
    </ButtonItem>
  </div>
</PanelSectionRow>
```

to:

```tsx
<PanelSectionRow>
  <ControlsList spacing="standard">
    <ButtonItem
      layout="below"
      onClick={() => handleModeChange("appid")}
      disabled={inputMode === "appid"}
    >
      App ID
    </ButtonItem>
    <ButtonItem
      layout="below"
      onClick={() => handleModeChange("search")}
      disabled={inputMode === "search"}
    >
      Search
    </ButtonItem>
  </ControlsList>
</PanelSectionRow>
```

- [ ] **Step 3: Add SteamSpinner during name resolution**

Update the `resolveName` callback to set loading state:

```typescript
const resolveName = useCallback(async () => {
  const id = parseInt(appidInput);
  if (isNaN(id) || id <= 0) {
    setResolvedName("");
    return;
  }
  setResolving(true);
  try {
    const name = await getAppName(id);
    setResolvedName(name);
  } catch {
    setResolvedName("");
  } finally {
    setResolving(false);
  }
}, [appidInput]);
```

Update the resolved name display to show spinner while resolving:

```tsx
{resolvedName && (
  <PanelSectionRow>
    <div className={staticClasses.Label}>{resolvedName}</div>
  </PanelSectionRow>
)}
{resolving && (
  <PanelSectionRow>
    <div style={{ display: "flex", alignItems: "center", gap: SPACING.controlsGap }}>
      <SteamSpinner />
      <span className={staticClasses.Label} style={{ color: "var(--gpSystemLighterGrey)" }}>
        Resolving game name...
      </span>
    </div>
  </PanelSectionRow>
)}
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `DownloadForm.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/download/DownloadForm.tsx
git commit -m "feat: polish DownloadForm — ControlsList, SteamSpinner"
```

---

### Task 6: Replace GameSearchDropdown hover with React state

**Files:**
- Modify: `src/download/GameSearchDropdown.tsx`

- [ ] **Step 1: Replace DOM mutation hover with React state**

Replace the entire file content:

```typescript
import React, { useState } from "react";
import { staticClasses } from "@decky/ui";
import type { GameSearchResult } from "../shared/types";
import { COLOR, BORDER } from "../shared/styles";

export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
}

export function GameSearchDropdown({ results, onSelect }: GameSearchDropdownProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (results.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          padding: "12px 16px",
          color: COLOR.muted,
          fontSize: "14px",
          backgroundColor: COLOR.backgroundMedium,
          border: `1px solid ${COLOR.backgroundLight}`,
          borderTop: "none",
          borderBottomLeftRadius: BORDER.cardRadius,
          borderBottomRightRadius: BORDER.cardRadius,
        }}
      >
        No results found
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        maxHeight: "320px",
        overflowY: "auto",
        backgroundColor: COLOR.backgroundMedium,
        border: `1px solid ${COLOR.backgroundLight}`,
        borderTop: "none",
        borderBottomLeftRadius: BORDER.cardRadius,
        borderBottomRightRadius: BORDER.cardRadius,
      }}
    >
      {results.map((result, i) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: `1px solid ${COLOR.backgroundLight}`,
            backgroundColor: hoveredIndex === i ? COLOR.backgroundHard : "transparent",
          }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {result.img ? (
            <img
              src={result.img}
              alt={result.name}
              style={{
                width: "120px",
                height: "45px",
                objectFit: "cover",
                borderRadius: BORDER.cardRadius,
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: "120px",
                height: "45px",
                backgroundColor: COLOR.backgroundHard,
                borderRadius: BORDER.cardRadius,
                flexShrink: 0,
              }}
            />
          )}
          <span
            className={staticClasses.Label}
            style={{
              fontSize: "14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {result.name}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Key changes:
- Added `useState<number | null>(null)` for `hoveredIndex`
- `onMouseEnter` → `setHoveredIndex(i)`, `onMouseLeave` → `setHoveredIndex(null)`
- Row `backgroundColor` reads from state instead of DOM mutation
- Hardcoded `var(--gp...)` replaced with `COLOR` / `BORDER` tokens

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `GameSearchDropdown.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/download/GameSearchDropdown.tsx
git commit -m "refactor: replace DOM hover with React state in GameSearchDropdown"
```

---

### Task 7: Replace DownloadProgress with ProgressBarWithInfo

**Files:**
- Modify: `src/download/DownloadProgress.tsx`

- [ ] **Step 1: Rewrite using ProgressBarWithInfo**

Replace the entire file content:

```typescript
import React from "react";
import { PanelSectionRow, ButtonItem, ProgressBarWithInfo } from "@decky/ui";
import type { DownloadProgress as DownloadProgressType } from "../shared/types";

interface DownloadProgressProps {
  state: DownloadProgressType;
  onCancel: () => void;
}

export function DownloadProgress({ state, onCancel }: DownloadProgressProps) {
  const isActive = !["done", "error", "cancelled"].includes(state.phase);
  const isIndeterminate = state.percent <= 0 || state.phase === "fetching";

  return (
    <>
      <PanelSectionRow>
        <ProgressBarWithInfo
          nProgress={isIndeterminate ? undefined : state.percent}
          indeterminate={isIndeterminate}
          sOperationText={state.message}
          nTransitionSec={0.5}
        />
      </PanelSectionRow>
      {isActive && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onCancel}>
            Cancel Download
          </ButtonItem>
        </PanelSectionRow>
      )}
    </>
  );
}
```

> **Note:** `ProgressBarWithInfo` props verified from `@decky/ui@4.11.4` type definitions. If `nTransitionSec` or `indeterminate` don't exist in this version, drop them — the core props are `nProgress` and `sOperationText`.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `DownloadProgress.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/download/DownloadProgress.tsx
git commit -m "feat: replace text progress with ProgressBarWithInfo"
```

---

### Task 8: Polish PostDownloadRestart layout

**Files:**
- Modify: `src/download/PostDownloadRestart.tsx`

- [ ] **Step 1: Apply style tokens**

Replace the entire file content:

```typescript
import React from "react";
import { PanelSectionRow, ButtonItem, staticClasses } from "@decky/ui";
import { RestartButton } from "../shared/components/RestartButton";
import { COLOR, SPACING } from "../shared/styles";

interface PostDownloadRestartProps {
  onDismiss: () => void;
}

export function PostDownloadRestart({ onDismiss }: PostDownloadRestartProps) {
  return (
    <>
      <PanelSectionRow>
        <div
          className={staticClasses.Label}
          style={{ color: COLOR.success, marginBottom: SPACING.rowGap }}
        >
          Download complete!
        </div>
      </PanelSectionRow>
      <RestartButton onComplete={onDismiss} />
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onDismiss}>
          Close
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
```

The key polish here: uses `COLOR.success` + `SPACING` tokens instead of raw `var(--gp…)` strings. The `RestartButton` already got its `ConfirmModal` upgrade in Task 3. Layout stays clean with each action in its own row (standard Decky pattern).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `PostDownloadRestart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/download/PostDownloadRestart.tsx
git commit -m "feat: polish PostDownloadRestart — design tokens"
```

---

### Task 9: Add padding wrapper to DownloadPanel

**Files:**
- Modify: `src/download/DownloadPanel.tsx`

- [ ] **Step 1: Wrap PanelSection with padding div**

Replace the `return` statement. The `PanelSection` should be wrapped in a `div` with top padding:

```tsx
import { PanelSection } from "@decky/ui";
import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { PostDownloadRestart } from "./PostDownloadRestart";
import { useDownloadLifecycle } from "./hooks/useDownloadLifecycle";
import { SPACING } from "../shared/styles";

export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <PanelSection title="Download Lua Script">
        {!download.isActive && !showRestartPrompt && (
          <DownloadForm onStart={download.start} />
        )}
        {download.isActive && (
          <DownloadProgress state={download.state!} onCancel={download.cancel} />
        )}
        {showRestartPrompt && (
          <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
        )}
      </PanelSection>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `DownloadPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/download/DownloadPanel.tsx
git commit -m "feat: add safe-area padding to DownloadPanel"
```

---

### Task 10: Polish InstalledApps — card rows, ConfirmModal, ControlsList

**Files:**
- Modify: `src/installed/InstalledApps.tsx`

- [ ] **Step 1: Rewrite with card rows, ConfirmModal for delete, ControlsList**

Replace the entire file content:

```typescript
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
  ControlsList,
  ConfirmModal,
  showModal,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaTrash, FaRedo } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";
import { SPACING, BORDER, COLOR } from "../shared/styles";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");
const deleteApp = callable<[number], boolean>("delete_app");
const startDownload = callable<[number, string?], string>("start_download");

export function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);

  const loadApps = async () => {
    try {
      const result = await getInstalledApps();
      setApps(result);
    } catch {
      console.warn("[STPlugin] Failed to load installed apps");
      setApps([]);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = (appid: number, name: string) => {
    showModal(
      <ConfirmModal
        strTitle="Delete Script?"
        strDescription={`Delete ${name || `App ${appid}`}? This cannot be undone.`}
        strOKButtonText="Delete"
        strCancelButtonText="Cancel"
        bDestructiveWarning={true}
        onOK={async () => {
          const ok = await deleteApp(appid);
          if (ok) {
            toaster.toast({ title: "STPlugin", body: `Removed ${name || `App ${appid}`}` });
            await loadApps();
          } else {
            toaster.toast({ title: "Error", body: "Failed to remove Lua file" });
          }
        }}
      />
    );
  };

  const handleRedownload = async (appid: number) => {
    const taskId = await startDownload(appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading App ${appid}...` });
  };

  if (apps.length === 0) {
    return (
      <div style={{ paddingTop: SPACING.panelTopPadding }}>
        <PanelSection title="Installed Scripts">
          <PanelSectionRow>
            <div className={staticClasses.Label} style={{ color: COLOR.muted }}>
              No Lua scripts installed yet.
            </div>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <PanelSection title="Installed Scripts">
        {apps.map((app) => (
          <React.Fragment key={app.appid}>
            <PanelSectionRow>
              <div style={{ display: "flex", alignItems: "center", gap: SPACING.controlsGap }}>
                <span
                  className={staticClasses.Label}
                  style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {app.name || `App ${app.appid}`}
                </span>
                <ControlsList spacing="standard">
                  <ButtonItem onClick={() => handleRedownload(app.appid)}>
                    <FaRedo />
                  </ButtonItem>
                  <ButtonItem onClick={() => handleDelete(app.appid, app.name)}>
                    <FaTrash />
                  </ButtonItem>
                </ControlsList>
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ borderTop: BORDER.divider, margin: `0 0 ${SPACING.rowGap} 0` }} />
            </PanelSectionRow>
          </React.Fragment>
        ))}
      </PanelSection>
    </div>
  );
}
```

> **Note:** If `bDestructiveWarning` doesn't exist on `ConfirmModal`, remove it — it's a nice-to-have that makes the delete button red/destructive in the modal.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `InstalledApps.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/installed/InstalledApps.tsx
git commit -m "feat: polish InstalledApps — card rows, ConfirmModal, ControlsList"
```

---

### Task 11: Polish SettingsPanel — dividers and layout

**Files:**
- Modify: `src/settings/SettingsPanel.tsx`

- [ ] **Step 1: Add visual dividers between setting groups**

Replace the entire file content:

```typescript
import {
  PanelSection,
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaSync } from "react-icons/fa";
import type { Settings } from "../shared/types";
import { SETTINGS_KEYS } from "../shared/constants";
import { SPACING, BORDER } from "../shared/styles";

const getSettings = callable<[], Settings>("get_settings");
const setSetting = callable<[string, any], void>("set_setting");
const refreshApiManifest = callable<[], { name: string; url: string }[]>("refresh_api_manifest");

export function SettingsPanel() {
  const [fastDownload, setFastDownload] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    getSettings().then((s) => {
      setFastDownload(s.fastDownload);
      setApiKey(s.morrenusApiKey);
    });
  }, []);

  const handleFastDownload = async (checked: boolean) => {
    setFastDownload(checked);
    await setSetting(SETTINGS_KEYS.fastDownload, checked);
  };

  const handleApiKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    await setSetting(SETTINGS_KEYS.apiKey, value);
  };

  const handleRefresh = async () => {
    const sources = await refreshApiManifest();
    toaster.toast({
      title: "STPlugin",
      body: `Loaded ${sources.length} API sources`,
    });
  };

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      <PanelSection title="Settings">
        <PanelSectionRow>
          <ToggleField
            label="Fast Download"
            description="Skip source picker — auto-select first working API source"
            checked={fastDownload}
            onChange={handleFastDownload}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
        </PanelSectionRow>

        <PanelSectionRow>
          <TextField
            label="Morrenus API Key"
            description="Optional"
            value={apiKey}
            onChange={handleApiKeyChange}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
        </PanelSectionRow>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleRefresh}>
            <FaSync style={{ marginRight: "4px" }} />
            Refresh API Sources
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}
```

Key changes:
- `paddingTop` wrapper for safe area
- Divider lines between all three sections
- `description="Optional"` on the API key `TextField` (no separate label row needed)
- `handleApiKeyChange` takes the event object directly (matches `TextField.onChange` type)
- Icon spacing via `marginRight`

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors in `SettingsPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/settings/SettingsPanel.tsx
git commit -m "feat: polish SettingsPanel — dividers, description, safe-area"
```

---

### Task 12: Build, full type check, and final verification

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: No type errors. Pre-existing errors related to `./components/DownloadPanel` or `decky` in Python files may appear — those are stale import paths from files that were already moved in a previous refactor. Ignore those. Focus on: no NEW errors in `src/index.tsx`, `src/download/`, `src/installed/`, `src/settings/`, `src/shared/`.

- [ ] **Step 2: Run the build**

```bash
pnpm build
```

Expected: Build succeeds, produces `dist/index.js`. No build errors.

- [ ] **Step 3: Verify the build output contains new components**

```bash
rg "ProgressBarWithInfo\|ConfirmModal\|SteamSpinner\|ControlsList\|ErrorBoundary" dist/index.js
```

Expected: Matches found — the new Decky component references are included in the bundle.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build: verify frontend polish build succeeds"
```

---

## Verification Checklist

After all tasks, manually verify on the Windows Decky build:

1. **MainPanel:** Subtitle visible, 3 buttons grouped, no top-bar clipping, Restart opens ConfirmModal
2. **DownloadPanel:** Form loads, toggle between App ID / Search, `SteamSpinner` shows during name resolution, `ProgressBarWithInfo` shows during download, post-download prompt shows Restart + Close
3. **InstalledApps:** Card rows with dividers, delete opens `ConfirmModal`, re-download works
4. **Settings:** Three sections separated by dividers, toggle works, API key field works, refresh works
5. **No white screen on error:** `ErrorBoundary` catches any render crash

