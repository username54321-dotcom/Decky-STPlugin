# Frontend Refactor for Maintainability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 750-line frontend from 5 monolithic files into a feature-co-located structure with shared types/constants, custom hooks, and focused components — preserving all behavior.

**Architecture:** Feature-co-location with `shared/`, `download/`, `installed/`, `settings/` folders. Custom hooks own all IPC and state. Components are either orchestrators (compose hooks + sub-components) or presentational (props-in, UI-out). Zero behavior changes.

**Tech Stack:** TypeScript, React (via Decky), `@decky/api`, `@decky/ui`, `react-icons/fa`

---

### Task 1: Create shared type definitions (`src/shared/types.ts`)

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/shared/types.ts

export interface GameSearchResult {
  id: number;
  name: string;
  img: string;
}

export interface ApiSource {
  name: string;
  url: string;
}

export interface DownloadProgress {
  task_id: string;
  phase: string;
  percent: number;
  message: string;
  appid?: number;
  error?: string;
}

export interface InstalledApp {
  appid: number;
  name: string;
}

export interface Settings {
  fastDownload: boolean;
  morrenusApiKey: string;
}

export type RestartState = "idle" | "confirming" | "restarting";
```

- [ ] **Step 2: Create the directory structure for `shared/`**

Run: `New-Item -ItemType Directory -Path "src/shared" -Force && New-Item -ItemType Directory -Path "src/shared/components" -Force && New-Item -ItemType Directory -Path "src/shared/hooks" -Force`

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 2: Create shared constants (`src/shared/constants.ts`)

**Files:**
- Create: `src/shared/constants.ts`

- [ ] **Step 1: Create the constants file**

```ts
// src/shared/constants.ts

export const ROUTES = {
  main: "/stplugin",
  download: "/stplugin/download",
  installed: "/stplugin/installed",
  settings: "/stplugin/settings",
} as const;

export const SETTINGS_KEYS = {
  fastDownload: "fastDownload",
  apiKey: "morrenusApiKey",
} as const;

export const PLUGIN_NAME = "STPlugin";
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/constants.ts
git commit -m "feat: add shared constants (routes, settings keys, plugin name)"
```

---

### Task 3: Create `useRestartSteam` hook (`src/shared/hooks/useRestartSteam.ts`)

**Files:**
- Create: `src/shared/hooks/useRestartSteam.ts`

- [ ] **Step 1: Create the hook**

This hook encapsulates the 3-state restart confirmation machine. It is extracted from the duplicated code in `src/index.tsx` (lines 24-50) and `src/components/DownloadPanel.tsx` (lines 54-73).

```ts
// src/shared/hooks/useRestartSteam.ts

import { useState, useCallback } from "react";
import { callable, toaster } from "@decky/api";
import type { RestartState } from "../types";

const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");

