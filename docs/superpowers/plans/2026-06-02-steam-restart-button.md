# Steam Restart Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Restart Steam" button to the main menu and a post-download restart prompt, backed by a Python callable that spawns a detached OS script to kill and relaunch Steam.

**Architecture:** Python writes a platform-specific script (PowerShell on Windows, bash on Linux) to the plugin settings dir, spawns it as a fully detached process, and returns immediately. The script sleeps, kills Steam, waits, then starts Steam and exits. Frontend adds inline confirmation state (no modal) on both the main menu button and the post-download prompt.

**Tech Stack:** Python 3 (subprocess, sys, pathlib), TypeScript/React (@decky/ui ButtonItem, @decky/api callable/toaster), pytest (unittest.mock)

---

### Task 1: Backend tests for `restart_steam()` (failing)

**Files:**
- Create: `tests/test_restart_steam.py`

- [ ] **Step 1: Create test file with all 8 tests**

Write `tests/test_restart_steam.py`:

```python
"""Unit tests for Steam restart functionality."""
import sys
import tempfile
from unittest.mock import patch, MagicMock, call
from pathlib import Path

import pytest


def _plugin_instance():
    """Create a Plugin instance for testing (imports main module)."""
    import main
    return main.Plugin()


class TestRestartSteam:
    """Tests for Plugin.restart_steam()."""

    @pytest.mark.asyncio
    async def test_returns_success(self):
        """Happy path: script written, process spawned, returns success."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="/fake/steam"):
                    with patch("main.subprocess.Popen") as mock_popen:
                        plugin = _plugin_instance()
                        result = await plugin.restart_steam()
                        assert result == {"success": True}
                        mock_popen.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_steam_path(self):
        """Returns error when Steam path not found."""
        with patch("main.get_steam_path", return_value=""):
            plugin = _plugin_instance()
            result = await plugin.restart_steam()
            assert result == {"success": False, "error": "Steam path not detected"}

    @pytest.mark.asyncio
    async def test_no_steam_path_none(self):
        """Returns error when Steam path is None."""
        with patch("main.get_steam_path", return_value=None):
            plugin = _plugin_instance()
            result = await plugin.restart_steam()
            assert result == {"success": False, "error": "Steam path not detected"}

    @pytest.mark.asyncio
    async def test_spawn_failure(self):
        """Handles subprocess.Popen exception gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="/fake/steam"):
                    with patch("main.subprocess.Popen", side_effect=OSError("spawn failed")):
                        plugin = _plugin_instance()
                        result = await plugin.restart_steam()
                        assert result["success"] is False
                        assert "spawn failed" in result["error"]

    @pytest.mark.asyncio
    @pytest.mark.skipif(sys.platform != "win32", reason="Windows-only test")
    async def test_windows_script_contents(self):
        """Verifies PowerShell script contains correct commands."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="C:\\Steam"):
                    with patch("main.subprocess.Popen"):
                        with patch("main.sys.platform", "win32"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            script = Path(tmpdir) / "restart_steam.ps1"
                            content = script.read_text()
                            assert "steam.exe" in content
                            assert "taskkill /F /IM steam.exe" in content
                            assert "Start-Process" in content
                            assert "Start-Sleep -Seconds 3" in content

    @pytest.mark.asyncio
    @pytest.mark.skipif(sys.platform == "win32", reason="Linux-only test")
    async def test_linux_script_contents(self):
        """Verifies bash script contains correct commands."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="/opt/steam"):
                    with patch("main.subprocess.Popen"):
                        with patch("main.sys.platform", "linux"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            script = Path(tmpdir) / "restart_steam.sh"
                            content = script.read_text()
                            assert "#!/bin/bash" in content
                            assert "pkill -9 steam" in content
                            assert "steam &" in content

    @pytest.mark.asyncio
    @pytest.mark.skipif(sys.platform != "win32", reason="Windows-only test")
    async def test_detachment_windows(self):
        """Verifies DETACHED_PROCESS | CREATE_NO_WINDOW flags."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="C:\\Steam"):
                    with patch("main.subprocess.Popen") as mock_popen:
                        with patch("main.sys.platform", "win32"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            _, kwargs = mock_popen.call_args
                            assert "creationflags" in kwargs
                            import subprocess
                            expected = subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
                            assert kwargs["creationflags"] == expected

    @pytest.mark.asyncio
    @pytest.mark.skipif(sys.platform == "win32", reason="Linux-only test")
    async def test_detachment_linux(self):
        """Verifies start_new_session=True."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="/opt/steam"):
                    with patch("main.subprocess.Popen") as mock_popen:
                        with patch("main.sys.platform", "linux"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            _, kwargs = mock_popen.call_args
                            assert kwargs.get("start_new_session") is True


class TestRestartSteamCleanup:
    """Tests for stale script cleanup on _main()."""

    @pytest.mark.asyncio
    async def test_cleanup_removes_stale_scripts(self):
        """_main() removes leftover restart_steam.* files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create stale scripts
            ps1 = Path(tmpdir) / "restart_steam.ps1"
            sh = Path(tmpdir) / "restart_steam.sh"
            ps1.write_text("stale")
            sh.write_text("stale")

            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.refresh_manifest", return_value=[]):
                    plugin = _plugin_instance()
                    await plugin._main()

                    assert not ps1.exists()
                    assert not sh.exists()

    @pytest.mark.asyncio
    async def test_cleanup_no_files_no_error(self):
        """_main() succeeds even when no stale scripts exist."""
        import os as real_os  # avoid shadowing

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.refresh_manifest", return_value=[]):
                    plugin = _plugin_instance()
                    await plugin._main()  # Should not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_restart_steam.py -v
```

