# Post-Install Restart Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a successful plugin update via the "Install" or "Install Now" button, show a modal dialog with "Restart Steam" and "Later" buttons instead of relying solely on a brief toast.

**Architecture:** The existing `install_update` backend IPC already returns `{success: boolean}` synchronously. We change `install()` in the `useUpdateStatus` hook to return `Promise<boolean>`, create a new `UpdateInstalledModal` component wrapping `ConfirmModal`, and update both callers (`MainPanel` in `index.tsx` and `SettingsPanel`) to await `install()` and show the modal on success. The existing `update_installed` event handler stays as a safety reset + toast fallback.

**Tech Stack:** TypeScript, React (TSX), `@decky/ui` (`ConfirmModal`, `showModal`), `@decky/api` (IPC callables)

**No backend changes needed** — `install_update` already returns `bool`. The Python tests (96/96) already pass and cover the backend. No React test framework exists, so this plan adds a new Python backend test for the `install_update` callable signature contract.

---

### Task 1: Modify `useUpdateStatus` hook — `install()` returns `Promise<boolean>`

**Files:**
- Modify: `src/update/hooks/useUpdateStatus.ts` (lines 102-116)
- Test: `tests/test_auto_update.py` (add new test class)

**Rationale:** Currently `install()` returns `void` and relies entirely on the `update_installed` event to reset `installing` state. The caller has no way to know if installation succeeded. We change `install()` to:
1. Return `Promise<boolean>` (true = installed successfully)
2. On IPC success: immediately set `installing: false` and `available: false`, return `true`
3. On error/failure: show error toast, set `installing: false`, return `false`
4. The event handler keeps firing later as a safety reset + toast fallback

The early return guard `if (!status.assetUrl) return;` now returns `false` instead of `undefined`.

- [ ] **Step 1: Write the backend test verifying `install_update` callable contract**

The frontend hook calls `installUpdate(status.assetUrl)` which maps to the backend `install_update` Python function. We need a test that verifies `install_update` returns `True` when it emits the `update_installed` event — confirming the callable contract the frontend depends on.

Add to `tests/test_auto_update.py` after the existing `TestInstallUpdate` class:

```python
class TestInstallUpdateContract:
    """Verify the callable contract that the frontend hook depends on."""

    @pytest.mark.asyncio
    async def test_install_update_returns_true_on_success(self):
        """install_update must return True when it emits update_installed."""
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = Path(tmp.name)
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("main.py", "# test content")
                zf.writestr("package.json", '{"version": "0.2.0"}')

        try:
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.content = zip_path.read_bytes()
                mock_response.raise_for_status = MagicMock()
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_response
                )

                with patch("backend.auto_update.decky") as mock_decky:
                    mock_decky.DECKY_PLUGIN_DIR = tempfile.mkdtemp()
                    mock_decky.emit = AsyncMock()

                    result = await install_update(
                        "https://example.com/update.zip"
                    )

                    # The frontend expects result === True on success
                    assert result is True
                    # The frontend relies on the event for safety reset
                    mock_decky.emit.assert_called_once_with(
                        "update_installed", {}
                    )
        finally:
            zip_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_install_update_returns_false_on_failure(self):
        """install_update must return False on download failure."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )

            result = await install_update(
                "https://example.com/update.zip"
            )

            # The frontend checks result.success (== result === True)
            assert result is False
```

Run: `python -m pytest tests/test_auto_update.py::TestInstallUpdateContract -v`
Expected: PASS for both tests

- [ ] **Step 2: Run tests to verify they fail initially (should not — backend already works)**

Actually, the backend already passes these tests because the behavior exists. This step confirms the baseline.

Run: `python -m pytest tests/test_auto_update.py -v`
Expected: All existing tests pass (the new contract tests should also pass against the current backend)

- [ ] **Step 3: Modify `install()` in `useUpdateStatus.ts`**

Change the `install` function (lines 102-116) from:

```typescript
const install = useCallback(async () => {
    if (!status.assetUrl) return;

    setStatus(prev => ({ ...prev, installing: true }));
    try {
        const result = await installUpdate(status.assetUrl!);
        if (!result.success) {
            toaster.toast({ title: "Installation Failed", body: "Try manual install." });
            setStatus(prev => ({ ...prev, installing: false }));
        }
    } catch (err) {
        toaster.toast({ title: "Installation Failed", body: String(err) });
        setStatus(prev => ({ ...prev, installing: false }));
    }
}, [status.assetUrl]);
```

To:

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

