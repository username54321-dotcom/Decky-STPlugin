# Restart Steam: PluginLoader-Noconsole Launch Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the Windows Steam restart batch script to launch `PluginLoader_noconsole.exe` before Steam, with a verified-start wait loop (max 10s).

**Architecture:** All-in-one batch script approach. Python resolves the PluginLoader path dynamically using `decky.DECKY_HOME` (fallback: `Path.home() / "homebrew" / "services"`), injects it into a single `.bat` template, and detaches the script. The script runs the full sequence: kill processes → wait for exit → start PluginLoader → wait-loop on `tasklist` → start Steam → self-delete. Only `_spawn_restart_windows()` and a new `_resolve_plugin_loader_path()` change; `restart_steam()`, frontend, and Linux path are untouched.

**Tech Stack:** Python 3.11+, batch scripting, Decky Python SDK (`decky.DECKY_HOME`)

---

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `main.py` | **Modify** | Add `BAT_TEMPLATE` constant, `_resolve_plugin_loader_path()`, update `_spawn_restart_windows()` |
| `tests/conftest.py` | **Modify** | Add `mock_decky.DECKY_HOME` so path resolver tests work |
| `tests/test_restart_steam.py` | **Modify** | Update `test_windows_script_contents`, add 2 new tests |
| `openspec/specs/backend.md` | **Modify** | Document `_resolve_plugin_loader_path()`, update `_spawn_restart_windows` desc |

---

### Task 1: Add `DECKY_HOME` Mock to Test Conftest

**Files:**
- Modify: `tests/conftest.py`

- [ ] **Step 1: Add DECKY_HOME to the decky mock**

Edit `tests/conftest.py` to add `mock_decky.DECKY_HOME`:

```python
mock_decky.DECKY_PLUGIN_SETTINGS_DIR = "/tmp/stplugin"
mock_decky.DECKY_HOME = "/home/deck/homebrew"   # ← add this line
```

This lets tests that call `_resolve_plugin_loader_path()` resolve without crashing on a missing attribute.

- [ ] **Step 2: Verify conftest loads correctly**

