# Restart Steam: PluginLoader-Noconsole Launch Order

**Date:** 2026-06-07
**Status:** Draft
**Feature:** Modify the Steam restart script to start `PluginLoader_noconsole.exe` before Steam, with a verified-start wait loop.

---

## 1. Problem

The current restart script kills all three processes (`steam.exe`, `PluginLoader.exe`, `PluginLoader_noconsole.exe`), waits for them to exit, then launches only Steam. On Windows, `PluginLoader_noconsole.exe` must be running before Steam starts so Decky's plugin system is ready when Steam loads.

## 2. Solution Overview

**Approach: All-in-one batch script** — Python resolves the PluginLoader path dynamically, injects it into a single `.bat` script, and detaches it. The script orchestrates the full sequence:

```
kill all → wait for exit → start PluginLoader → wait-loop (tasklist, max 10s) → start Steam → self-delete
```

A single script survives the PluginLoader process kill (since the Python runtime dies with it). This is the only viable approach given that constraint.

## 3. PluginLoader Path Resolution

```python
@staticmethod
def _resolve_plugin_loader_path() -> str | None:
    """Locate PluginLoader_noconsole.exe. Returns path or None."""
    candidates = [
        Path(decky.DECKY_HOME) / "services" / "PluginLoader_noconsole.exe",
        Path.home() / "homebrew" / "services" / "PluginLoader_noconsole.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None
```

- **Preference order:**
  1. `decky.DECKY_HOME / "services" / "PluginLoader_noconsole.exe"` — set by Decky loader, standard location
  2. `Path.home() / "homebrew" / "services" / "PluginLoader_noconsole.exe"` — standard Windows install fallback
- If neither found, returns `None` → script skips PluginLoader launch entirely (graceful degradation, Steam starts without it)

## 4. Batch Script Template

A module-level constant `BAT_TEMPLATE` for testability:

```batch
@echo off
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
```

### Placeholder injection

```python
script = (BAT_TEMPLATE
    .replace("__PLUGIN_LOADER_PATH__", pl_path or "")
    .replace("__STEAM_EXE__", steam_exe))
```

## 5. Python Changes (`main.py`)

| Component | Change |
|-----------|--------|
| `_spawn_restart_windows()` | Add `_resolve_plugin_loader_path()` call; inject `__PLUGIN_LOADER_PATH__` into template |
| `_resolve_plugin_loader_path()` | **New** static method (as shown above) |
| `BAT_TEMPLATE` | **New** module-level constant for the batch script |
| `_spawn_restart_linux()` | **Unchanged** |
| `restart_steam()` | **Unchanged** |
| Frontend / IPC | **Unchanged** — no new methods, no new UI |

### Updated `_spawn_restart_windows`

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

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| PluginLoader not found | `__PLUGIN_LOADER_PATH__` is empty → `if "%PLUGIN_LOADER_PATH%"=="" goto :start_steam` skips PluginLoader entirely |
| PluginLoader fails to start | 10-second wait-loop times out → script starts Steam anyway. Plugins may not load until next manual restart. |
| All processes already killed | Kill commands silently fail (`>nul 2>&1`), wait-exit loop exits immediately |
| Script file can't be written | Python `OSError` caught in `restart_steam()`, returns `{"success": false, "error": "..."}` |
| `decky.DECKY_HOME` not set | Falls through to `Path.home()` fallback |

## 7. Testing Plan

### Updated tests (`tests/test_restart_steam.py`)

| Test | Status | What it checks |
|------|--------|---------------|
| `test_windows_script_contents` | Modified | Verify batch script contains: PluginLoader start, wait-loop, `tasklist` check for PL, `start` for both PL and Steam |
| `test_windows_script_skips_plugin_loader_when_not_found` | **New** | When `_resolve_plugin_loader_path()` returns `None`, script should skip PluginLoader section |
| `test_windows_script_path_detection` | **New** | `_resolve_plugin_loader_path()` checks `DECKY_HOME` first, then `Path.home()` |
| `test_returns_success` | Unchanged | Happy path |
| `test_no_steam_path` | Unchanged | No Steam path |
| `test_no_steam_path_none` | Unchanged | `None` Steam path |
| `test_spawn_failure` | Unchanged | `subprocess.Popen` failure |
| `test_detachment_windows` | Unchanged | `CREATE_NEW_PROCESS_GROUP \| CREATE_NO_WINDOW` flags |
| All Linux tests | Unchanged | No Linux changes |

### Updated test mock (`conftest.py`)

Add `mock_decky.DECKY_HOME = "/home/deck/homebrew"` so `_resolve_plugin_loader_path()` works in tests.

### Build verification

- `pnpm build` must produce a valid `dist/index.js`
- `pytest` must pass all 37+ tests (existing + new)

## 8. Files Changed

| File | Change |
|------|--------|
| `main.py` | Add `BAT_TEMPLATE` constant, new `_resolve_plugin_loader_path()`, update `_spawn_restart_windows()` |
| `tests/conftest.py` | Add `DECKY_HOME` mock attribute |
| `tests/test_restart_steam.py` | Update `test_windows_script_contents`, add 2 new tests |
| `openspec/specs/backend.md` | Update `restart_steam` & `_spawn_restart_windows` docs to reflect new PluginLoader launch order |

## 9. Non-Goals

- No Linux changes (Linux Decky pipeline is different)
- No frontend changes (no new UI, no new IPC methods)
- No new settings
- No changes to the auto-update or download flows
