# Prune Store Page Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all store page button injection code (frontend, backend, tests) — plugin becomes purely QAM-based.

**Architecture:** Deletion-only. Three files deleted, three files surgically edited. No new code, no new tests. Existing 14 tests must still pass.

**Tech Stack:** TypeScript/React (frontend edits), Python (backend edits), Markdown (AGENTS.md edit)

---

### Task 1: Delete store page injection files

**Files:**
- Delete: `src/patches/storeButton.tsx`
- Delete: `backend/store_injector.py`
- Delete: `tests/test_store_injector.py`

- [ ] **Step 1: Delete the three files**

```bash
Remove-Item -LiteralPath "src\patches\storeButton.tsx"
Remove-Item -LiteralPath "src\patches"
Remove-Item -LiteralPath "backend\store_injector.py"
Remove-Item -LiteralPath "tests\test_store_injector.py"
```

- [ ] **Step 2: Verify deletions**

```bash
Test-Path -LiteralPath "src\patches" && Write-Host "ERROR: patches/ still exists" || Write-Host "OK: patches/ removed"
Test-Path -LiteralPath "backend\store_injector.py" && Write-Host "ERROR: store_injector.py still exists" || Write-Host "OK: store_injector.py removed"
Test-Path -LiteralPath "tests\test_store_injector.py" && Write-Host "ERROR: test_store_injector.py still exists" || Write-Host "OK: test_store_injector.py removed"
```

Expected: All three "OK" messages.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove store page injection files (frontend, backend, tests)"
```

---

### Task 2: Edit `src/index.tsx` — remove store button patch

**Files:**
- Modify: `src/index.tsx:22` (import)
- Modify: `src/index.tsx:9-15` (unused API imports)
- Modify: `src/index.tsx:63` (registration)
- Modify: `src/index.tsx:76` (unpatch)

- [ ] **Step 1: Remove storeButton import (line 22)**

Delete this line:
```tsx
import { registerStoreButtonPatch } from "./patches/storeButton";
```

- [ ] **Step 2: Clean unused API imports (lines 9-15)**

Replace:
```tsx
import {
  definePlugin,
  callable,
  addEventListener,
  removeEventListener,
  toaster,
  routerHook,
} from "@decky/api";
```

With:
```tsx
import {
  definePlugin,
  routerHook,
} from "@decky/api";
```

- [ ] **Step 3: Remove storeButton registration (line 63)**

Delete this line and the blank line after it:
```tsx
const storeButtonUnpatch = registerStoreButtonPatch();
```

- [ ] **Step 4: Remove storeButton unpatch (line 76)**

Delete this line:
```tsx
storeButtonUnpatch?.unpatch?.();
```

- [ ] **Step 5: Verify frontend builds**

```bash
pnpm build
```

Expected: Build succeeds with zero errors. No "cannot find module" or "unresolved import" errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.tsx
git commit -m "refactor: remove storeButton patch from plugin entry point"
```

---

### Task 3: Edit `main.py` — remove StoreInjector lifecycle

**Files:**
- Modify: `main.py:14` (import)
- Modify: `main.py:69-72` (_main instantiation)
- Modify: `main.py:83-84` (_unload cleanup)

- [ ] **Step 1: Remove StoreInjector import (line 14)**

Delete this line:
```python
from backend.store_injector import StoreInjector
```

- [ ] **Step 2: Remove _main instantiation (lines 69-72)**

Delete these four lines:
```python
        # Start store page button injection
        self._store_injector = StoreInjector()
        self.loop = asyncio.get_event_loop()
        self.loop.create_task(self._store_injector.start())
```

The `_main` method should now be:
```python
    async def _main(self) -> None:
        """Initialize on plugin load."""
        decky.logger.info(f"{decky.DECKY_PLUGIN_NAME} v{decky.DECKY_PLUGIN_VERSION} loaded")

        # Pre-fetch API manifest in background
        try:
            sources = await refresh_manifest()
            decky.logger.info(f"API manifest loaded: {len(sources)} sources")
        except Exception as exc:
            decky.logger.warn(f"API manifest fetch failed: {exc}")
```

- [ ] **Step 3: Remove _unload cleanup (lines 83-84)**

Delete these two lines:
```python
        if hasattr(self, "_store_injector"):
            await self._store_injector.stop()
```

The `_unload` method should now be:
```python
    async def _unload(self) -> None:
        """Cleanup on plugin unload."""
        decky.logger.info("STPlugin unloading")
```

- [ ] **Step 4: Verify remaining tests pass**

```bash
pytest tests/ -v
```

Expected: All remaining tests pass (~14 tests, ~17 minus the 3 in test_store_injector.py). Zero import errors.

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "refactor: remove StoreInjector lifecycle from Plugin class"
```

---

### Task 4: Update `AGENTS.md` — remove store injection documentation

**Files:**
- Modify: `AGENTS.md` (5 sections)

- [ ] **Step 1: Remove Current State warning (line 11)**

Delete the line:
```markdown
**⚠️ Store button injection needs redesign.** The current React patch (`storeButton.tsx`) finds `module.Q` in `webpackChunksteamui` but this component never renders — it's a config wrapper. The actual store game page on Windows BPM overlay is an **embedded CEF webview** loading `store.steampowered.com` (server-rendered HTML, not React). React patching cannot reach into the webview. Must switch to `executeInTab` CDP injection. See [#store-page-architecture](#store-page-architecture) below.
```

- [ ] **Step 2: Update Feature Scope KEEP list (line 30)**

Replace:
```markdown
| ✅ **KEEP** | Lua download pipeline (4 API sources), store page button injection (React patch), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection |
```

With:
```markdown
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection |
```

- [ ] **Step 3: Simplify Rule #5 (line 52)**

Replace:
```markdown
5. **No direct DOM manipulation in GamepadUI.** Use Decky's module patching (`findModuleExport`, `afterPatch`, `createReactTreePatcher`) for React-rendered UI. **Exception:** The store game page on Windows BPM overlay is a CEF webview loading server-rendered `store.steampowered.com` HTML — it has no React components. Store page injection MUST use `executeInTab` CDP injection with DOM manipulation inside the webview context. The Millennium plugin uses `document.querySelector` and `MutationObserver` extensively — these patterns apply ONLY to the store webview, not to GamepadUI React components.
```

With:
```markdown
5. **No direct DOM manipulation in GamepadUI.** Use Decky's module patching (`findModuleExport`, `afterPatch`, `createReactTreePatcher`) for React-rendered UI.
```

- [ ] **Step 4: Delete Store Page Architecture section (lines 94-122)**

Delete the entire block from `## Store Page Architecture` through the end of the file. The last remaining section should be `## Key Differences: Millennium → Decky`.

- [ ] **Step 5: Remove patches/ from Project Structure (line 61)**

Delete this line:
```markdown
│   ├── patches/            # React tree patchers (store button injection)
```

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: remove store page injection from AGENTS.md"
```

---

### Task 5: Final verification

- [ ] **Step 1: Search for residual references**

```bash
rg -li "storeButton|store_injector|StoreInjector|stplugin_store_download" --glob "*.ts" --glob "*.tsx" --glob "*.py" --glob "*.json" | rg -v "^docs/"
```

Expected: Zero results (no output). Docs/history files may still reference the terms, which is fine.

- [ ] **Step 2: Full build**

```bash
pnpm build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 3: Full test suite**

```bash
pytest tests/ -v
```

Expected: All remaining tests pass.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git status
# Verify only expected files are staged, then:
git commit -m "verify: confirm all store injection code removed, build + tests pass"
```