Expected: all tests FAIL — "Plugin has no attribute 'restart_steam'" or similar.

- [ ] **Step 3: Commit**

```bash
git add tests/test_restart_steam.py
git commit -m "test: add failing restart_steam backend tests"
```

---

### Task 2: Implement `restart_steam()` in `main.py`

**Files:**
- Modify: `main.py` — add `subprocess` import and `restart_steam()` method

- [ ] **Step 1: Add `subprocess` import**

In `main.py`, add `import subprocess` to the imports block (after `import asyncio`):

```python
import subprocess
```

- [ ] **Step 2: Add `restart_steam()` method to Plugin class**

Add after the existing `search_games` method (before the closing of the Plugin class). Insert:

```python
    # ── Steam Restart ──

    async def restart_steam(self) -> dict[str, Any]:
        """Kill and restart Steam via a detached platform script.

        Writes a PowerShell (Windows) or bash (Linux) script to the
        plugin settings directory, spawns it as a fully detached
        process, and returns immediately. The script survives Steam
        shutdown and relaunches Steam afterward, then exits.
        """
        steam_path = get_steam_path()
        if not steam_path:
            return {"success": False, "error": "Steam path not detected"}

        settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        settings_dir.mkdir(parents=True, exist_ok=True)

        try:
            if sys.platform == "win32":
                self._spawn_restart_windows(steam_path, settings_dir)
            else:
                self._spawn_restart_linux(settings_dir)
        except Exception as exc:
            decky.logger.error(f"Failed to spawn restart script: {exc}")
            return {"success": False, "error": str(exc)}

        return {"success": True}

    @staticmethod
    def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None:
        """Write and spawn PowerShell restart script (Windows)."""
        steam_exe = str(Path(steam_path) / "steam.exe")
        script_path = settings_dir / "restart_steam.ps1"
        script_path.write_text(
            f'$steamPath = "{steam_exe}"\n'
            "taskkill /F /IM steam.exe 2>$null\n"
            "Start-Sleep -Seconds 3\n"
            "while (Get-Process steam -ErrorAction SilentlyContinue) {"
            " Start-Sleep -Seconds 1 }\n"
            "Start-Process -FilePath $steamPath\n"
        )
        subprocess.Popen(
            ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW,
        )

    @staticmethod
    def _spawn_restart_linux(settings_dir: Path) -> None:
        """Write and spawn bash restart script (Linux)."""
        script_path = settings_dir / "restart_steam.sh"
        script_path.write_text(
            "#!/bin/bash\n"
            "sleep 3\n"
            "pkill -9 steam 2>/dev/null\n"
            "sleep 2\n"
            "steam &\n"
        )
        script_path.chmod(0o755)
        subprocess.Popen(
            ["bash", str(script_path)],
            start_new_session=True,
        )
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
python -m pytest tests/test_restart_steam.py -v
```

