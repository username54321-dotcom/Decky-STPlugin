# Update Check Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace interval-based update polling with a one-time check on mount, remove the update-availability toast, and replace the raw HTML banner with Decky native UI components.

**Architecture:** Remove the `_update_checker` background loop from `main.py` and replace with a single `check_for_update()` call in `_main()`. In the frontend, remove the toast from the `update_available` event handler and replace the inline-styled banner div in `MainPanel` with `PanelSection`/`Field`/`ButtonItem` components.

**Tech Stack:** Python (asyncio, httpx), TypeScript/React, `@decky/ui`, `@decky/api`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/auto_update.py:18` | Modify | Remove `UPDATE_CHECK_INTERVAL` constant |
| `main.py:38` | Modify | Remove `UPDATE_CHECK_INTERVAL` from import |
| `main.py:122-139` | Modify | Replace background loop with single check |
| `main.py:141-146` | Modify | Remove `_update_task` cancellation from `_unload()` |
| `src/update/hooks/useUpdateStatus.ts:47-50` | Modify | Remove toast from `handleUpdateAvailable` |
| `src/index.tsx:1-11` | Modify | Update imports (`Field` added, `Focusable` removed) |
| `src/index.tsx:34-101` | Modify | Replace raw banner with Decky native components |

---

### Task 1: Remove `UPDATE_CHECK_INTERVAL` from backend

**Files:**
- Modify: `backend/auto_update.py:18`
- Modify: `main.py:38`

- [ ] **Step 1: Remove the constant from `auto_update.py`**

Delete line 18:
```python
UPDATE_CHECK_INTERVAL = 30  # temporary: 30s for dev; change to 1800 before production release
```

- [ ] **Step 2: Remove the import from `main.py`**

Change line 38 from:
```python
from backend.auto_update import check_for_update as _check_for_update, install_update as _install_update, UPDATE_CHECK_INTERVAL
```
to:
```python
from backend.auto_update import check_for_update as _check_for_update, install_update as _install_update
```

- [ ] **Step 3: Verify no other references to `UPDATE_CHECK_INTERVAL`**

Run: `grep -r "UPDATE_CHECK_INTERVAL" .`
Expected: No matches

- [ ] **Step 4: Commit**

```bash
git add backend/auto_update.py main.py
git commit -m "refactor: remove UPDATE_CHECK_INTERVAL constant"
```

---

### Task 2: Replace background loop with one-time check

**Files:**
- Modify: `main.py:122-146`

- [ ] **Step 1: Replace the background loop in `_main()`**

Replace lines 122-139:
```python
        # Start background update checker
        async def _update_checker():
            while True:
                try:
                    await asyncio.sleep(UPDATE_CHECK_INTERVAL)
                except asyncio.CancelledError:
                    break
                info = await _check_for_update()
                if info and info.available:
                    await decky.emit("update_available", {
                        "current_version": info.current_version,
                        "latest_version": info.latest_version,
                        "release_url": info.release_url,
                        "asset_url": info.asset_url,
                        "checked_at": info.checked_at,
                    })

        self._update_task = asyncio.ensure_future(_update_checker())
```

With a single one-time check:
```python
        # One-time update check on mount
        try:
            info = await _check_for_update()
            if info and info.available:
                await decky.emit("update_available", {
                    "current_version": info.current_version,
                    "latest_version": info.latest_version,
                    "release_url": info.release_url,
                    "asset_url": info.asset_url,
                    "checked_at": info.checked_at,
                })
        except Exception as exc:
            decky.logger.warn(f"Update check failed: {exc}")
```

- [ ] **Step 2: Remove `_update_task` cancellation from `_unload()`**

Replace lines 141-146:
```python
    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")
        task = getattr(self, "_update_task", None)
        if task:
            task.cancel()
```

With:
```python
    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")
```

- [ ] **Step 3: Verify `asyncio` is still used elsewhere**

Run: `grep -n "asyncio" main.py`
Expected: `asyncio` is still used for other purposes (e.g., `asyncio.sleep` in other methods). If only used by the removed loop, remove the `import asyncio` line.

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "refactor: replace background update loop with one-time check on mount"
```

---

### Task 3: Remove update-availability toast

**Files:**
- Modify: `src/update/hooks/useUpdateStatus.ts:47-50`

- [ ] **Step 1: Remove the toast from `handleUpdateAvailable`**

