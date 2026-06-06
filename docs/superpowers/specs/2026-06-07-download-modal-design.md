# Download Modal — Design Spec

**Date:** 2026-06-07
**Status:** Approved

## Problem

The Download Lua Script panel currently shows download progress **inline** — the `DownloadForm` disappears, replaced by an inline progress bar and later a restart prompt. This is inconsistent with the rest of the app, which uses modals for download flows (e.g., `RedownloadModal`, `DiscoverModal`). Errors also fire as toasts rather than appearing in the UI.

## Goal

Replace the inline progress + restart prompt with a modal that:
- Opens when the user clicks "Start Download"
- Shows progress, cancel, success, error, and restart inside the modal
- Keeps the `DownloadForm` visible underneath when the modal is closed
- Follows the same pattern as `RedownloadModal`

## Approach

**Chosen: Approach 1 — Standalone `DownloadModal` component.**

Create a new `DownloadModal` component in `src/download/components/`, use `showModal()` from `DownloadPanel`, add `suppressToasts` to `useDownloadLifecycle`, and remove the now-unused inline components.

## Files Changed

| Action | File | Reason |
|--------|------|--------|
| **Create** | `src/download/components/DownloadModal.tsx` | New modal component (~130 lines) |
| **Modify** | `src/DownloadPanel.tsx` | Replace inline progress with `showModal()` |
| **Modify** | `src/download/hooks/useDownloadLifecycle.ts` | Add optional `suppressToasts` param |
| **Remove** | `src/download/components/DownloadProgress.tsx` | No longer used |
| **Remove** | `src/download/components/PostDownloadRestart.tsx` | No longer used |

## Component: `DownloadModal`

### Props

```tsx
interface DownloadModalProps {
  appid: number;
  name?: string;       // resolved game name (for display)
  imgUrl?: string;     // capsule image URL (for display in header)
  source?: string;     // selected API source (or empty for auto)
  onClose: () => void;
}
```

### Internal State

Managed by two sources:
- **`useDownloadLifecycle` hook** (with `suppressToasts: true`) — drives the main state machine via `download.state`
- **`startError` (local `useState`)** — catches IPC/startup failures from `download.start()` rejection

### Render States

| State | Trigger | Content |
|-------|---------|---------|
| **Active** | `download.isActive && state.phase !== "cancelled"` | `ProgressBarWithInfo` (indeterminate for `fetching`, percentage for `downloading`) + Cancel button |
| **Done** | `!download.isActive && state.phase === "done"` | `FaCheckCircle` icon + "Download complete! {name}.lua installed." + Restart Steam / Close buttons |
| **Error** | `startError != null || (!download.isActive && state.phase === "error")` | `FaExclamationTriangle` + error message + Retry / Close buttons |

### Behavior

- **Auto-start:** `useEffect` calls `download.start(appid, source, imgUrl)` on mount
- **Auto-close on cancel:** `useEffect` watches for `phase === "cancelled"` → `onClose()`
- **Restart:** Uses `useRestartSteam().confirmRestart()`, then `onClose()`
- **Retry:** Clears `startError`, calls `download.start()` again
- **Suppress toasts:** `useDownloadLifecycle(onComplete, true)` — errors show only in modal

## Modified: `useDownloadLifecycle`

Add second parameter:

```tsx
export function useDownloadLifecycle(
  onComplete: () => void,
  suppressToasts?: boolean
)
```

When `true`, skip `toaster.toast()` for both `done` and `error` phases. The `onComplete` callback still fires.

## Modified: `DownloadPanel`

Before:
```tsx
const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

return (
  <PageLayout title="Download Lua Script" showBack>
    {!download.isActive && !showRestartPrompt && <DownloadForm onStart={download.start} />}
    {download.isActive && <DownloadProgress ... />}
    {showRestartPrompt && <PostDownloadRestart ... />}
  </PageLayout>
);
```

After:
```tsx
import { showModal } from "@decky/ui";

return (
  <PageLayout title="Download Lua Script" showBack>
    <DownloadForm onStart={(appid, source, imgUrl, name) =>
      showModal(
        <DownloadModal appid={appid} name={name} imgUrl={imgUrl} source={source} onClose={() => {}} />
      )
    } />
  </PageLayout>
);
```

The `DownloadForm` needs to expose the resolved game name to `onStart` so the modal can display it. Current `onStart` signature is `(appid, source?, imgUrl?)` — add `name`:

```tsx
interface DownloadFormProps {
  onStart: (appid: number, source?: string, imgUrl?: string, name?: string) => void;
}
```

In `DownloadForm.handleStart`:
```tsx
onStart(id, source, selectedImg, resolvedName);
```

## Data Flow

```
User clicks "Start Download"
  → DownloadForm calls onStart(appid, source, imgUrl, name)
  → DownloadPanel calls showModal(<DownloadModal ... />)
      → Modal renders, runs download.start(appid, source, imgUrl)
        → Backend starts download, emits download_progress events
          → Modal renders progress via ProgressBarWithInfo
      → Phase reaches "done"
        → Modal shows success + Restart Steam / Close
      → Phase reaches "error" or start() rejects
        → Modal shows error + Retry / Close
      → User closes modal
        → Modal unmounts, event listener cleaned up
        → DownloadForm visible underneath in panel
```

## Error Handling

| Source | Mechanism | Modal Display |
|--------|-----------|---------------|
| `download.start()` IPC failure | `try/catch` in `useEffect` → `setStartError` | Red banner + Retry/Close |
| Backend `phase: "error"` | `useDownloadLifecycle` sets `state` | Red banner + error message + Retry/Close |
| User cancels | `download.cancel()` → `phase: "cancelled"` | Auto-closes modal |
| Modal closed mid-download | User taps outside/X button | Modal unmounts, listener removed, download continues silently on backend |

## Testing Notes

- Modal opens immediately when "Start Download" is clicked
- Progress bar updates in real-time
- Cancel button closes the modal
- Success state shows restart prompt
- Error state shows retry option
- After modal closes, DownloadForm is ready for a new search
- `DownloadProgress.tsx` and `PostDownloadRestart.tsx` are fully removed with no dangling imports
