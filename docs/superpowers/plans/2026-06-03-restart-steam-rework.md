# Restart Steam Feature — Bulletproof Rework

**Date:** 2026-06-03  
**Status:** Ready to implement  
**Files to modify:** `main.py`, `tests/test_restart_steam.py`

## Problem

The current `.ps1` (PowerShell) script approach fails silently on Windows:
- `DETACHED_PROCESS` — PowerShell can't initialize, script doesn't run
- `CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW` — script still doesn't execute

PowerShell scripts have multiple failure modes when launched as detached background processes on Windows: execution policies, console initialization, handle inheritance, and environment differences.

## Solution: Use `.bat` files instead of `.ps1`

Batch files are the simplest, most reliable option for background process spawning on Windows:
- No execution policy issues (`.bat` files always run)
- `cmd.exe` is always available — no PowerShell dependency
- `start ""` command creates truly independent processes
- `tasklist` + `find` for reliable process detection
- Self-deleting scripts for cleanup

## Implementation

### Step 1: Rewrite `_spawn_restart_windows` in `main.py`

Replace the current PowerShell approach with a `.bat` file:

```python
@staticmethod
def _spawn_restart_windows(steam_path: str, settings_dir: Path) -> None:
    """Write and spawn batch restart script (Windows)."""
    steam_exe = str(Path(steam_path) / "steam.exe")
    script_path = settings_dir / "restart_steam.bat"
    script_path.write_text(
        '@echo off\r\n'
        'timeout /t 2 /nobreak >nul\r\n'
        'taskkill /F /IM steam.exe >nul 2>&1\r\n'
        ':waitloop\r\n'
        'timeout /t 1 /nobreak >nul\r\n'
        'tasklist /FI "IMAGENAME eq steam.exe" 2>nul | find /I "steam.exe" >nul\r\n'
        'if not errorlevel 1 goto waitloop\r\n'
        f'start "" "{steam_exe}"\r\n'
        'del "%~f0"\r\n',
        encoding="utf-8",
    )
    subprocess.Popen(
        ["cmd.exe", "/c", str(script_path)],
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
```

**Key changes:**
1. `.bat` file instead of `.ps1` — no execution policy, always works
2. `cmd.exe /c` instead of `powershell -File` — simpler, more reliable
3. `start ""` launches Steam as a truly independent process
4. `tasklist + find` loop waits for Steam to fully exit before restarting
5. `del "%~f0"` self-deletes the script after completion
6. `\r\n` line endings — required for `.bat` files on Windows
7. Initial `timeout /t 2` gives the Python method time to return the IPC response

### Step 2: Update `_main` cleanup in `main.py`

The cleanup method checks for leftover scripts. Update to include `.bat`:

```python
# In _main() method, update the glob pattern:
for pattern in ["restart_steam.ps1", "restart_steam.sh", "restart_steam.bat"]:
```

### Step 3: Update tests in `tests/test_restart_steam.py`

1. Update `test_windows_script_contents` — check for `.bat` content instead of `.ps1`
2. Update `test_detachment_windows` — verify `cmd.exe /c` and correct flags
3. Update `test_cleanup_removes_stale_scripts` — include `.bat` in cleanup test

## Why this is bulletproof

| Issue | `.ps1` (old) | `.bat` (new) |
|-------|-------------|-------------|
| Execution policy | Can block script | No policy for `.bat` |
| Console init | Fails with `CREATE_NO_WINDOW` | `cmd.exe` handles it |
| Process independence | Unreliable | `start ""` creates independent process |
| Wait for exit | PowerShell loop | `tasklist + find` loop |
| Cleanup | Manual | Self-deleting script |
| Dependencies | Requires PowerShell | Only `cmd.exe` (always present) |

## Verification

After implementing:
1. `python -m pytest tests/ -v` — all tests pass
2. `pnpm run build` — frontend compiles
3. Manual test: click "Restart Steam" → Steam kills → waits → Steam restarts