In `src/update/hooks/useUpdateStatus.ts`, remove lines 47-50:
```typescript
            toaster.toast({
                title: "STPlugin",
                body: `Update v${info.latest_version} available — Open plugin to install`,
            });
```

The handler should end after the `setStatus()` call (line 46).

- [ ] **Step 2: Verify `toaster` is still used**

`toaster` is still used in:
- `handleUpdateInstalled` (line 59-62) — keep
- `checkUpdate` (lines 84, 99, 102) — keep
- `install` (lines 120, 125) — keep

Do NOT remove the `toaster` import.

- [ ] **Step 3: Commit**

```bash
git add src/update/hooks/useUpdateStatus.ts
git commit -m "refactor: remove toast on update-available event"
```

---

### Task 4: Replace banner with Decky native components

**Files:**
- Modify: `src/index.tsx:1-11` (imports)
- Modify: `src/index.tsx:34-101` (banner JSX)

- [ ] **Step 1: Update imports**

Replace lines 1-11:
```typescript
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
  Focusable,
} from "@decky/ui";
```

With:
```typescript
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Field,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
} from "@decky/ui";
```

Changes: Added `Field`, removed `Focusable`.

- [ ] **Step 2: Replace the banner JSX**

Replace lines 34-101:
```tsx
      {updateStatus.available && updateStatus.latestVersion && !bannerDismissed && (
        <div style={{
          background: "rgba(0, 255, 0, 0.1)",
          border: "1px solid rgba(0, 255, 0, 0.3)",
          borderRadius: "4px",
          padding: "12px",
          margin: "8px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <span style={{ fontWeight: "bold" }}>Update Available: v{updateStatus.latestVersion}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {updateStatus.releaseUrl && (
              <Focusable onActivate={() => { window.open(updateStatus.releaseUrl!, "_blank"); }}>
                <button
                  style={{
                    ...BUTTON.base,
                    ...BUTTON.secondary,
                  } as React.CSSProperties}
                  onClick={() => {
                    window.open(updateStatus.releaseUrl!, "_blank");
                  }}
                >
                  View
                </button>
              </Focusable>
            )}
            <Focusable onActivate={updateStatus.installing ? undefined : async () => {
              const installed = await install();
              if (installed && updateStatus.latestVersion) {
                showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
              }
            }}>
              <button
                style={{
                  ...BUTTON.base,
                  ...(updateStatus.installing
                    ? BUTTON.disabled
                    : BUTTON.primary
                  ),
                } as React.CSSProperties}
                onClick={async () => {
                  const installed = await install();
                  if (installed && updateStatus.latestVersion) {
                    showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
                  }
                }}
                disabled={updateStatus.installing}
              >
                {updateStatus.installing ? "Installing..." : "Install"}
              </button>
            </Focusable>
            <Focusable onActivate={() => setBannerDismissed(true)}>
              <button
                style={{
                  ...BUTTON.base,
                  ...BUTTON.secondary,
                } as React.CSSProperties}
                onClick={() => setBannerDismissed(true)}
              >
                Dismiss
              </button>
            </Focusable>
          </div>
        </div>
      )}
```

With:
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
            <ButtonItem
              layout="below"
              disabled={updateStatus.installing}
              onClick={async () => {
                const installed = await install();
                if (installed && updateStatus.latestVersion) {
                  showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
                }
              }}
            >
              {updateStatus.installing ? "Installing..." : "Install Update"}
            </ButtonItem>
          </PanelSectionRow>
          {updateStatus.releaseUrl && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() => window.open(updateStatus.releaseUrl!, "_blank")}
              >
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

- [ ] **Step 3: Remove unused `BUTTON` import if no longer needed**

Check if `BUTTON` is used elsewhere in `index.tsx`. It is imported from `./shared/styles` on line 26. After removing the banner, `BUTTON` is no longer used in this file. Remove it from the import:

Change line 26 from:
```typescript
import { SPACING, BORDER, BUTTON } from "./shared/styles";
```
to:
```typescript
import { SPACING, BORDER } from "./shared/styles";
```

- [ ] **Step 4: Verify the build compiles**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "refactor: replace update banner with Decky native components"
```

---

### Task 5: Verify and clean up

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `pnpm build`
Expected: Build succeeds, `dist/index.js` is produced

- [ ] **Step 3: Verify no stale references**

Run: `grep -rn "UPDATE_CHECK_INTERVAL\|_update_task\|_update_checker" .`
Expected: No matches (all removed)

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: clean up stale update-check references"
```