Expected: all 10 tests PASS.

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
python -m pytest tests/ -v
```

Expected: all tests pass (27 existing + 10 new = 37).

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat: add restart_steam() backend callable with detached scripts"
```

---

### Task 3: Add stale script cleanup in `_main()`

**Files:**
- Modify: `main.py` — add cleanup block to `_main()` lifecycle method

- [ ] **Step 1: Add cleanup in `_main()`**

In `main.py`, add script cleanup at the start of `_main()` (after the log line, before the manifest fetch):

```python
    async def _main(self) -> None:
        """Initialize on plugin load."""
        decky.logger.info(f"{decky.DECKY_PLUGIN_NAME} v{decky.DECKY_PLUGIN_VERSION} loaded")

        # Clean up stale restart scripts from previous runs
        settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        for pattern in ["restart_steam.ps1", "restart_steam.sh"]:
            script = settings_dir / pattern
            if script.exists():
                try:
                    script.unlink()
                except OSError:
                    pass

        # Pre-fetch API manifest in background
        try:
            sources = await refresh_manifest()
            decky.logger.info(f"API manifest loaded: {len(sources)} sources")
        except Exception as exc:
            decky.logger.warn(f"API manifest fetch failed: {exc}")
```

- [ ] **Step 2: Run cleanup tests**

```bash
python -m pytest tests/test_restart_steam.py::TestRestartSteamCleanup -v
```

Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "feat: clean up stale restart scripts on plugin load"
```

---

### Task 4: Add restart button to MainPanel

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Add imports and IPC binding**

At the top of `src/index.tsx`, add `callable` and `toaster` to the `@decky/api` import, and add `useState` to the React import:

```typescript
import {
  definePlugin,
  routerHook,
  callable,
  toaster,
} from "@decky/api";
import React, { useState } from "react";
```

After the existing imports, add the IPC binding:

```typescript
const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");
```

- [ ] **Step 2: Add restart button with inline confirmation to MainPanel**

Replace the `MainPanel` function with:

```typescript
function MainPanel() {
  const [restartState, setRestartState] = useState<"idle" | "confirming" | "restarting">("idle");

  const handleRestartClick = () => {
    if (restartState === "idle") {
      setRestartState("confirming");
    }
  };

  const handleRestartCancel = () => {
    setRestartState("idle");
  };

  const handleRestartConfirm = async () => {
    setRestartState("restarting");
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setRestartState("idle");
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setRestartState("idle");
    }
  };

  return (
    <PanelSection title="STPlugin">
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/download")}
        >
          Download Lua Script
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/installed")}
        >
          Installed Scripts
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.Navigate("/stplugin/settings")}
        >
          Settings
        </ButtonItem>
      </PanelSectionRow>

      {/* Restart Steam — with inline confirmation */}
      <PanelSectionRow>
        {restartState === "confirming" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div className={staticClasses.Label} style={{ color: "var(--gpSystemYellow)", marginBottom: "4px" }}>
              Restart Steam?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <ButtonItem layout="below" onClick={handleRestartCancel}>
                Cancel
              </ButtonItem>
              <ButtonItem layout="below" onClick={handleRestartConfirm}>
                Yes, restart
              </ButtonItem>
            </div>
          </div>
        ) : (
          <ButtonItem
            layout="below"
            onClick={handleRestartClick}
            disabled={restartState === "restarting"}
          >
            {restartState === "restarting" ? "Restarting..." : "Restart Steam"}
          </ButtonItem>
        )}
      </PanelSectionRow>
    </PanelSection>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm run build