Changes made:
1. Return type annotation: `(): Promise<boolean>`
2. Early return: `return false` instead of bare `return`
3. Success branch: immediately set `available: false` and `installing: false`, then `return true`
4. Error branches: `return false` added
5. Changed `status.assetUrl!` to `status.assetUrl` (non-null assertion removed — the guard above guarantees it's truthy, and `callable` accepts `string` not `string | undefined`)

- [ ] **Step 4: Verify TypeScript compilation**

Run: `pnpm build`
Expected: No TypeScript errors. The install function compiles with the new return type.

- [ ] **Step 5: Run Python tests to confirm nothing broke**

Run: `python -m pytest tests/test_auto_update.py -v`
Expected: All tests pass (97/97 with the new contract tests)

- [ ] **Step 6: Commit**

```bash
git add src/update/hooks/useUpdateStatus.ts tests/test_auto_update.py
git commit -m "feat: install() returns Promise<boolean> for modal-driven post-install UX"
```

---

### Task 2: Create `UpdateInstalledModal` component

**Files:**
- Create: `src/update/components/UpdateInstalledModal.tsx`

**Rationale:** A thin modal component that wraps Decky's `ConfirmModal` to show "Update Installed" with a "Restart Steam" button (calls `useRestartSteam.confirmRestart`) and a "Later" dismiss button. Lives in `src/update/components/` alongside other update-related code rather than in `src/shared/components/`.

- [ ] **Step 1: Create the component directory and file**

The directory `src/update/components/` does not exist yet. Create it implicitly by writing the file.

Write `src/update/components/UpdateInstalledModal.tsx`:

```tsx
import React from "react";
import { ConfirmModal } from "@decky/ui";
import { useRestartSteam } from "../../shared/hooks/useRestartSteam";

interface UpdateInstalledModalProps {
  version: string;
}

export function UpdateInstalledModal({ version }: UpdateInstalledModalProps) {
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: No TypeScript errors. The component compiles correctly with `ConfirmModal` and `useRestartSteam` imports.

- [ ] **Step 3: Commit**

```bash
git add src/update/components/UpdateInstalledModal.tsx
git commit -m "feat: add UpdateInstalledModal component wrapping ConfirmModal"
```

---

### Task 3: Update `MainPanel` (src/index.tsx) — show modal on install success

**Files:**
- Modify: `src/index.tsx` (lines 55-60, install button onClick; add imports)

**Rationale:** The update banner in `MainPanel` currently calls `install()` without awaiting or checking the result. Change it to `await install()` and show `UpdateInstalledModal` on success.

- [ ] **Step 1: Add imports and update the install button handler**

Add these imports at the top of `src/index.tsx` (after line 8, alongside existing `@decky/ui` imports):

```typescript
import { showModal } from "@decky/ui";
```

Add this import alongside the existing `useUpdateStatus` import (line 20):

```typescript
import { UpdateInstalledModal } from "./update/components/UpdateInstalledModal";
```

Change the install button `onClick` handler (current lines 55-60):

From:
```tsx
<ButtonItem onClick={install} disabled={updateStatus.installing}>
  {updateStatus.installing ? "Installing..." : "Install"}
</ButtonItem>
```

To:
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: No TypeScript errors. `showModal` and `UpdateInstalledModal` resolve correctly.

- [ ] **Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: show UpdateInstalledModal after install in MainPanel"
```

---

### Task 4: Update `SettingsPanel` — show modal on install success

**Files:**
- Modify: `src/SettingsPanel.tsx` (lines 132-142, install button onClick; add imports)

**Rationale:** Same change as Task 3 but for the Settings panel's "Install Now" button.

- [ ] **Step 1: Add imports and update the install button handler**

If `showModal` is not already imported from `@decky/ui` in `SettingsPanel.tsx`, add it to the existing destructured import (line 1-5):

```typescript
import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
  showModal,
} from "@decky/ui";
```

Add the `UpdateInstalledModal` import alongside the existing `useUpdateStatus` import (line 14):

```typescript
import { UpdateInstalledModal } from "./update/components/UpdateInstalledModal";
```

Change the "Install Now" button `onClick` handler (current lines 132-142):

From:
```tsx
<ButtonItem
  layout="below"
  onClick={install}
  disabled={updateStatus.installing}
>
  {updateStatus.installing ? "Installing..." : "Install Now"}
</ButtonItem>
```

To:
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/SettingsPanel.tsx
git commit -m "feat: show UpdateInstalledModal after install in SettingsPanel"
```

---

### Task 5: Full build and verification

**Files:** None — verify all tasks together.

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Clean rollup output, `dist/index.js` created.

- [ ] **Step 2: Run all Python tests**

Run: `python -m pytest --tb=short -q`
Expected: 97 passed (including the 1 new contract test from Task 1), 2 skipped.

- [ ] **Step 3: Verify the diff is clean**

Run: `git diff --stat`
Expected: 4 files changed — 1 test file, 1 new component, 2 modified callers.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore: post-install restart modal build and test verification"
```

---

## Manual Test Checklist

Run these manually after deployment to verify the feature works end-to-end:

| Test | Steps | Expected |
|------|-------|----------|
| Modal appears after install | Click "Install" in MainPanel banner | After download completes, modal shows with "Update Installed" title, "Restart Steam" and "Later" buttons |
| "Later" dismisses modal | Click "Later" on modal | Modal closes, no restart |
| "Restart Steam" triggers restart | Click "Restart Steam" on modal | Steam restarts (toast "Steam is restarting...") |
| Modal in Settings panel | Navigate to Settings, click "Install Now" | Same modal appears |
| Install failure → no modal | Simulate network failure during install | Error toast appears, no modal |
| Toast fallback still works | Install succeeds, navigate away before modal shows | Toast "Update installed! Restart Steam to apply." appears |

## Self-Review Checklist

- [ ] **Spec coverage:** Every section of the spec has a corresponding task:
  - Section 3.2 (hook changes) → Task 1
  - Section 3.3 (new component) → Task 2
  - Section 3.4 (caller integration, MainPanel) → Task 3
  - Section 3.4 (caller integration, SettingsPanel) → Task 4
  - Section 4 (error handling) → covered by Tasks 1-4 (false returns propagate correctly, toast fallback preserved)
  - Section 5 (files changed) → all 4 files listed are covered
  - Section 6 (testing) → Task 5 + Manual Test Checklist
- [ ] **No placeholders:** All code blocks contain complete, compilable code.
- [ ] **Type consistency:** `install()` returns `Promise<boolean>` everywhere. `UpdateInstalledModalProps` uses `version: string` consistently. `showModal` is imported from `@decky/ui` everywhere it's used.
- [ ] **No scope creep:** No unrelated changes — the plan touches only the 4 files listed in the spec.
- [ ] **Import paths match existing patterns:** `../../shared/hooks/useRestartSteam` from `src/update/components/` is correct (update/components/ → update/ → src/ → shared/hooks/). `./update/components/UpdateInstalledModal` from `src/index.tsx` is correct.