export function useRestartSteam(onComplete?: () => void) {
  const [restartState, setRestartState] = useState<RestartState>("idle");

  const handleRestart = useCallback(async () => {
    if (restartState === "idle") {
      setRestartState("confirming");
      return;
    }

    if (restartState === "confirming") {
      setRestartState("restarting");
      try {
        const result = await restartSteam();
        if (result.success) {
          toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
          onComplete?.();
        } else {
          toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
          setRestartState("idle");
        }
      } catch (err: any) {
        toaster.toast({ title: "Restart Failed", body: String(err) });
        setRestartState("idle");
      }
    }
  }, [restartState, onComplete]);

  const handleCancel = useCallback(() => {
    setRestartState("idle");
  }, []);

  return { restartState, handleRestart, handleCancel };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/hooks/useRestartSteam.ts
git commit -m "feat: add useRestartSteam hook (shared restart state machine)"
```

---

### Task 4: Create `RestartButton` component (`src/shared/components/RestartButton.tsx`)

**Files:**
- Create: `src/shared/components/RestartButton.tsx`

- [ ] **Step 1: Create the shared restart button component**

This component replaces the duplicated restart UI in `src/index.tsx` (lines 79-104) and `src/components/DownloadPanel.tsx` (lines 330-357). It uses the `useRestartSteam` hook internally.

```tsx
// src/shared/components/RestartButton.tsx

import React from "react";
import { PanelSectionRow, ButtonItem, staticClasses } from "@decky/ui";
import { useRestartSteam } from "../hooks/useRestartSteam";

interface RestartButtonProps {
  onComplete?: () => void;
}

export function RestartButton({ onComplete }: RestartButtonProps) {
  const { restartState, handleRestart, handleCancel } = useRestartSteam(onComplete);

  return (
    <PanelSectionRow>
      {restartState === "confirming" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            className={staticClasses.Label}
            style={{ color: "var(--gpSystemYellow)", marginBottom: "4px" }}
          >
            Restart Steam?
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <ButtonItem layout="below" onClick={handleCancel}>
              Cancel
            </ButtonItem>
            <ButtonItem layout="below" onClick={handleRestart}>
              Yes, restart
            </ButtonItem>
          </div>
        </div>
      ) : (
        <ButtonItem
          layout="below"
          onClick={handleRestart}
          disabled={restartState === "restarting"}
        >
          {restartState === "restarting" ? "Restarting..." : "Restart Steam"}
        </ButtonItem>
      )}
    </PanelSectionRow>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/RestartButton.tsx
git commit -m "feat: add shared RestartButton component (deduplicates restart flow)"
```

---

### Task 5: Move and clean up `GameSearchDropdown` (`src/download/GameSearchDropdown.tsx`)

**Files:**
- Move + Modify: `src/components/GameSearchDropdown.tsx` → `src/download/GameSearchDropdown.tsx`

- [ ] **Step 1: Create the `download/` directory structure**

Run: `New-Item -ItemType Directory -Path "src/download" -Force && New-Item -ItemType Directory -Path "src/download/hooks" -Force`

- [ ] **Step 2: Write the cleaned-up GameSearchDropdown**

The component is moved to `download/` and the dead `onClose` prop is removed. Types (`GameSearchResult`) are imported from `shared/types.ts` instead of defined inline.

```tsx
// src/download/GameSearchDropdown.tsx

import React from "react";
import { staticClasses } from "@decky/ui";
import type { GameSearchResult } from "../shared/types";

export interface GameSearchDropdownProps {
  results: GameSearchResult[];
  onSelect: (result: GameSearchResult) => void;
}

export function GameSearchDropdown({ results, onSelect }: GameSearchDropdownProps) {
  if (results.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          padding: "12px 16px",
          color: "var(--gpSystemLighterGrey)",
          fontSize: "14px",
          backgroundColor: "var(--gpBackgroundMedium)",
          border: "1px solid var(--gpBackgroundLight)",
          borderTop: "none",
          borderBottomLeftRadius: "3px",
          borderBottomRightRadius: "3px",
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
        backgroundColor: "var(--gpBackgroundMedium)",
        border: "1px solid var(--gpBackgroundLight)",
        borderTop: "none",
        borderBottomLeftRadius: "3px",
        borderBottomRightRadius: "3px",
      }}
    >
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid var(--gpBackgroundLight)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--gpBackgroundHard)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
        >
          {result.img ? (
            <img
              src={result.img}
              alt={result.name}
              style={{
                width: "120px",
                height: "45px",
                objectFit: "cover",
                borderRadius: "3px",
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
                backgroundColor: "var(--gpBackgroundHard)",
                borderRadius: "3px",
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

- [ ] **Step 3: Remove the old file**

Run: `Remove-Item -LiteralPath "src/components/GameSearchDropdown.tsx"`

- [ ] **Step 4: Commit**

```bash
git add src/download/GameSearchDropdown.tsx
git rm src/components/GameSearchDropdown.tsx
git commit -m "refactor: move GameSearchDropdown to download/, remove dead onClose prop, use shared types"
```

---

### Task 6: Create `useDebouncedSearch` hook (`src/download/hooks/useDebouncedSearch.ts`)

**Files:**
- Create: `src/download/hooks/useDebouncedSearch.ts`

- [ ] **Step 1: Create the debounced search hook**

Extracted from `src/components/DownloadPanel.tsx` lines 113-132.

```ts
// src/download/hooks/useDebouncedSearch.ts

import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { GameSearchResult } from "../../shared/types";

const searchGames = callable<[string], GameSearchResult[]>("search_games");

export function useDebouncedSearch(query: string, mode: "appid" | "search") {
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (mode !== "search" || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    cancelledRef.current = false;

    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchGames(query.trim());
        if (!cancelledRef.current) {
          setResults(data);
        }
      } catch {
        if (!cancelledRef.current) {
          setResults([]);
        }
      } finally {
        if (!cancelledRef.current) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timerRef.current);
      cancelledRef.current = true;
    };
  }, [query, mode]);

  return { results, searching };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/download/hooks/useDebouncedSearch.ts
git commit -m "feat: add useDebouncedSearch hook (extracted from DownloadPanel)"
```

---

### Task 7: Create `useDownloadLifecycle` hook (`src/download/hooks/useDownloadLifecycle.ts`)

**Files:**
- Create: `src/download/hooks/useDownloadLifecycle.ts`

- [ ] **Step 1: Create the download lifecycle hook**

Extracted from `src/components/DownloadPanel.tsx` lines 80-111 (event listener) and lines 144-172 (start/cancel handlers).

```ts
// src/download/hooks/useDownloadLifecycle.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import type { DownloadProgress } from "../../shared/types";

const startDownload = callable<[number, string?], string>("start_download");
const cancelDownload = callable<[string], void>("cancel_download");

export function useDownloadLifecycle(onComplete: () => void) {
  const [state, setState] = useState<DownloadProgress | null>(null);
  const [isActive, setIsActive] = useState(false);
  const currentTaskIdRef = useRef<string>("");

  // Listen for download progress events
  useEffect(() => {
    if (!currentTaskIdRef.current) return;

    const handleProgress = (taskId: string, progress: DownloadProgress) => {
      if (taskId !== currentTaskIdRef.current) return;

      setState(progress);

      if (progress.phase === "done") {
        setIsActive(false);
        toaster.toast({
          title: "STPlugin",
          body: `Installed Lua for App ${progress.appid}`,
        });
        onComplete();
      } else if (progress.phase === "error") {
        setIsActive(false);
        toaster.toast({
          title: "Download Failed",
          body: progress.message || "Unknown error",
        });
      } else if (progress.phase === "cancelled") {
        setIsActive(false);
      }
    };

    const unlisten = addEventListener<[string, DownloadProgress]>(
      "download_progress",
      handleProgress
    );

    return () => {
      removeEventListener("download_progress", unlisten);
    };
  }, [currentTaskIdRef.current, onComplete]);

  const start = useCallback(async (appid: number, source?: string) => {
    const taskId = await startDownload(appid, source);
    currentTaskIdRef.current = taskId;
    setIsActive(true);
    setState({
      task_id: taskId,
      phase: "fetching_apis",
      percent: 0,
      message: "Starting...",
    });
  }, []);

  const cancel = useCallback(async () => {
    if (currentTaskIdRef.current) {
      await cancelDownload(currentTaskIdRef.current);
      setIsActive(false);
      setState({
        task_id: currentTaskIdRef.current,
        phase: "cancelled",
        percent: 0,
        message: "Cancelled",
      });
      currentTaskIdRef.current = "";
    }
  }, []);

  return { isActive, state, start, cancel };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/download/hooks/useDownloadLifecycle.ts
git commit -m "feat: add useDownloadLifecycle hook (extracted from DownloadPanel)"
```

---

### Task 8: Create `DownloadProgress` component (`src/download/DownloadProgress.tsx`)

**Files:**
- Create: `src/download/DownloadProgress.tsx`

- [ ] **Step 1: Create the presentational progress component**

Extracted from `src/components/DownloadPanel.tsx` lines 311-327.

```tsx
// src/download/DownloadProgress.tsx

import React from "react";
import { PanelSectionRow, ButtonItem } from "@decky/ui";
import type { DownloadProgress as DownloadProgressType } from "../shared/types";

interface DownloadProgressProps {
  state: DownloadProgressType;
  onCancel: () => void;
}

export function DownloadProgress({ state, onCancel }: DownloadProgressProps) {
  const isActive = !["done", "error", "cancelled"].includes(state.phase);

  return (
    <PanelSectionRow>
      <div>
        <div>
          {state.phase}: {state.message}
        </div>
        {state.percent > 0 && <div>Progress: {state.percent}%</div>}
        {isActive && (
          <ButtonItem layout="below" onClick={onCancel}>
            Cancel
          </ButtonItem>
        )}
      </div>
    </PanelSectionRow>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/download/DownloadProgress.tsx
git commit -m "feat: add DownloadProgress presentational component"
```

---

### Task 9: Create `PostDownloadRestart` component (`src/download/PostDownloadRestart.tsx`)

**Files:**
- Create: `src/download/PostDownloadRestart.tsx`

- [ ] **Step 1: Create the post-download restart prompt**

Uses the shared `RestartButton` component.

```tsx
// src/download/PostDownloadRestart.tsx

import React from "react";
import { PanelSectionRow, staticClasses } from "@decky/ui";
import { RestartButton } from "../shared/components/RestartButton";

interface PostDownloadRestartProps {
  onDismiss: () => void;
}

export function PostDownloadRestart({ onDismiss }: PostDownloadRestartProps) {
  return (
    <>
      <PanelSectionRow>
        <div className={staticClasses.Label} style={{ color: "var(--gpSystemGreen)" }}>
          Download complete!
        </div>
      </PanelSectionRow>
      <RestartButton onComplete={onDismiss} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/download/PostDownloadRestart.tsx
git commit -m "feat: add PostDownloadRestart component (uses shared RestartButton)"
```

---

### Task 10: Create `DownloadForm` component (`src/download/DownloadForm.tsx`)

**Files:**
- Create: `src/download/DownloadForm.tsx`

- [ ] **Step 1: Create the download form component**

Extracted from `src/components/DownloadPanel.tsx` — all input logic (lines 39-51 state, lines 80-86 useEffect, lines 134-191 handlers, lines 197-299 JSX). Uses `useDebouncedSearch` internally.

```tsx
// src/download/DownloadForm.tsx

import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect, useCallback } from "react";
import { GameSearchDropdown } from "./GameSearchDropdown";
import { useDebouncedSearch } from "./hooks/useDebouncedSearch";
import type { GameSearchResult } from "../shared/types";
import type { ApiSource } from "../shared/types";

const getAppName = callable<[number], string>("get_app_name");
const getApiSources = callable<[], ApiSource[]>("get_api_sources");
const getSettings = callable<[], { fastDownload: boolean; morrenusApiKey: string }>("get_settings");

interface DownloadFormProps {
  onStart: (appid: number, source?: string) => void;
}

export function DownloadForm({ onStart }: DownloadFormProps) {
  const [appidInput, setAppidInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [fastDownload, setFastDownload] = useState(false);
  const [inputMode, setInputMode] = useState<"appid" | "search">("appid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { results: searchResults, searching } = useDebouncedSearch(searchQuery, inputMode);

  // Open dropdown when results arrive
  useEffect(() => {
    if (inputMode === "search" && searchQuery.trim()) {
      setSearchOpen(searchResults.length > 0);
    }
  }, [searchResults, inputMode, searchQuery]);

  // Load sources and settings on mount
  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      setFastDownload(false);
    });
  }, []);

  const resolveName = useCallback(async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) {
      setResolvedName("");
      return;
    }
    const name = await getAppName(id);
    setResolvedName(name);
  }, [appidInput]);

  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleModeChange = (mode: "appid" | "search") => {
    if (mode === "appid") {
      setSearchOpen(false);
      setSearchQuery("");
    } else {
      setAppidInput("");
      setResolvedName("");
    }
    setInputMode(mode);
  };

  const handleStart = () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    const source = fastDownload ? "" : selectedSource;
    onStart(id, source);
  };

  return (
    <>
      {/* Mode toggle */}
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

      {/* App ID input */}
      {inputMode === "appid" && (
        <>
          <PanelSectionRow>
            <TextField
              label="App ID"
              value={appidInput}
              onChange={(e) => setAppidInput(e.target.value)}
              onBlur={resolveName}
            />
          </PanelSectionRow>
          {resolvedName && (
            <PanelSectionRow>
              <div className={staticClasses.Label}>{resolvedName}</div>
            </PanelSectionRow>
          )}
          {!fastDownload && sources.length > 0 && (
            <PanelSectionRow>
              <DropdownItem
                label="API Source"
                description="Choose a download source or leave as Auto"
                rgOptions={[
                  { data: "", label: "Auto (try all)" },
                  ...sources.map((s) => ({ data: s.name, label: s.name })),
                ]}
                selectedOption={selectedSource}
                onChange={(opt) => setSelectedSource(opt.data as string)}
              />
            </PanelSectionRow>
          )}
        </>
      )}

      {/* Search input */}
      {inputMode === "search" && (
        <>
          <PanelSectionRow>
            <TextField
              label="Game Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </PanelSectionRow>
          {searchOpen && (
            <PanelSectionRow>
              <GameSearchDropdown
                results={searchResults}
                onSelect={handleSearchSelect}
              />
            </PanelSectionRow>
          )}
          {!searchOpen && searchQuery.trim() && searchResults.length === 0 && !searching && (
            <PanelSectionRow>
              <div
                className={staticClasses.Label}
                style={{ color: "var(--gpSystemLighterGrey)", fontSize: "13px" }}
              >
                No results found
              </div>
            </PanelSectionRow>
          )}
          {/* Show resolved name after selection */}
          {resolvedName && !searchOpen && (
            <PanelSectionRow>
              <div className={staticClasses.Label}>{resolvedName}</div>
            </PanelSectionRow>
          )}
          {!fastDownload && sources.length > 0 && (
            <PanelSectionRow>
              <DropdownItem
                label="API Source"
                description="Choose a download source or leave as Auto"
                rgOptions={[
                  { data: "", label: "Auto (try all)" },
                  ...sources.map((s) => ({ data: s.name, label: s.name })),
                ]}
                selectedOption={selectedSource}
                onChange={(opt) => setSelectedSource(opt.data as string)}
              />
            </PanelSectionRow>
          )}
        </>
      )}

      {/* Start Download button */}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleStart}
          disabled={!appidInput}
        >
          Start Download
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/download/DownloadForm.tsx
git commit -m "feat: add DownloadForm component (input logic extracted from DownloadPanel)"
```

---

### Task 11: Rewrite `DownloadPanel` as orchestrator (`src/download/DownloadPanel.tsx`)

**Files:**
- Move + Modify: `src/components/DownloadPanel.tsx` → `src/download/DownloadPanel.tsx`

- [ ] **Step 1: Write the orchestrator version of DownloadPanel**

The orchestrator is now minimal — it composes `useDownloadLifecycle`, `DownloadForm`, `DownloadProgress`, and `PostDownloadRestart`.

```tsx
// src/download/DownloadPanel.tsx

import { PanelSection } from "@decky/ui";
import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { PostDownloadRestart } from "./PostDownloadRestart";
import { useDownloadLifecycle } from "./hooks/useDownloadLifecycle";

export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
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
  );
}
```

- [ ] **Step 2: Remove the old DownloadPanel file**

Run: `Remove-Item -LiteralPath "src/components/DownloadPanel.tsx"`

- [ ] **Step 3: Update `src/index.tsx` import path**

Edit `src/index.tsx` line 17 — change the import:
```diff
- import { DownloadPanel } from "./components/DownloadPanel";
+ import { DownloadPanel } from "./download/DownloadPanel";
```

- [ ] **Step 4: Commit**

```bash
git add src/download/DownloadPanel.tsx src/index.tsx
git rm src/components/DownloadPanel.tsx
git commit -m "refactor: rewrite DownloadPanel as thin orchestrator"
```

---

### Task 12: Clean up `InstalledApps` (`src/installed/InstalledApps.tsx`)

**Files:**
- Move + Modify: `src/components/InstalledApps.tsx` → `src/installed/InstalledApps.tsx`
- Modify: `src/index.tsx`

- [ ] **Step 1: Create `src/installed/` directory and write the cleaned-up component**

```tsx
// src/installed/InstalledApps.tsx

import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
} from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState, useEffect } from "react";
import { FaTrash, FaRedo } from "react-icons/fa";
import type { InstalledApp } from "../shared/types";

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

  const handleDelete = async (appid: number) => {
    const ok = await deleteApp(appid);
    if (ok) {
      toaster.toast({ title: "STPlugin", body: `Removed Lua for App ${appid}` });
      await loadApps();
    } else {
      toaster.toast({ title: "Error", body: "Failed to remove Lua file" });
    }
  };

  const handleRedownload = async (appid: number) => {
    const taskId = await startDownload(appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading App ${appid}...` });
  };

  if (apps.length === 0) {
    return (
      <PanelSection title="Installed Scripts">
        <PanelSectionRow>
          <div className={staticClasses.Label}>No Lua scripts installed yet.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Installed Scripts">
      {apps.map((app) => (
        <PanelSectionRow key={app.appid}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{app.name || `App ${app.appid}`}</span>
            <ButtonItem onClick={() => handleRedownload(app.appid)}>
              <FaRedo />
            </ButtonItem>
            <ButtonItem onClick={() => handleDelete(app.appid)}>
              <FaTrash />
            </ButtonItem>
          </div>
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}
```

- [ ] **Step 2: Remove old file and update index.tsx import**

Run: `Remove-Item -LiteralPath "src/components/InstalledApps.tsx"`

Edit `src/index.tsx` line 18:
```diff
- import { InstalledApps } from "./components/InstalledApps";
+ import { InstalledApps } from "./installed/InstalledApps";
```

- [ ] **Step 3: Commit**

```bash
git add src/installed/InstalledApps.tsx src/index.tsx
git rm src/components/InstalledApps.tsx
git commit -m "refactor: move InstalledApps to installed/, use shared InstalledApp type"
```

---

### Task 13: Clean up `SettingsPanel` (`src/settings/SettingsPanel.tsx`)

**Files:**
- Move + Modify: `src/components/SettingsPanel.tsx` → `src/settings/SettingsPanel.tsx`
- Modify: `src/index.tsx`

- [ ] **Step 1: Create `src/settings/` directory and write the cleaned-up component**

```tsx
// src/settings/SettingsPanel.tsx

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

  const handleApiKeyChange = async (value: string) => {
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
        <TextField
          label="Morrenus API Key (optional)"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleRefresh}>
          <FaSync /> Refresh API Sources
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

- [ ] **Step 2: Remove old file and update index.tsx import**

Run: `Remove-Item -LiteralPath "src/components/SettingsPanel.tsx"`

Edit `src/index.tsx` line 19:
```diff
- import { SettingsPanel } from "./components/SettingsPanel";
+ import { SettingsPanel } from "./settings/SettingsPanel";
```

- [ ] **Step 3: Commit**

```bash
git add src/settings/SettingsPanel.tsx src/index.tsx
git rm src/components/SettingsPanel.tsx
git commit -m "refactor: move SettingsPanel to settings/, use shared types and constants"
```

---

### Task 14: Rewrite `src/index.tsx` — use `RestartButton` and deduplicate

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Rewrite index.tsx with shared RestartButton and clean imports**

The MainPanel replaces its inline restart logic (lines 23-50, 79-104) with the shared `RestartButton`. Route paths use `ROUTES` constants.

```tsx
// src/index.tsx

import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api";
import React from "react";
import { FaDownload } from "react-icons/fa";
import { RestartButton } from "./shared/components/RestartButton";
import { ROUTES, PLUGIN_NAME } from "./shared/constants";
import { DownloadPanel } from "./download/DownloadPanel";
import { InstalledApps } from "./installed/InstalledApps";
import { SettingsPanel } from "./settings/SettingsPanel";

function MainPanel() {
  return (
    <PanelSection title={PLUGIN_NAME}>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.download)}
        >
          Download Lua Script
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.installed)}
        >
          Installed Scripts
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate(ROUTES.settings)}
        >
          Settings
        </ButtonItem>
      </PanelSectionRow>

      <RestartButton />
    </PanelSection>
  );
}

export default definePlugin(() => {
  console.log(`${PLUGIN_NAME} initializing`);

  routerHook.addRoute(ROUTES.main, MainPanel, { exact: true });
  routerHook.addRoute(ROUTES.download, () => <DownloadPanel />, { exact: true });
  routerHook.addRoute(ROUTES.installed, () => <InstalledApps />, { exact: true });
  routerHook.addRoute(ROUTES.settings, () => <SettingsPanel />, { exact: true });

  return {
    name: PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
    content: <MainPanel />,
    icon: <FaDownload />,
    onDismount() {
      console.log(`${PLUGIN_NAME} unloading`);
      routerHook.removeRoute(ROUTES.main);
      routerHook.removeRoute(ROUTES.download);
      routerHook.removeRoute(ROUTES.installed);
      routerHook.removeRoute(ROUTES.settings);
    },
  };
});
```

Key changes from original:
- Removed `callable`, `toaster`, `useState` imports (no longer needed in index.tsx)
- Removed inline `restartSteam` callable definition (moved to `useRestartSteam` hook)
- Removed all inline restart state/handlers (lines 23-50 of original) 
- Replaced inline restart JSX (lines 79-104 of original) with `<RestartButton />`
- All route strings replaced with `ROUTES.*` constants
- `"STPlugin"` replaced with `PLUGIN_NAME` constant

- [ ] **Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "refactor: simplify index.tsx with shared RestartButton, constants, and clean imports"
```

---

### Task 15: Remove empty `src/components/` directory

**Files:**
- Delete: `src/components/` directory

- [ ] **Step 1: Remove the now-empty directory**

Run: `Remove-Item -LiteralPath "src/components" -Recurse -ErrorAction SilentlyContinue`

- [ ] **Step 2: Commit**

```bash
git rm -r src/components/
git commit -m "chore: remove empty src/components/ directory"
```

---

### Task 16: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: Zero errors. All type imports resolve correctly.

- [ ] **Step 2: Run production build**

```bash
pnpm build
```

Expected: Successful build, `dist/index.js` produced.

- [ ] **Step 3: Verify final file structure**

```bash
Get-ChildItem -Recurse src -Name
```

Expected output should include:

```
index.tsx
shared/
shared/types.ts
shared/constants.ts
shared/components/RestartButton.tsx
shared/hooks/useRestartSteam.ts
download/
download/DownloadPanel.tsx
download/DownloadForm.tsx
download/DownloadProgress.tsx
download/PostDownloadRestart.tsx
download/GameSearchDropdown.tsx
download/hooks/useDownloadLifecycle.ts
download/hooks/useDebouncedSearch.ts
installed/
installed/InstalledApps.tsx
settings/
settings/SettingsPanel.tsx
```

No `src/components/` directory should remain.

- [ ] **Step 4: Run existing Python backend tests to confirm no regressions**

```bash
pytest tests/ -v
```

Expected: 37/37 passing.

- [ ] **Step 5: Commit the build artifact (if it changed)**

```bash
git status
```

If `dist/` is tracked and shows changes, commit:
```bash
git add dist/
git commit -m "build: update dist after frontend refactor"
```

---

## Complete Commit Sequence

1. `feat: add shared type definitions`
2. `feat: add shared constants (routes, settings keys, plugin name)`
3. `feat: add useRestartSteam hook (shared restart state machine)`
4. `feat: add shared RestartButton component (deduplicates restart flow)`
5. `refactor: move GameSearchDropdown to download/, remove dead onClose prop, use shared types`
6. `feat: add useDebouncedSearch hook (extracted from DownloadPanel)`
7. `feat: add useDownloadLifecycle hook (extracted from DownloadPanel)`
8. `feat: add DownloadProgress presentational component`
9. `feat: add PostDownloadRestart component (uses shared RestartButton)`
10. `feat: add DownloadForm component (input logic extracted from DownloadPanel)`
11. `refactor: rewrite DownloadPanel as thin orchestrator`
12. `refactor: move InstalledApps to installed/, use shared InstalledApp type`
13. `refactor: move SettingsPanel to settings/, use shared types and constants`
14. `refactor: simplify index.tsx with shared RestartButton, constants, and clean imports`
15. `chore: remove empty src/components/ directory`
16. `build: update dist after frontend refactor` (if dist changed)
