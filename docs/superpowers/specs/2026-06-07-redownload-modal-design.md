# Re-download Modal Design

**Date:** 2026-06-07
**Status:** Draft
**Author:** Design & Planning Agent

## Problem

The current "Re-download" button on installed app cards (`InstalledAppCard.tsx`) provides poor UX:
- Shows a toast on success (easily missed)
- Shows a toast + red border on error (not actionable)
- No progress visible during download
- No restart prompt after successful re-download
- No retry mechanism on error

## Solution

Replace the inline re-download flow with a dedicated **RedownloadModal** component that shows the full download lifecycle — progress, completion, and error handling — in a single modal.

## Architecture

### Files

| File | Action |
|------|--------|
| `src/installed/components/RedownloadModal.tsx` | **New** — custom modal with progress/success/error views |
| `src/installed/components/InstalledAppCard.tsx` | **Modified** — replace `handleRedownload` to open modal, remove inline error state |

### No changes needed

- Backend (`main.py`, `downloads.py`) — all IPC methods exist
- `useDownloadLifecycle` hook — reused as-is
- `useRestartSteam` hook — reused as-is
- Other frontend files

### Data Flow

```
User clicks Re-download
  → InstalledAppCard opens RedownloadModal via showModal()
  → RedownloadModal mounts
  → useEffect calls download.start(app.appid)
  → useDownloadLifecycle subscribes to download_progress events
  → Events update state (active → done | error | cancelled)
  → Modal re-renders based on state.phase and isActive
  → User acts (Cancel / Restart / Retry / Close)
  → Modal closes
```

## RedownloadModal Component

### Props

```typescript
interface RedownloadModalProps {
  app: InstalledApp;
  onClose: () => void;
}
```

### Internal State (via useDownloadLifecycle)

```typescript
const download = useDownloadLifecycle(onComplete); // onComplete is unused for modal
```

### View States

| Phase | `isActive` | `state.phase` | UI |
|-------|-----------|---------------|----|
| Active | `true` | `fetching_apis`, `downloading`, `extracting`, `installing` | `ProgressBarWithInfo` + Cancel footer button |
| Done | `false` | `done` | Checkmark icon + "Download complete" + Restart / Close footer buttons |
| Error | `false` | `error` | Error banner (red) with error message + Retry / Close footer buttons |
| Cancelled | `false` | `cancelled` | Modal closes automatically |

### Footer Buttons Per State

| State | Buttons |
|-------|---------|
| Active | Cancel |
| Done | Restart Steam | Close |
| Error | Retry | Close |

### Key Behaviors

- **Cancel**: Calls `download.cancel()`, modal closes (cancelled state caught in effect, closes modal)
- **Restart Steam**: Uses `useRestartSteam().confirmRestart` directly (same pattern as `UpdateInstalledModal`). On success, modal closes. On failure, toast shown, modal stays.
- **Retry**: Calls `download.start(app.appid)` again. Hook generates new task_id, resets state back to "active".
- **Close**: Calls `onClose()`, modal dismissed.
- **Modal close button (X)**: Calls `onClose()`. Download continues in background if active (same behavior as DownloadPanel).
- **Synchronous start failure**: If `download.start()` throws a synchronous error, the modal catches it and shows error view.

## InstalledAppCard Changes

### handleRedownload (before)

```typescript
const handleRedownload = async () => {
  setDownloadError(false);
  try {
    await startDownload(app.appid);
    toaster.toast({ ... });
  } catch {
    setDownloadError(true);
    toaster.toast({ title: "Error", ... });
  }
};
```

### handleRedownload (after)

```typescript
const handleRedownload = () => {
  showModal(<RedownloadModal app={app} onClose={() => {}} />);
};
```

### Removed from InstalledAppCard

- `downloadError` state variable
- Red border on card div (`downloadError ? "1px solid var(--gpSystemRed)" : ...`)
- Inline error text with `<FaExclamationTriangle />`
- `setDownloadError` calls
- `FaExclamationTriangle` import (if no longer used elsewhere)
- `toaster` import (no longer used in this component)

### Kept unchanged

- Delete button flow (still uses `ConfirmModal`)
- Card layout, styles, image handling, hover/focus states

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Download fails (API/network) | Modal shows error banner with message + Retry/Close |
| User clicks Retry | `download.start(app.appid)` called again, modal resets to active |
| User clicks Cancel | `download.cancel()` called, modal auto-closes |
| User closes modal mid-download | Download continues in background, toast shown on completion |
| Restart Steam fails | Toast shown, modal stays open |
| `startDownload` throws synchronously | Modal catches, shows error view |

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Multiple rapid re-downloads | Each opens independent modal with its own `useDownloadLifecycle` instance |
| App deleted while modal open | No conflict — download continues, re-creates file if it finishes |
| Restart after successful re-download | Uses `useRestartSteam().confirmRestart` — initiates Steam restart, modal closes |

## Testing

Manual testing of all modal flows:

1. **Active → Done → Restart**: Click re-download, observe progress bar advance through phases, verify success state, click Restart Steam
2. **Active → Done → Close**: Same as above but click Close
3. **Active → Error → Retry**: Simulate download failure (e.g., disconnect network), verify error state, click Retry
4. **Active → Cancel**: Click Cancel, verify modal closes and download is cancelled
5. **Synchronous failure**: Verify modal shows error if `startDownload` IPC fails before event subscription
6. **Modal close mid-download**: Close modal via X, verify toast appears on completion

No existing tests affected (`tests/test_restart_steam.py` still passes).
