# Post-Install Restart Modal

**Date:** 2026-06-07
**Status:** Draft
**Feature:** After a successful plugin update, show a modal dialog informing the user that the update was installed and offering to restart Steam.

---

## 1. Problem

Currently, after clicking "Install" on an available update, the update is downloaded and extracted successfully, but the user only sees a brief toast notification: "Update installed! Restart Steam to apply." There is no inline Restart button — the user must navigate to the bottom of the main panel to find the `RestartButton` component. This creates a poor UX where the update flow feels incomplete.

## 2. Goal

When a plugin update is successfully installed, show a modal dialog that:
- Confirms the update was installed
- Informs the user they need to restart Steam to apply changes
- Provides a prominent "Restart Steam" button
- Provides a "Later" dismiss option

## 3. Design

### 3.1 Overview

The existing `install_update` IPC call already returns `{success: boolean}` synchronously. We use that return value to drive UI feedback immediately, rather than relying solely on the async `update_installed` event.

**Pattern:** Caller-triggered modal. The `install()` function on `useUpdateStatus` returns `Promise<boolean>`. The callers (`MainPanel`, `SettingsPanel`) check the result and call `showModal(<UpdateInstalledModal />)` on success.

### 3.2 Hook Changes (`src/update/hooks/useUpdateStatus.ts`)

The `install()` function is changed to:
1. Return `Promise<boolean>` (true = installed successfully)
2. On success from IPC: immediately set `installing: false` and `available: false`
3. On error/failure: show error toast, set `installing: false`, return false
4. The `handleUpdateInstalled` event handler is kept as a safety reset plus a toast fallback (for cases where the user navigated away during install and the modal doesn't show)

**Pseudocode:**
```typescript
const install = useCallback(async (): Promise<boolean> => {
    if (!status.assetUrl) return false;
    setStatus(prev => ({ ...prev, installing: true }));
    try {
        const result = await installUpdate(status.assetUrl);
        if (result.success) {
            setStatus(prev => ({
                ...prev,
                available: false,
                installing: false,
            }));
            return true;
        } else {
            toaster.toast({ title: "Installation Failed", body: "Try manual install." });
            setStatus(prev => ({ ...prev, installing: false }));
            return false;
        }
    } catch (err) {
        toaster.toast({ title: "Installation Failed", body: String(err) });
        setStatus(prev => ({ ...prev, installing: false }));
        return false;
    }
}, [status.assetUrl]);
```

### 3.3 New Component: `UpdateInstalledModal` (`src/update/components/UpdateInstalledModal.tsx`)

A thin wrapper around `ConfirmModal` (from `@decky/ui`) that:
- Displays "Update Installed" title
- Shows `STPlugin v{version} has been installed.\n\nRestart Steam to apply the changes.`
- Provides "Restart Steam" (calls `confirmRestart` from `useRestartSteam`) and "Later" (dismisses) buttons
- Uses `useRestartSteam` hook for the restart logic (consistent with `RestartButton`)

```tsx
interface Props {
  version: string;
}

export function UpdateInstalledModal({ version }: Props) {
  const { confirmRestart } = useRestartSteam();
  return (
    <ConfirmModal
      strTitle="Update Installed"
      strDescription={`STPlugin v${version} has been installed.\n\nRestart Steam to apply the changes.`}
      strOKButtonText="Restart Steam"
      strCancelButtonText="Later"
      onOK={confirmRestart}
    />
  );
}
```

No new file in `src/shared/components/` — this component lives in `src/update/components/` alongside other update-related code.

### 3.4 Caller Integration

**`src/index.tsx`** (main panel update banner):
```tsx
<ButtonItem
  onClick={async () => {
    const installed = await install();
    if (installed && updateStatus.latestVersion) {
      showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
    }
  }}
  disabled={updateStatus.installing}
>
  {updateStatus.installing ? "Installing..." : "Install"}
</ButtonItem>
```

**`src/SettingsPanel.tsx`** (settings panel install button):
```tsx
<ButtonItem
  layout="below"
  onClick={async () => {
    const installed = await install();
    if (installed && updateStatus.latestVersion) {
      showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
    }
  }}
  disabled={updateStatus.installing}
>
  {updateStatus.installing ? "Installing..." : "Install Now"}
</ButtonItem>
```

**Imports needed:**
- `src/index.tsx`: Add `showModal` from `@decky/ui`, add `UpdateInstalledModal` import
- `src/SettingsPanel.tsx`: Add `showModal` from `@decky/ui` (already imports other things from `@decky/ui`), add `UpdateInstalledModal` import

## 4. Error Handling

| Scenario | Behavior |
|---|---|
| IPC returns `{success: false}` | `install()` returns false, error toast shown (existing) |
| IPC throws | `install()` catches, returns false, error toast shown (existing) |
| User navigates away during install | If they return, the modal won't show (the click handler was abandoned). The event handler safety reset still applies. Acceptable — the toast still fires. |
| `latestVersion` is null | Guard: only show modal if `updateStatus.latestVersion` is truthy. Falls back to existing event toast. |
| Restart Steam fails | `useRestartSteam` already shows error toast |

## 5. Files Changed

| File | Change |
|---|---|
| `src/update/hooks/useUpdateStatus.ts` | `install()` returns `Promise<boolean>`; handle success immediately; keep event handler as safety reset only |
| `src/update/components/UpdateInstalledModal.tsx` | **NEW** — modal component wrapping `ConfirmModal` |
| `src/index.tsx` | Await `install()`, show modal on success |
| `src/SettingsPanel.tsx` | Await `install()`, show modal on success |

## 6. Testing

- **Manual:** Click "Install" → wait for completion → modal appears with "Restart Steam" and "Later"
- **Manual:** Click "Later" → modal dismisses, no restart
- **Manual:** Click "Restart Steam" → Steam restarts
- **Manual:** Simulate install failure → no modal, error toast appears (existing behavior)

No new automated tests needed — the logic change is in the caller integration (UI orchestration), which is covered by existing integration tests.