Run: `pytest tests/test_restart_steam.py::TestRestartSteamCleanup -v`
Expected: 2 passed (these tests don't depend on the new code yet)

- [ ] **Step 3: Commit**

```bash
git add tests/conftest.py
git commit -m "test: add DECKY_HOME mock for PluginLoader path resolution"
```

---

### Task 2: Implement `_resolve_plugin_loader_path()` + `BAT_TEMPLATE`

**Files:**
- Modify: `main.py`
- Test: `tests/test_restart_steam.py`

- [ ] **Step 1: Write failing test for `_resolve_plugin_loader_path()`**

Add these new tests to `tests/test_restart_steam.py`, after the `TestRestartSteamCleanup` class:

```python
class TestResolvePluginLoaderPath:
    """Tests for Plugin._resolve_plugin_loader_path()."""

    def test_returns_none_when_not_found(self):
        """Returns None when PluginLoader is not in any known location."""
        import main
        from unittest.mock import patch

        with patch("main.Path.home") as mock_home:
            mock_home.return_value = Path("/nonexistent")
            result = main.Plugin._resolve_plugin_loader_path()
            assert result is None

    def test_uses_decky_home_first(self):
        """Returns decky.DECKY_HOME/services path when both candidates exist."""
        import main
        from unittest.mock import patch

        # Create a real temp dir structure
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write PluginLoader_noconsole.exe under the DECKY_HOME location
            pl_dir = Path(tmpdir) / "services"
            pl_dir.mkdir(parents=True, exist_ok=True)
            pl_exe = pl_dir / "PluginLoader_noconsole.exe"
            pl_exe.touch()

            with patch("main.decky.DECKY_HOME", tmpdir):
                # Path.home() fallback won't exist in this temp env
                result = main.Plugin._resolve_plugin_loader_path()
                assert result == str(pl_exe)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_restart_steam.py::TestResolvePluginLoaderPath -v`
Expected: Both fail with `AttributeError: type object 'Plugin' has no attribute '_resolve_plugin_loader_path'` (or similar)

- [ ] **Step 3: Add `_resolve_plugin_loader_path()` static method and `BAT_TEMPLATE` to `main.py`**

Add the `BAT_TEMPLATE` constant near the top of `main.py`, after the `_DEFAULT_SETTINGS` dict (around line 46):

```python
BAT_TEMPLATE = """@echo off
timeout /t 2 /nobreak >nul
taskkill /F /IM steam.exe >nul 2>&1
taskkill /F /IM PluginLoader.exe >nul 2>&1
taskkill /F /IM PluginLoader_noconsole.exe >nul 2>&1

:wait_exit
timeout /t 1 /nobreak >nul
tasklist /FI "IMAGENAME eq steam.exe" 2>nul | find /I "steam.exe" >nul
if not errorlevel 1 goto :wait_exit
tasklist /FI "IMAGENAME eq PluginLoader.exe" 2>nul | find /I "PluginLoader.exe" >nul
if not errorlevel 1 goto :wait_exit
tasklist /FI "IMAGENAME eq PluginLoader_noconsole.exe" 2>nul | find /I "PluginLoader_noconsole.exe" >nul
if not errorlevel 1 goto :wait_exit

:: Start PluginLoader_noconsole.exe (if path was resolved)
set "PLUGIN_LOADER_PATH=__PLUGIN_LOADER_PATH__"
if "%PLUGIN_LOADER_PATH%"=="" goto :start_steam

start "" "%PLUGIN_LOADER_PATH%"
set COUNT=0
:wait_pl
timeout /t 1 /nobreak >nul
tasklist /FI "IMAGENAME eq PluginLoader_noconsole.exe" 2>nul | find /I "PluginLoader_noconsole.exe" >nul
if not errorlevel 1 goto :start_steam
set /a COUNT+=1
if %COUNT% lss 10 goto :wait_pl

:start_steam
start "" "__STEAM_EXE__"
del "%~f0"
"""
```

Add the `_resolve_plugin_loader_path()` static method to the `Plugin` class, before `_spawn_restart_windows` (around line 360):

```python
@staticmethod
def _resolve_plugin_loader_path() -> str | None:
    """Locate PluginLoader_noconsole.exe dynamically.

    Checks decky.DECKY_HOME first (set by the Decky loader),
    then falls back to ~/homebrew/services/ (standard Windows install).
    Returns None if not found — the restart script will skip PluginLoader launch.
    """
    candidates = [
        Path(decky.DECKY_HOME) / "services" / "PluginLoader_noconsole.exe",
        Path.home() / "homebrew" / "services" / "PluginLoader_noconsole.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_restart_steam.py::TestResolvePluginLoaderPath -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add main.py tests/test_restart_steam.py
git commit -m "feat: add PluginLoader path resolver and BAT_TEMPLATE constant"
```

---

### Task 3: Update `_spawn_restart_windows()` to Use New Template

**Files:**
- Modify: `main.py`
- Test: `tests/test_restart_steam.py`

- [ ] **Step 1: Update existing test + write new test for the no-PluginLoader case**

Replace the existing `test_windows_script_contents` in `tests/test_restart_steam.py`:

```python
@pytest.mark.asyncio
@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only test")
async def test_windows_script_contents(self):
    """Verifies batch script contains PluginLoader launch + wait-loop before Steam."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
            with patch("main.get_steam_path", return_value="C:\\Steam"):
                with patch("main.subprocess.Popen"):
                    with patch("main.sys.platform", "win32"):
                        with patch("main.Plugin._resolve_plugin_loader_path",
                                   return_value="C:\\homebrew\\services\\PluginLoader_noconsole.exe"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            script = Path(tmpdir) / "restart_steam.bat"
                            content = script.read_text()
                            # Kill section
                            assert "taskkill /F /IM steam.exe" in content
                            assert "taskkill /F /IM PluginLoader.exe" in content
                            assert "taskkill /F /IM PluginLoader_noconsole.exe" in content
                            # PluginLoader launch section
                            assert "PluginLoader_noconsole.exe" in content
                            assert "start \"\" \"C:\\homebrew\\services\\PluginLoader_noconsole.exe\"" in content
                            assert ":wait_pl" in content
                            assert "if %COUNT% lss 10 goto :wait_pl" in content
                            # Steam launch
                            assert "start \"\" \"C:\\Steam\\steam.exe\"" in content
                            assert "del \"%~f0\"" in content
```

Add new test for the no-PluginLoader case, inside `TestRestartSteam`:

```python
@pytest.mark.asyncio
@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only test")
async def test_windows_script_skips_plugin_loader_when_not_found(self):
    """Verifies script skips PluginLoader when path resolver returns None."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
            with patch("main.get_steam_path", return_value="C:\\Steam"):
                with patch("main.subprocess.Popen"):
                    with patch("main.sys.platform", "win32"):
                        with patch("main.Plugin._resolve_plugin_loader_path",
                                   return_value=None):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            script = Path(tmpdir) / "restart_steam.bat"
                            content = script.read_text()
                            # Should NOT contain PluginLoader launch section
                            assert 'start "" "%PLUGIN_LOADER_PATH%"' not in content, \
                                "Should not attempt to launch PluginLoader when path is None"
                            # Only the kill section should mention PluginLoader_noconsole.exe
                            # Should still launch Steam
                            assert "start \"\" \"C:\\Steam\\steam.exe\"" in content
```

- [ ] **Step 2: Run tests to verify the updated test fails with old implementation**

Run: `pytest tests/test_restart_steam.py -v`
Expected: `test_windows_script_contents` fails (old inline script doesn't match new template), `test_windows_script_skips_plugin_loader_when_not_found` might fail depending on state

- [ ] **Step 3: Update `_spawn_restart_windows()` in `main.py`**

Replace the current `_spawn_restart_windows` (lines 360-389) with:

```python
@staticmethod
def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None:
    """Write and spawn batch restart script that kills Steam and PluginLoader (Windows).

    Injects the resolved PluginLoader_noconsole.exe path into the template.
    If PluginLoader cannot be found, the script skips launching it and
    proceeds directly to starting Steam.
    """
    steam_exe = str(Path(steam_path) / "steam.exe")
    pl_path = Plugin._resolve_plugin_loader_path()
    script_path = settings_dir / "restart_steam.bat"
    script = (
        BAT_TEMPLATE.replace("__PLUGIN_LOADER_PATH__", pl_path or "")
        .replace("__STEAM_EXE__", steam_exe)
    )
    script_path.write_text(script, encoding="utf-8")
    subprocess.Popen(
        ["cmd.exe", "/c", str(script_path)],
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_restart_steam.py -v`
Expected: All 9 tests in `TestRestartSteam` + 2 in `TestRestartSteamCleanup` + 2 in `TestResolvePluginLoaderPath` pass

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `pytest -v`
Expected: All tests pass (37+)

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_restart_steam.py
git commit -m "feat: update _spawn_restart_windows to launch PluginLoader before Steam"
```

---

### Task 4: Update OpenSpec Backend Spec

**Files:**
- Modify: `openspec/specs/backend.md`

- [ ] **Step 1: Update the Plugin class documentation in backend.md**

In the `# Steam restart` comment (line 42), update it to:

```markdown
    # Steam restart (kills Steam + PluginLoader + PluginLoader_noconsole,
    #                  then launches PluginLoader_noconsole before Steam)
```

Add `_resolve_plugin_loader_path` to the private methods section (after `_spawn_restart_linux`, around line 49):

```markdown
    @staticmethod
    def _resolve_plugin_loader_path() -> str | None
```

Update the `restart_steam` row in the IPC table (line 78):

```markdown
| `restart_steam` | — | `dict` | Returns `{"success": bool, "error?": str}`; kills Steam + PluginLoader + PluginLoader_noconsole, then starts PluginLoader_noconsole (if found), waits for it to start (max 10s), then restarts Steam |
```

- [ ] **Step 2: Verify the spec renders correctly**

Open `openspec/specs/backend.md` and read it visually — no missing brackets, no broken markdown.

- [ ] **Step 3: Commit**

```bash
git add openspec/specs/backend.md
git commit -m "docs: update backend spec for PluginLoader launch order"
```

---

### Task 5 (Post-Release Fix): Use `getattr` for `decky.DECKY_HOME` (Windows Safety)

**Files:**
- Modify: `main.py`
- Test: `tests/test_restart_steam.py`
- Docs: `openspec/specs/backend.md`
- Docs: `docs/superpowers/specs/2026-06-07-restart-steam-pluginloader-design.md`

**Why:** `decky.DECKY_HOME` is not reliably set on Windows Decky Loader installations. Direct attribute access raises `AttributeError` before the `Path.home()` fallback is reached, causing `_resolve_plugin_loader_path()` to crash and preventing the batch script from being written at all. The fix uses `getattr` for safe access.

- [ ] **Step 1: Safe-access DECKY_HOME with getattr**

  In `main.py`, replace `_resolve_plugin_loader_path()`:

  ```python
  @staticmethod
  def _resolve_plugin_loader_path() -> str | None:
      """Locate PluginLoader_noconsole.exe dynamically.

      Uses getattr to safely check decky.DECKY_HOME (may not be set on Windows),
      then falls back to ~/homebrew/services/ (standard Windows install).
      Returns None if not found — the restart script will skip PluginLoader launch.
      """
      candidates = []
      decky_home = getattr(decky, "DECKY_HOME", None)
      if decky_home:
          candidates.append(
              Path(decky_home) / "services" / "PluginLoader_noconsole.exe"
          )
      candidates.append(
          Path.home() / "homebrew" / "services" / "PluginLoader_noconsole.exe"
      )
      for candidate in candidates:
          if candidate.exists():
              return str(candidate)
      return None
  ```

- [ ] **Step 2: Add test for missing DECKY_HOME**

  In `tests/test_restart_steam.py`, add to `TestResolvePluginLoaderPath`:

  ```python
  def test_uses_homebrew_fallback_when_decky_home_missing(self):
      """Uses Path.home() fallback when decky.DECKY_HOME attribute is missing."""
      import main
      from unittest.mock import patch

      import tempfile
      with tempfile.TemporaryDirectory() as tmpdir:
          # Create PluginLoader under ~/homebrew/services/
          with patch("main.Path.home") as mock_home:
              mock_home.return_value = Path(tmpdir)
              pl_dir = Path(tmpdir) / "homebrew" / "services"
              pl_dir.mkdir(parents=True, exist_ok=True)
              pl_exe = pl_dir / "PluginLoader_noconsole.exe"
              pl_exe.touch()

              # Remove DECKY_HOME from the decky mock
              with patch("main.decky") as mock_decky:
                  del mock_decky.DECKY_HOME  # Simulate missing attribute
                  result = main.Plugin._resolve_plugin_loader_path()
                  assert result == str(pl_exe)
  ```

- [ ] **Step 3: Run tests to verify**

  Run: `pytest tests/test_restart_steam.py::TestResolvePluginLoaderPath -v`
  Expected: All 3 tests pass (existing 2 + new 1)

- [ ] **Step 4: Run full test suite to check for regressions**

  Run: `pytest -v`
  Expected: All tests pass

- [ ] **Step 5: Commit**

  ```bash
  git add main.py tests/test_restart_steam.py
  git commit -m "fix(restart): safe-access decky.DECKY_HOME with getattr for Windows compat"
  ```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pytest -v`
Expected: All tests pass (no regressions)

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Produces valid `dist/index.js` (no TypeScript errors — frontend was not touched)

- [ ] **Step 3: Check git status**

Run: `git status`
Expected: Only the 4 intended files modified — no stray changes

- [ ] **Step 4: Review the diff**

Run: `git diff main.py`
Expected: Clean diff — added `BAT_TEMPLATE`, `_resolve_plugin_loader_path()`, updated `_spawn_restart_windows()`. No unrelated changes.
