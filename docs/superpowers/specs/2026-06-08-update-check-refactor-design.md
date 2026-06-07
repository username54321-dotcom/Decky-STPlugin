# Update Check Refactor — Design Spec

**Date:** 2026-06-08  
**Scope:** Refactor update checking from interval-based to one-time-on-mount, replace raw HTML banner with Decky native UI components, remove update-availability toast.

---

## Problem

1. The background `_update_checker` loop in `main.py` polls GitHub every 30s (dev) / 30min (prod) indefinitely. This is wasteful — a single check on plugin load is sufficient.
2. The update notification banner in `MainPanel` uses raw `<div>` with inline styles. It looks out of place in the Steam Deck QAM.
3. A toast fires every time an update is detected (including on each loop iteration), which is noisy.

## Changes

### 1. Backend: One-time check on mount

**File:** `main.py` (lines 122-139)

Replace the `_update_checker` async loop with a single inline check in `_main()`:

```python
# After manifest fetch:
info = await _check_for_update()
if info and info.available:
    await decky.emit("update_available", {
        "current_version": info.current_version,
        "latest_version": info.latest_version,
        "release_url": info.release_url,
        "asset_url": info.asset_url,
        "checked_at": info.checked_at,
    })
```

Remove `self._update_task` assignment and the `_update_checker` inner function.

**File:** `main.py` (lines 141-146) — `_unload()`

Remove the `_update_task` cancellation logic (lines 143-146). The task no longer exists.

**File:** `main.py` (line 38)

Remove `UPDATE_CHECK_INTERVAL` from the import.

**File:** `backend/auto_update.py` (line 18)

Remove the `UPDATE_CHECK_INTERVAL` constant entirely.

### 2. Frontend: Remove update-availability toast

**File:** `src/update/hooks/useUpdateStatus.ts` (lines 47-50)

Remove the `toaster.toast()` call inside `handleUpdateAvailable`. The banner in the QAM is the notification — no toast needed.

Keep the `update_installed` toast (line 59-62) — that one is actionable and useful.

### 3. Frontend: Banner → Decky native components

**File:** `src/index.tsx` (lines 34-101)

Replace the raw `<div>` banner with a Decky-native `PanelSection`:

```tsx
{updateStatus.available && updateStatus.latestVersion && !bannerDismissed && (
  <PanelSection title="Update Available">
    <PanelSectionRow>
      <Field
        label={`v${updateStatus.latestVersion}`}
        description="A new version of STPlugin is available"
      />
    </PanelSectionRow>
    <PanelSectionRow>
      <ButtonItem layout="below" onClick={async () => {
        const installed = await install();
        if (installed && updateStatus.latestVersion) {
          showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
        }
      }} disabled={updateStatus.installing}>
        {updateStatus.installing ? "Installing..." : "Install Update"}
      </ButtonItem>
    </PanelSectionRow>
    {updateStatus.releaseUrl && (
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => window.open(updateStatus.releaseUrl!, "_blank")}>
          View Release
        </ButtonItem>
      </PanelSectionRow>
    )}
    <PanelSectionRow>
      <ButtonItem layout="below" onClick={() => setBannerDismissed(true)}>
        Dismiss
      </ButtonItem>
    </PanelSectionRow>
  </PanelSection>
)}
```

This removes all inline styles, `Focusable` wrappers, and raw `<button>` elements. The result uses the same component pattern as the rest of the QAM panel.

Add `Field` to the `@decky/ui` import. Remove `Focusable` from the import (no longer used after banner refactor).

## Files Modified

| File | Change |
|------|--------|
| `main.py` | Remove background loop, remove `_update_task` lifecycle, single check in `_main()` |
| `backend/auto_update.py` | Remove `UPDATE_CHECK_INTERVAL` constant |
| `src/update/hooks/useUpdateStatus.ts` | Remove toast from `handleUpdateAvailable` |
| `src/index.tsx` | Replace raw banner div with `PanelSection`/`Field`/`ButtonItem`, add `Field` import |

## Files NOT Modified

- `src/SettingsPanel.tsx` — manual "Check for Updates" button and its toasts are fine as-is
- `src/update/components/UpdateInstalledModal.tsx` — no changes needed
- `src/shared/types.ts` — no type changes
- `backend/auto_update.py` (core logic) — `check_for_update()`, `install_update()` unchanged
- Tests — existing tests cover backend logic, not the loop or UI

## Out of Scope

- Caching the update check result across plugin reloads
- "Don't remind me again" persistence
- Update check from Settings panel (already manual, already works)
