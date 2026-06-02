# Remove AppID Download Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AppID text field input mode from the download form, making game name search the only way to specify a game.

**Architecture:** Frontend-only change. `DownloadForm.tsx` loses the mode toggle, AppID TextField, and `resolveName` logic. `useDebouncedSearch` hook loses the `mode` parameter. Backend unchanged — `start_download(appid, source)` still receives the AppID internally after the user picks from search results.

**Tech Stack:** TypeScript, React, Decky UI components (`TextField`, `DropdownItem`, `PanelSectionRow`, `ButtonItem`, `SteamSpinner`), Decky API (`callable`)

**Spec:** `docs/superpowers/specs/2026-06-03-remove-appid-mode-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/download/hooks/useDebouncedSearch.ts` | Modify | Remove `mode` parameter — search activates whenever query is non-empty |
| `src/download/DownloadForm.tsx` | Modify | Remove mode toggle, AppID input, resolve logic. Search-only form. |

## Pre-Flight Check

- [ ] **Step: Verify current state is clean**

Run: `git status`
Expected: Working tree clean (or only the spec file committed). Note any unrelated changes.

Run: `pnpm build`
Expected: Build succeeds without errors.

---

### Task 1: Simplify `useDebouncedSearch` hook

**Files:**
- Modify: `src/download/hooks/useDebouncedSearch.ts` (entire file)

- [ ] **Step 1: Simplify the hook — remove `mode` parameter and guard**

Replace the entire file content with:

```typescript
import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { GameSearchResult } from "../../shared/types";

const searchGames = callable<[string], GameSearchResult[]>("search_games");

export function useDebouncedSearch(query: string) {
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!query.trim()) {
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
  }, [query]);

  return { results, searching };
}
```

Differences from current:
- Removed `mode: "appid" | "search"` parameter
- Removed `mode !== "search"` guard (line 14 in current)
- Removed `mode` from dependency array
- All other logic unchanged

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: Build succeeds. There will be a type error in `DownloadForm.tsx` (we haven't updated it yet) — that's expected. If there are other errors, investigate.

- [ ] **Step 3: Commit**

```bash
git add src/download/hooks/useDebouncedSearch.ts
git commit -m "refactor: remove mode param from useDebouncedSearch hook"
```

---

### Task 2: Restructure `DownloadForm.tsx` to search-only

**Files:**
- Modify: `src/download/DownloadForm.tsx` (entire file)

- [ ] **Step 1: Rewrite DownloadForm.tsx — remove AppID mode, keep search**

Replace the entire file content with:

```typescript
import {
  PanelSectionRow,
  ButtonItem,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui";
import { callable } from "@decky/api";
import React, { useState, useEffect } from "react";
import { GameSearchDropdown } from "./GameSearchDropdown";
import { useDebouncedSearch } from "./hooks/useDebouncedSearch";
import type { GameSearchResult } from "../shared/types";
import type { ApiSource } from "../shared/types";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { results: searchResults, searching } = useDebouncedSearch(searchQuery);

  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchOpen(searchResults.length > 0);
    }
  }, [searchResults, searchQuery]);

  useEffect(() => {
    getApiSources().then(setSources).catch(() => {
      console.warn("[STPlugin] Failed to load API sources");
    });
    getSettings().then((s) => setFastDownload(s.fastDownload)).catch(() => {
      setFastDownload(false);
    });
  }, []);

  const handleSearchSelect = (result: GameSearchResult) => {
    setAppidInput(String(result.id));
    setResolvedName(result.name);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleStart = () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    const source = fastDownload ? "" : selectedSource;
    onStart(id, source);
  };

  return (
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

Key removals from the original:
- Removed `inputMode` state
- Removed `resolving` state
- Removed `getAppName` callable
- Removed `handleModeChange` callback
- Removed `resolveName` callback
- Removed the `ControlsList` mode toggle (`[App ID]` / `[Search]` buttons)
- Removed the `{inputMode === "appid" && (...)}` block (AppID TextField, resolved name display, resolving spinner)
- Removed the conditional `{inputMode === "search" && (...)}` wrapper — content is now unconditional
- Removed `SteamSpinner` import (no longer used)
- `useDebouncedSearch` called without `inputMode` argument

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Run backend tests to confirm no regression**

Run: `pytest tests/ -v`
Expected: All 37 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/download/DownloadForm.tsx
git commit -m "feat: remove AppID download mode, search-only form"
```

---

### Task 3: Final verification

- [ ] **Step 1: Full build + test**

Run:
```bash
pnpm build
pytest tests/ -v
```
Expected: Build succeeds, all 37 tests pass.

- [ ] **Step 2: Push**

```bash
git push
```
