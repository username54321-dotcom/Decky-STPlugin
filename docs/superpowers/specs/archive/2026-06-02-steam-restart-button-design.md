# Steam Restart Button — Design Spec

**Date:** 2026-06-02
**Status:** Approved
**Scope:** Add a "Restart Steam" button (main menu + post-download prompt) to the STPlugin Decky plugin.

## Motivation

After downloading/installing Lua scripts, Steam must be restarted for them to be picked up cleanly. Currently the user must manually exit and relaunch Steam. A one-click restart button removes this friction.

## Architecture

```
User clicks "Restart Steam" (Main menu or post-download prompt)
        │
        ▼
  Inline confirmation ("Are you sure?")
        │
        ▼ (confirmed)
  Frontend calls restart_steam() IPC ──► Python backend
        │                                    │
        │                          Detects platform (Windows/Linux)
        │                          Writes temp script to plugin dir
        │                          Spawns detached process (fire & forget)
        │                          Returns immediately
        │                                    │
        ▼                                    ▼ (fully detached, survives Steam death)
  Toast: "Steam is restarting..."    [sleep 3s → kill Steam → sleep 2s → start Steam → exit]
        │
        ▼
  Steam + Decky + plugin all die ──► Steam restarts fresh, Lua loaded
```

## Components

### 1. Python backend: `restart_steam()` callable (in `main.py`)

Adds one new `@callable` async method to the Plugin class.

#### Signature
```python
async def restart_steam(self) -> dict:
    # Returns {"success": True} or {"success": False, "error": "..."}
```

#### Flow
1. Call `get_steam_path()` — if empty, return `{"success": False, "error": "Steam path not detected"}`
2. Detect platform (`sys.platform`)
3. Write temp script to `decky.DECKY_PLUGIN_SETTINGS_DIR`
4. Spawn script as fully detached process
5. Return `{"success": True}`

#### Platform scripts

**Windows** (`restart_steam.ps1`) — Steam path is embedded directly by Python during generation, not passed as CLI arg:
```powershell
$steamPath = "C:\Program Files (x86)\Steam\steam.exe"  # written by Python
taskkill /F /IM steam.exe 2>$null
Start-Sleep -Seconds 3
while (Get-Process steam -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 1 }
Start-Process -FilePath $steamPath
# Script exits immediately after launching Steam
```

**Linux** (`restart_steam.sh`):
```bash
#!/bin/bash
sleep 3
pkill -9 steam 2>/dev/null
sleep 2
steam &
# Script exits immediately after launching Steam
```

#### Spawning (detached)

**Windows:**
```python
subprocess.Popen(
    ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
    creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW,
)
```

**Linux:**
```python
subprocess.Popen(
    ["bash", str(script_path)],
    start_new_session=True,
)
```

#### Cleanup

`_main()` removes any leftover `restart_steam.*` files from the plugin directory on load to clean up after any prior crash/abort.

### 2. Frontend: Main menu button (in `src/index.tsx`)

Added to the existing `MainPanel` component:

- Placed below the existing three navigation buttons, with a separator
- Label: "Restart Steam"
- Red-tinted to signal it's a destructive action

#### Confirmation state (inline, no modal)

```
Initial:     [Restart Steam]
Click →      [Are you sure?]  [Cancel] [Yes, restart]
Cancel →     [Restart Steam]  (reverts)
Yes →        [Restarting...]  (disabled)
```

State managed with a simple `useState<"idle" | "confirming" | "restarting">("idle")`.

#### Disabled during download

If a download is in progress (determined via parent/context state), the button is disabled with tooltip: "Finish or cancel download first".

### 3. Frontend: Post-download prompt (in `DownloadPanel.tsx`)

After a download reaches the `done` phase (`download_progress` event with `phase === "done"`):

- Show an inline prompt below the download area: a success message + a `[Restart Steam to apply]` button
- Clicking enters an inline confirmation: `[Are you sure?] [Cancel] [Yes, restart]` (same pattern as the main menu button)
- On confirm: calls `restart_steam()`, shows "Restarting..." toast
- Prompt disappears if a new download is started

### 4. IPC binding

```typescript
const restartSteam = callable<[], { success: boolean; error?: string }>("restart_steam");
```

### 5. Toast

After confirmed restart: `toaster.toast("Steam is restarting...")`

On error: `toaster.toast("Failed to restart Steam: <error>", {type: "error"})`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Steam path not found | Return error dict, frontend shows error toast, button resets to idle |
| Script spawn fails | Caught exception in Python — return error, error toast |
| Download in progress | Button disabled with tooltip |
| Double-click | Confirmation state prevents re-trigger |
| Steam already not running | Force-kill fails silently, then starts Steam — net result: Steam launches |
| Stale temp script | `_main()` cleans up on plugin load |

## Files Changed

| File | Change |
|------|--------|
| `main.py` | Add `restart_steam()` callable (~40 lines) + cleanup in `_main()` |
| `src/index.tsx` | Add restart button + confirmation state to `MainPanel` (~30 lines) |
| `src/components/DownloadPanel.tsx` | Add post-download restart prompt (~20 lines) |

## Testing

All tests mock `subprocess.Popen` — never actually kill Steam.

| Test | Coverage |
|------|----------|
| `test_restart_steam_returns_success` | Happy path: script written, process spawned, returns success |
| `test_restart_steam_no_steam_path` | Returns error when `get_steam_path()` fails |
| `test_restart_steam_spawn_failure` | Handles `subprocess.Popen` exception gracefully |
| `test_restart_steam_windows_script_contents` | Verifies correct PowerShell content (skips on Linux) |
| `test_restart_steam_linux_script_contents` | Verifies correct bash content (skips on Windows) |
| `test_restart_steam_cleanup_on_load` | Stale scripts removed on `_main()` |
| `test_restart_steam_detachment_windows` | Verifies `DETACHED_PROCESS | CREATE_NO_WINDOW` flags (skips on Linux) |
| `test_restart_steam_detachment_linux` | Verifies `start_new_session=True` (skips on Windows) |

## Exclusions

- No in-plugin update check (already deferred)
- No non-English locales (already deferred)
- No additional settings beyond what exists
- No integration with Steam's built-in restart mechanism (force-kill approach is chosen for Lua cache clearing)
