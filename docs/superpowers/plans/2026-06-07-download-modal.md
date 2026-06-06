# Download Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline download progress in DownloadPanel with a ModalRoot-based modal that shows progress, errors, success, and restart prompt (same pattern as RedownloadModal).

**Architecture:** Create a new `DownloadModal` component in `src/download/components/`, modify the `useDownloadLifecycle` hook to support suppressing toasts, update `DownloadForm` to pass the resolved game name through `onStart`, and simplify `DownloadPanel.tsx` to use `showModal()` instead of managing inline progress/restart state.

**Tech Stack:** TypeScript, React, Decky UI (`ModalRoot`, `DialogBody`, `DialogHeader`, `DialogFooter`, `DialogButton`, `ProgressBarWithInfo`, `showModal`)

---

### Task 1: Add `suppressToasts` to `useDownloadLifecycle`

**Files:**
- Modify: `src/download/hooks/useDownloadLifecycle.ts:8`

- [ ] **Step 1: Add `suppressToasts` parameter to the hook signature**

Change line 8 from:
```tsx
export function useDownloadLifecycle(onComplete: () => void) {
```
to:
```tsx
export function useDownloadLifecycle(onComplete: () => void, suppressToasts?: boolean) {
```

- [ ] **Step 2: Wrap the done toast in a suppressToasts check**

Replace the current condition block (lines 19-26):
```tsx
      if (progress.phase === "done") {
        setIsActive(false);
        toaster.toast({
          title: "STPlugin",
          body: `Installed Lua for App ${progress.appid}`,
        });
        onComplete();
```
with:
```tsx
      if (progress.phase === "done") {
        setIsActive(false);
        if (!suppressToasts) {
          toaster.toast({
            title: "STPlugin",
            body: `Installed Lua for App ${progress.appid}`,
          });
        }
        onComplete();
```

- [ ] **Step 3: Wrap the error toast in a suppressToasts check**

Replace the current condition block (lines 26-31):
```tsx
      } else if (progress.phase === "error") {
        setIsActive(false);
        toaster.toast({
          title: "Download Failed",
          body: progress.message || "Unknown error",
        });
```
with:
```tsx
      } else if (progress.phase === "error") {
        setIsActive(false);
        if (!suppressToasts) {
          toaster.toast({
            title: "Download Failed",
            body: progress.message || "Unknown error",
          });
        }
```

---

### Task 2: Add `name` to `DownloadForm.onStart` signature

**Files:**
- Modify: `src/DownloadForm.tsx:22` (interface), `src/DownloadForm.tsx:74-75` (handleStart call)

- [ ] **Step 1: Add `name` parameter to `onStart` type**

Change line 22 from:
```tsx
  onStart: (appid: number, source?: string, imgUrl?: string) => void;
```
to:
```tsx
  onStart: (appid: number, source?: string, imgUrl?: string, name?: string) => void;
```

- [ ] **Step 2: Pass `resolvedName` in the `handleStart` call**

Change lines 74-75 from:
```tsx
    const source = fastDownload ? "" : selectedSource;
    onStart(id, source, selectedImg);
```
to:
```tsx
    const source = fastDownload ? "" : selectedSource;
    onStart(id, source, selectedImg, resolvedName);
```

---

### Task 3: Create `DownloadModal` component

**Files:**
- Create: `src/download/components/DownloadModal.tsx`

- [ ] **Step 1: Create the DownloadModal component file**

Create `src/download/components/DownloadModal.tsx` with the following content:

```tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ModalRoot,
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogButton,
  ProgressBarWithInfo,
  staticClasses,
} from "@decky/ui";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useDownloadLifecycle } from "../hooks/useDownloadLifecycle";
import { useRestartSteam } from "../../shared/hooks/useRestartSteam";
import { COLOR } from "../../shared/styles";

interface DownloadModalProps {
  appid: number;
  name?: string;
  imgUrl?: string;
  source?: string;
  onClose: () => void;
}

export function DownloadModal({ appid, name, source, onClose }: DownloadModalProps) {
  const { confirmRestart } = useRestartSteam();
  const download = useDownloadLifecycle(() => {}, true);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    download.start(appid, source).catch((err: any) => {
      setStartError(String(err));
    });
  }, [appid, source]);

  useEffect(() => {
    if (download.state?.phase === "cancelled") {
      onClose();
    }
  }, [download.state?.phase, onClose]);

  const handleRestart = useCallback(() => {
    confirmRestart();
    onClose();
  }, [confirmRestart, onClose]);

  const handleRetry = useCallback(() => {
    setStartError(null);
    download.start(appid, source).catch((err: any) => {
      setStartError(String(err));
    });
  }, [appid, source, download]);

  const isActive = download.isActive && download.state?.phase !== "cancelled";
  const isDone = !download.isActive && download.state?.phase === "done";
  const isError =
    startError !== null ||
    (!download.isActive && download.state?.phase === "error");
  const errorMessage =
    startError || download.state?.error || "Unknown error";

  return (
    <ModalRoot closeModal={onClose}>
      <DialogHeader>
        Download {name || `App ${appid}`}
      </DialogHeader>
      <DialogBody>
        {isActive && download.state && (
          <ProgressBarWithInfo
            nProgress={
              download.state.percent > 0 ? download.state.percent : undefined
            }
            indeterminate={download.state.percent <= 0}
            sOperationText={download.state.message}
            nTransitionSec={0.5}
            bottomSeparator="none"
            childrenContainerWidth="max"
          />
        )}

        {isDone && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 0",
            }}
          >
            <FaCheckCircle
              style={{ color: COLOR.success, fontSize: "16px", flexShrink: 0 }}
            />
            <span className={staticClasses.Label}>
              Download complete!{" "}
              {name || `App ${appid}`}
              .lua installed.
            </span>
          </div>
        )}

        {isError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "rgba(255, 0, 0, 0.1)",
              borderRadius: "4px",
              border: "1px solid var(--gpSystemRed)",
            }}
          >
            <FaExclamationTriangle
              style={{
                color: "var(--gpSystemRed)",
                fontSize: "16px",
                flexShrink: 0,
              }}
            />
            <span
              className={staticClasses.Label}
              style={{ color: "var(--gpSystemRed)" }}
            >
              {errorMessage}
            </span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {isActive && (
          <DialogButton onClick={download.cancel}>Cancel</DialogButton>
        )}

        {isDone && (
          <>
            <DialogButton onClick={handleRestart}>
              Restart Steam
            </DialogButton>
            <DialogButton onClick={onClose}>Close</DialogButton>
          </>
        )}

        {isError && (
          <>
            <DialogButton onClick={handleRetry}>Retry</DialogButton>
            <DialogButton onClick={onClose}>Close</DialogButton>
          </>
        )}
      </DialogFooter>
    </ModalRoot>
  );
}
```

---

### Task 4: Simplify `DownloadPanel` — use `showModal`

**Files:**
- Modify: `src/DownloadPanel.tsx` (replace entire body)

- [ ] **Step 1: Replace DownloadPanel imports**

Remove:
```tsx
import React, { useState } from "react";
import { DownloadProgress } from "./download/components/DownloadProgress";
import { PostDownloadRestart } from "./download/components/PostDownloadRestart";
import { useDownloadLifecycle } from "./download/hooks/useDownloadLifecycle";
```

Add:
```tsx
import React from "react";
import { showModal } from "@decky/ui";
import { DownloadModal } from "./download/components/DownloadModal";
```

The remaining imports (`DownloadForm`, `PageLayout`) stay.

- [ ] **Step 2: Replace DownloadPanel body**

Replace the entire component (lines 8-24) from:
```tsx
export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <PageLayout title="Download Lua Script" showBack>
      {!download.isActive && !showRestartPrompt && (
        <DownloadForm onStart={download.start} />
      )}
      {download.isActive && (
        <DownloadProgress state={download.state!} onCancel={download.cancel} />
      )}
      {showRestartPrompt && (
        <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
      )}
    </PageLayout>
  );
}
```
to:
```tsx
export function DownloadPanel() {
  return (
    <PageLayout title="Download Lua Script" showBack>
      <DownloadForm onStart={(appid, source, imgUrl, name) =>
        showModal(
          <DownloadModal
            appid={appid}
            name={name}
            imgUrl={imgUrl}
            source={source}
            onClose={() => {}}
          />
        )
      } />
    </PageLayout>
  );
}
```

---

### Task 5: Remove unused files

**Files:**
- Remove: `src/download/components/DownloadProgress.tsx`
- Remove: `src/download/components/PostDownloadRestart.tsx`

- [ ] **Step 1: Delete `DownloadProgress.tsx`**

Run: `Remove-Item -LiteralPath "src/download/components/DownloadProgress.tsx"`

- [ ] **Step 2: Delete `PostDownloadRestart.tsx`**

Run: `Remove-Item -LiteralPath "src/download/components/PostDownloadRestart.tsx"`

---

### Task 6: Verify the build compiles

**Files:** None

- [ ] **Step 1: Run the build**

Run: `pnpm build`

Expected: Build succeeds with no errors. Output: `dist/index.js` is produced.

- [ ] **Step 2: Run tests**

Run: `pnpm test`

Expected: All tests pass (37/37 currently).

---

### Task 7: Update OpenSpec living specs

**Files:**
- Modify: `openspec/specs/frontend.md` (update DownloadPanel and component list)
- Modify: `openspec/specs/api-contracts.md` (if useDownloadLifecycle signature changed)

- [ ] **Step 1: Update `openspec/specs/frontend.md`**

Add `DownloadModal` to the QAM panels section. Remove references to `DownloadProgress` and `PostDownloadRestart`. Update `DownloadPanel` description to reflect modal usage.

- [ ] **Step 2: Update `openspec/specs/api-contracts.md`**

If the `useDownloadLifecycle` signature is documented there, add the `suppressToasts` optional parameter.