```

Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.tsx
git commit -m "feat: add restart steam button to main menu with inline confirmation"
```

---

### Task 5: Add post-download restart prompt to DownloadPanel

**Files:**
- Modify: `src/components/DownloadPanel.tsx`

- [ ] **Step 1: Add `restartSteam` IPC binding**

At the top of `DownloadPanel.tsx`, add the IPC binding after the existing `callable` declarations:

```typescript
const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");
```

- [ ] **Step 2: Add restart prompt state and handler**

Add a state variable inside the `DownloadPanel` function, after the existing state declarations:

```typescript
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [restartConfirming, setRestartConfirming] = useState(false);

  const handlePostDownloadRestart = async () => {
    if (!restartConfirming) {
      setRestartConfirming(true);
      return;
    }
    try {
      const result = await restartSteam();
      if (result.success) {
        toaster.toast({ title: "STPlugin", body: "Steam is restarting..." });
        setShowRestartPrompt(false);
        setRestartConfirming(false);
      } else {
        toaster.toast({ title: "Restart Failed", body: result.error || "Unknown error" });
        setRestartConfirming(false);
      }
    } catch (err: any) {
      toaster.toast({ title: "Restart Failed", body: String(err) });
      setRestartConfirming(false);
    }
  };

  const dismissRestartPrompt = () => {
    setShowRestartPrompt(false);
    setRestartConfirming(false);
  };
```

- [ ] **Step 3: Trigger prompt on download done**

In the `download_progress` event listener, add logic to show the prompt when phase is "done":

Find this block in the `useEffect`:

```typescript
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Installed Lua for App ${progress.appid}`,
            });
          }
```

Replace with:

```typescript
          if (progress.phase === "done") {
            toaster.toast({
              title: "STPlugin",
              body: `Installed Lua for App ${progress.appid}`,
            });
            setShowRestartPrompt(true);
          }
```

- [ ] **Step 4: Clear prompt on new download start**

In `handleStart`, add reset at the beginning:

```typescript
  const handleStart = async () => {
    const id = parseInt(appidInput);
    if (isNaN(id) || id <= 0) return;

    setShowRestartPrompt(false);
    setRestartConfirming(false);
```

- [ ] **Step 5: Render restart prompt below download area**

After the download progress display block (the `{downloadState && (` block ending around line 294), add:

```typescript
      {/* Post-download restart prompt */}
      {showRestartPrompt && !isDownloading && (
        <PanelSectionRow>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div className={staticClasses.Label} style={{ color: "var(--gpSystemGreen)" }}>
              Download complete!
            </div>
            {restartConfirming ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className={staticClasses.Label} style={{ color: "var(--gpSystemYellow)" }}>
                  Restart Steam to apply changes?
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <ButtonItem layout="below" onClick={dismissRestartPrompt}>
                    Cancel
                  </ButtonItem>
                  <ButtonItem layout="below" onClick={handlePostDownloadRestart}>
                    Yes, restart
                  </ButtonItem>
                </div>
              </div>
            ) : (
              <ButtonItem layout="below" onClick={handlePostDownloadRestart}>
                Restart Steam to apply
              </ButtonItem>
            )}
          </div>
        </PanelSectionRow>
      )}
```

This goes just before the closing `</PanelSection>`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm run build
```

Expected: build succeeds, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/DownloadPanel.tsx
git commit -m "feat: add post-download restart prompt to DownloadPanel"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run all backend tests**

```bash
python -m pytest tests/ -v
```

Expected: all 37 tests pass.

- [ ] **Step 2: Verify frontend build**

```bash
pnpm run build
```

Expected: build succeeds, `dist/index.js` produced.

- [ ] **Step 3: Final commit (if any changes)**

```bash
git status
git diff
```

If clean, no commit needed. Otherwise commit any remaining changes.
