# Plugin Version on Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings panel show the correct plugin version immediately on every Steam restart, instead of the stale hardcoded fallback.

**Architecture:** Add a lightweight `get_plugin_version` IPC method to the Python backend that returns `decky.DECKY_PLUGIN_VERSION`. The frontend calls it once on mount to initialize the version display, removing dependency on the network-bound update check for version accuracy.

**Tech Stack:** Python (decky runtime), TypeScript/React (Decky plugin frontend), pytest

---

### Task 1: Add `get_plugin_version()` IPC method to backend

**Files:**
- Modify: `main.py:420-422` (insert after `install_update`)
- Create: `tests/test_version.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_version.py`:

```python
"""Tests for the get_plugin_version IPC method."""

import pytest

import decky
from main import Plugin


@pytest.mark.asyncio
async def test_get_plugin_version():
    plugin = Plugin()
    version = await plugin.get_plugin_version()
    assert version == decky.DECKY_PLUGIN_VERSION
    assert isinstance(version, str)
    assert len(version) > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_version.py -v`

Expected: FAIL — `AttributeError: module 'main' has no attribute 'Plugin'` or similar (the method doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

In `main.py`, add the `get_plugin_version` method to the `Plugin` class, right after `install_update` (after line 422). Add a section comment:

```python
    # ── Plugin Info ──

    async def get_plugin_version(self) -> str:
        """Return the current plugin version from decky.DECKY_PLUGIN_VERSION."""
        return getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0")
```

Insert it after line 422 (after `return {"success": success}`) and before line 1 of any subsequent content.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_version.py -v`

Expected: PASS (2 passed). Note: the second test mocks `decky` and removes `DECKY_PLUGIN_VERSION`, so it will test the fallback path.

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `pytest tests/ -v`

Expected: All tests pass (37/37 should remain passing, now 38/38 with 1 new test).

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_version.py
git commit -m "feat: add get_plugin_version IPC method"
```

---

### Task 2: Fetch version from frontend on mount

**Files:**
- Modify: `src/update/hooks/useUpdateStatus.ts`

- [ ] **Step 1: Add the callable binding**

In `src/update/hooks/useUpdateStatus.ts`, add the new callable after the existing ones (after line 6):

```typescript
const getPluginVersion = callable<[], string>("get_plugin_version");
```

While here, also clean up the unused `installUpdate` import — actually keep it; `install()` still uses it.

- [ ] **Step 2: Add on-mount useEffect to fetch version**

In `useUpdateStatus.ts`, add a new `useEffect` right after the state initialization (before the existing `useEffect` that registers event listeners, around line 18):

```typescript
useEffect(() => {
    getPluginVersion()
        .then(version => {
            setStatus(prev => ({ ...prev, currentVersion: version }));
        })
        .catch(() => {
            // Silently keep the hardcoded fallback — no worse than today
        });
}, []);
```

- [ ] **Step 3: Verify the file compiles**

Run: `pnpm run build`

Expected: Build succeeds with no errors. The frontend TypeScript compiles correctly.

- [ ] **Step 4: Commit**

```bash
git add src/update/hooks/useUpdateStatus.ts
git commit -m "feat: fetch plugin version on mount in useUpdateStatus"
```

---

### Task 3: Update OpenSpec documentation

**Files:**
- Modify: `openspec/specs/api-contracts.md`
- Modify: `openspec/specs/backend.md`

- [ ] **Step 1: Update `api-contracts.md`**

Add the new IPC method signature after the existing `install_update` entry. In the IPC methods table (around line 135 or at the end of the `UpdateInfo`/`UpdateStatus` section), add:

```markdown
### IPCMethods

| Method | Arguments | Returns | Description |
|--------|-----------|---------|-------------|
| `get_plugin_version` | `[]` | `string` | Returns the current plugin version from the decky runtime. Used to initialize version display on startup. |
```

If there's an existing IPC methods table, append this row to it.

- [ ] **Step 2: Update `backend.md`**

In the IPC Methods section (around line 73), add after the `install_update` entry:

```markdown
#### `get_plugin_version()`
- **Method:** `Plugin.get_plugin_version(self) -> str`
- **Async:** Yes
- **Description:** Returns the current plugin version from `decky.DECKY_PLUGIN_VERSION`.
  Falls back to `"0.0.0"` if the attribute is missing.
- **Frontend callable:** `callable<[], string>("get_plugin_version")`
- **Error states:** Returns `"0.0.0"` if `DECKY_PLUGIN_VERSION` is not set (should never happen).
```

- [ ] **Step 3: Commit**

```bash
git add openspec/specs/api-contracts.md openspec/specs/backend.md
git commit -m "docs: document get_plugin_version IPC method in openspec"
```

---

### Task 4: Update test mock version to match package.json

**Files:**
- Modify: `tests/conftest.py`

- [ ] **Step 1: Read current package.json version**

The current `conftest.py` mocks `DECKY_PLUGIN_VERSION = "0.1.0"`. The real version in `package.json` is `"1.0.3"`. Update the mock to match:

In `tests/conftest.py` line 10, change:

```python
mock_decky.DECKY_PLUGIN_VERSION = "0.1.0"
```

to:

```python
mock_decky.DECKY_PLUGIN_VERSION = "1.0.3"
```

- [ ] **Step 2: Run test suite to verify**

Run: `pytest tests/ -v`

Expected: All tests pass. The version-related tests now match the real package.json version.

- [ ] **Step 3: Commit**

```bash
git add tests/conftest.py
git commit -m "chore: update test mock version to match package.json"
```

---

### Verification

- [ ] **End-to-end check:** `pytest tests/ -v` — all tests pass
- [ ] **Build check:** `pnpm run build` — compiles without errors
- [ ] **Behavior check:** After deploying, the Settings panel should show "Current Version: 1.0.3" immediately on plugin load, without requiring a "Check for Updates" click
