# Re-download Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline re-download toast/error in `InstalledAppCard` with a dedicated `RedownloadModal` showing progress, success/restart, and error/retry states.

**Architecture:** New `src/installed/components/RedownloadModal.tsx` uses `useDownloadLifecycle` for progress tracking and `useRestartSteam` for restart. `InstalledAppCard.handleRedownload` is simplified to just `showModal(<RedownloadModal ...>)`. All download error state removed from the card.

**Tech Stack:** React/TypeScript, `@decky/ui` (`ModalRoot`, `DialogBody/Header/Footer`, `DialogButton`, `ProgressBarWithInfo`), `@decky/api` (events via `useDownloadLifecycle`), `react-icons/fa`.

---

### Task 1: Create RedownloadModal component

**Files:**
- Create: `src/installed/components/RedownloadModal.tsx`
- No tests (frontend-only, no frontend test framework)

- [ ] **Step 1: Create RedownloadModal.tsx**

```typescript
import React, { useEffect, useCallback, useState } from "react";
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
import { useDownloadLifecycle } from "../../download/hooks/useDownloadLifecycle";
import { useRestartSteam } from "../../shared/hooks/useRestartSteam";
import type { InstalledApp } from "../../shared/types";
import { COLOR } from "../../shared/styles";

interface RedownloadModalProps {
  app: InstalledApp;
  onClose: () => void;
}

export function RedownloadModal({ app, onClose }: RedownloadModalProps) {
  const { confirmRestart } = useRestartSteam();
  const download = useDownloadLifecycle(() => {});
  const [startError, setStartError] = useState<string | null>(null);

  // Auto-start download on mount
  useEffect(() => {
    download.start(app.appid).catch((err: any) => {
      setStartError(String(err));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.appid]);

  // Auto-close modal when download is cancelled
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
    download.start(app.appid).catch((err: any) => {
      setStartError(String(err));
    });
  }, [app.appid, download]);

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
        Re-download {app.name || `App ${app.appid}`}
      </DialogHeader>
      <DialogBody>
        {/* Progress view */}
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

        {/* Success view */}
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
              {app.name || `App ${app.appid}`}
              .lua installed.
            </span>
          </div>
        )}

        {/* Error view */}
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
        {/* Active: Cancel button */}
        {isActive && (
          <DialogButton onClick={download.cancel}>Cancel</DialogButton>
        )}

        {/* Done: Restart + Close buttons */}
        {isDone && (
          <>
            <DialogButton onClick={handleRestart}>
              Restart Steam
            </DialogButton>
            <DialogButton onClick={onClose}>Close</DialogButton>
          </>
        )}

        {/* Error: Retry + Close buttons */}
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

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build`
Expected: Build succeeds, no errors.

---

### Task 2: Update InstalledAppCard to use RedownloadModal

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx`

- [ ] **Step 1: Add RedownloadModal import and remove unused imports**

In `InstalledAppCard.tsx`, add `RedownloadModal` to the import and remove `FaExclamationTriangle` from `react-icons/fa`:

Current imports (lines 1-5):
```typescript
import { staticClasses, ConfirmModal, showModal, Focusable } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState } from "react";
import { FaTrash, FaRedo, FaGamepad, FaExclamationTriangle } from "react-icons/fa";
import type { InstalledApp } from "../../shared/types";
import { CARD } from "../../shared/styles";
```

Change to:
```typescript
import { staticClasses, ConfirmModal, showModal, Focusable } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState } from "react";
import { FaTrash, FaRedo, FaGamepad } from "react-icons/fa";
import type { InstalledApp } from "../../shared/types";
import { CARD } from "../../shared/styles";
import { RedownloadModal } from "./RedownloadModal";
```

- [ ] **Step 2: Remove `startDownload` callable**

Remove this line:
```typescript
const startDownload = callable<[number, string?, string?], string>("start_download");
```

Only `deleteApp` callable should remain:
```typescript
const deleteApp = callable<[number, boolean]>("delete_app");
```

- [ ] **Step 3: Remove `downloadError` state**

Remove this line:
```typescript
const [downloadError, setDownloadError] = useState(false);
```

Only `imgError`, `hoveredBtn`, and `focusedBtn` state declarations remain.

- [ ] **Step 4: Replace `handleRedownload`**

Current code (lines 46-55):
```typescript
const handleRedownload = async () => {
  setDownloadError(false);
  try {
    await startDownload(app.appid);
    toaster.toast({ title: "STPlugin", body: `Re-downloading ${app.name || `App ${app.appid}`}...` });
  } catch {
    setDownloadError(true);
    toaster.toast({ title: "Error", body: "Failed to re-download script" });
  }
};
```

Replace with:
```typescript
const handleRedownload = () => {
  showModal(<RedownloadModal app={app} onClose={() => {}} />);
};
```

- [ ] **Step 5: Remove download error border condition**

In the card `div` style, find:
```typescript
border: downloadError ? "1px solid var(--gpSystemRed)" : CARD.border,
```

Replace with:
```typescript
border: CARD.border,
```

- [ ] **Step 6: Remove download error inline message**

Remove the entire block (lines 136-150 in the original):
```tsx
{downloadError && (
  <div
    style={{
      color: "var(--gpSystemRed)",
      fontSize: "12px",
      marginTop: "4px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    }}
  >
    <FaExclamationTriangle style={{ fontSize: "10px" }} />
    Download failed — click to retry
  </div>
)}
```

- [ ] **Step 7: Verify compilation**

Run: `pnpm build`
Expected: Build succeeds with no errors.

---

### Task 3: Verify the build

**Files:** None — verification only.

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: Build succeeds, `dist/index.js` is produced.

- [ ] **Step 2: Check for any TypeScript errors**

Run: `pnpm build 2>&1`
Expected: No TS errors, no warnings about unused imports.

