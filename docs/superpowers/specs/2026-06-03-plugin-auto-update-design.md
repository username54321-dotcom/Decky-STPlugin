# Plugin Auto-Update System Design

**Date:** 2026-06-03  
**Status:** Draft  
**Scope:** GitHub Releases + In-Plugin Update Checking

## Overview

Implement an auto-update system for the Decky-STPlugin that checks GitHub Releases for new versions and installs them automatically. Users without access to the Steam Decky Plugin Store can receive updates directly from GitHub.

**Goals:**
- Automatic background checking every 2 hours
- Manual "Check for Updates" button in Settings
- Auto-install with restart prompt
- GitHub Releases as the single source of truth
- CI/CD via GitHub Actions for automated releases

**Non-Goals:**
- Rollback mechanism (YAGNI)
- Delta updates (full ZIP replacement)
- Multiple release channels (stable/beta)
- Release notes display (link to GitHub release page instead)

---

## Architecture Overview

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `backend/auto_update.py` | Python module | GitHub API checking, version comparison, ZIP download/extraction |
| `update.json` | Config file | GitHub repo owner, repo name, asset name pattern |
| `main.py` | Plugin class | Exposes `check_for_updates()` and `install_update()` RPC methods, starts background thread |
| `src/SettingsPanel.tsx` | Frontend | "Check for Updates" button, current version display, update status |
| `src/index.tsx` | Frontend | Update notification banner when update available |
| `.github/workflows/release.yml` | CI/CD | Build and publish releases on tag push |

### Data Flow

```
1. Background thread (every 2h) OR manual button click
   → calls check_for_updates()

2. check_for_updates()
   → GET https://api.github.com/repos/{owner}/{repo}/releases/latest
   → Compare version from tag (v0.2.0) vs package.json version (0.1.0)
   → If newer: emit "update_available" event with version + release URL

3. Frontend receives "update_available" event
   → Shows notification banner (index.tsx) with "Update Available" + link
   → Settings panel shows "Update to vX.Y.Z" button

4. User clicks "Install Update" (or auto-install on next load)
   → calls install_update()
   → Downloads ZIP from release asset URL
   → Extracts to plugin directory (overwriting existing files)
   → Emits "update_installed" event
   → Shows restart prompt (uses existing RestartButton component)

5. Plugin restarts → new version loads
```

### Key Design Decisions

- **No fallback queue** (simplified approach) — if extraction fails, user retries manually
- **httpx** for async HTTP (already used in the project for Steam API calls)
- **Version comparison** via simple tuple parsing (port from Millennium's `parse_version()`)
- **Restart prompt** reuses existing `RestartButton` component
- **Settings preserved** — `decky.DECKY_PLUGIN_SETTINGS_DIR` not overwritten during update

---

## Backend Update Checker (`backend/auto_update.py`)

### UpdateInfo Dataclass

```python
@dataclass
class UpdateInfo:
    available: bool
    current_version: str        # "0.1.0"
    latest_version: str | None  # "0.2.0"
    release_url: str | None     # "https://github.com/.../releases/tag/v0.2.0"
    asset_url: str | None       # Direct download URL for ZIP asset
    checked_at: float | None    # timestamp of last check
```

### Key Functions

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `parse_version(version_str)` | `"0.2.0"` | `(0, 2, 0)` | Parse version string to comparable tuple |
| `check_for_update()` | — | `UpdateInfo \| None` | Fetch latest release, compare versions |
| `get_update_info()` | — | `UpdateInfo` | Get current update status (cached) |

### Version Comparison Logic

```python
def parse_version(version_str: str) -> tuple[int, ...]:
    """Parse '0.2.0' → (0, 2, 0). Strips 'v' prefix if present."""
    clean = version_str.lstrip('v')
    return tuple(int(x) for x in clean.split('.'))

def is_newer(latest: str, current: str) -> bool:
    """Return True if latest > current."""
    return parse_version(latest) > parse_version(current)
```

### GitHub API Call

```python
async def fetch_latest_release() -> dict:
    """GET https://api.github.com/repos/{owner}/{repo}/releases/latest"""
    # Uses httpx with 10s timeout
    # Returns JSON response or raises on HTTP error
```

### Background Thread

- Runs in `_main()` after plugin loads
- Uses `asyncio.create_task()` with `await asyncio.sleep(7200)` loop
- Calls `check_for_update()` every 2 hours
- Emits `update_available` event via `decky.emit()` when found
- Logs check results via `decky.logger`

### Manual Check

- `check_for_updates()` exposed as RPC method
- Returns `UpdateInfo` directly to frontend
- Also emits event for UI consistency

---

## Backend Update Installer

### Key Functions

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `install_update(asset_url)` | URL | `bool` | Download ZIP, extract, return success |
| `download_update(asset_url)` | URL | `Path` | Download ZIP to temp file, return path |
| `extract_update(zip_path)` | Path | `bool` | Extract ZIP to plugin dir, return success |

### Install Flow

```python
async def install_update(asset_url: str) -> bool:
    """Download and install update. Returns True on success."""
    # 1. Download ZIP to temp file
    zip_path = await download_update(asset_url)
    
    # 2. Extract to plugin directory
    success = extract_update(zip_path)
    
    # 3. Clean up temp file
    zip_path.unlink(missing_ok=True)
    
    # 4. Emit event if successful
    if success:
        decky.emit("update_installed", {})
    
    return success
```

### Safety Considerations

- **Preserve settings:** Don't overwrite `decky.DECKY_PLUGIN_SETTINGS_DIR`
- **Atomic extraction:** Extract to temp dir first, then move (prevents partial updates)
- **Error handling:** Catch ZIP errors, permission errors, disk full
- **Cleanup:** Always delete temp ZIP file after attempt

### Plugin Directory Structure After Update

```
~/homebrew/plugins/STPlugin/
├── main.py              ← Updated
├── plugin.json          ← Updated
├── package.json         ← Updated (version bump)
├── backend/
│   └── auto_update.py   ← Updated
├── dist/
│   └── index.js         ← Updated (frontend bundle)
└── settings/            ← Preserved (not overwritten)
```

---

## Frontend Update UI

### Settings Panel (`src/SettingsPanel.tsx`)

**New Section: "Plugin Updates"**

| Element | Type | Behavior |
|---------|------|----------|
| Current Version | Text | Display `plugin.version` from package.json |
| Last Checked | Text | Show timestamp of last check (human-readable) |
| Check for Updates | Button | Calls `check_for_updates()` RPC |
| Update Available | Button | Shows "Update to vX.Y.Z" when update found |
| Install Update | Button | Calls `install_update()` RPC, shows progress |
| Release Link | Link | Opens GitHub release page in browser |

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Plugin Updates                      │
│                                     │
│ Current Version: 0.1.0              │
│ Last Checked: 2 minutes ago         │
│                                     │
│ [Check for Updates]                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Update Available: v0.2.0       │ │
│ │ [View Release] [Install Now]   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Main View (`src/index.tsx`)

**Update Notification Banner**

| Element | Type | Behavior |
|---------|------|----------|
| Update Banner | Card/Box | Appears when update available |
| Version Text | Text | "Update available: v0.2.0" |
| View Release | Link | Opens GitHub release page |
| Install Button | Button | Calls `install_update()` RPC |
| Dismiss | Button | Hides banner until next check |

**UI Layout:**
```
┌─────────────────────────────────────┐
│ 🔄 Update Available: v0.2.0        │
│ [View Release] [Install] [Dismiss] │
└─────────────────────────────────────┘
```

### Frontend State Management

**New Hook: `useUpdateStatus`**

```typescript
interface UpdateStatus {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  checkedAt: number | null;
  installing: boolean;
}

function useUpdateStatus(): UpdateStatus {
  // Listens for "update_available" and "update_installed" events
  // Returns current update status
  // Provides install_update() function
}
```

**Event Listeners:**
```typescript
useEffect(() => {
  const handleUpdateAvailable = (info: UpdateInfo) => {
    setUpdateStatus(prev => ({ ...prev, ...info, available: true }));
  };
  
  const handleUpdateInstalled = () => {
    setUpdateStatus(prev => ({ ...prev, available: false, installing: false }));
  };
  
  window.addEventListener('update_available', handleUpdateAvailable);
  window.addEventListener('update_installed', handleUpdateInstalled);
  
  return () => {
    window.removeEventListener('update_available', handleUpdateAvailable);
    window.removeEventListener('update_installed', handleUpdateInstalled);
  };
}, []);
```

---

## CI/CD Pipeline (GitHub Actions)

### Workflow: `.github/workflows/release.yml`

**Trigger:**
```yaml
on:
  push:
    tags:
      - 'v*'  # e.g., v0.2.0, v1.0.0
```

**Jobs:**

| Job | Steps | Purpose |
|-----|-------|---------|
| `build` | Install deps, build frontend, package ZIP | Create release artifact |
| `release` | Create GitHub release, upload ZIP | Publish to GitHub |

**Build Steps:**
```yaml
steps:
  - uses: actions/checkout@v4
  
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
  
  - uses: pnpm/action-setup@v4
    with:
      version: 9
  
  - run: pnpm install
  
  - run: pnpm run build
  
  - name: Create plugin ZIP
    run: |
      mkdir -p dist
      cp main.py plugin.json package.json dist/
      cp -r backend dist/
      cp -r dist dist/
      cd dist && zip -r ../STPlugin-${{ github.ref_name }}.zip .
```

**Release Steps:**
```yaml
  - name: Create GitHub Release
    uses: softprops/action-gh-release@v2
    with:
      files: STPlugin-${{ github.ref_name }}.zip
      generate_release_notes: true
      draft: false
      prerelease: false
```

### Release Artifact Structure

**ZIP Contents:**
```
STPlugin-v0.2.0.zip
├── main.py
├── plugin.json
├── package.json
├── backend/
│   ├── auto_update.py
│   ├── downloads.py
│   ├── api_manifest.py
│   └── steam_paths.py
└── dist/
    └── index.js
```

### Release Automation

**Single command to bump version, commit, tag, and push:**

```bash
pnpm release:patch   # 0.1.0 → 0.1.1
pnpm release:minor   # 0.1.0 → 0.2.0
pnpm release:major   # 0.1.0 → 1.0.0
```

**Implementation in `package.json` scripts:**
```json
{
  "scripts": {
    "release:patch": "npm version patch && git push && git push --tags",
    "release:minor": "npm version minor && git push && git push --tags",
    "release:major": "npm version major && git push && git push --tags"
  }
}
```

**What `npm version` does automatically:**
1. Updates `package.json` version
2. Creates git commit: `"v0.2.0"`
3. Creates git tag: `v0.2.0`

**Then the script:**
4. Pushes commit to origin
5. Pushes tags to origin
6. GitHub Actions triggers on tag push

---

## Error Handling

### Backend Error Scenarios

| Scenario | Handling | User Feedback |
|----------|----------|---------------|
| **Network timeout** | Retry once after 5s, then fail | "Network error. Check your connection." |
| **GitHub API rate limit** | Log warning, skip check | Silent (retry next interval) |
| **Invalid response** | Log error, skip check | Silent (retry next interval) |
| **ZIP download fails** | Retry once, then fail | "Download failed. Try again later." |
| **ZIP extraction fails** | Log error, clean up temp file | "Installation failed. Try manual install." |
| **Permission denied** | Log error, suggest manual install | "Permission error. Check plugin directory." |
| **Disk full** | Log error, clean up | "Disk full. Free space and try again." |

### Backend Error Handling Pattern

```python
async def check_for_update() -> UpdateInfo | None:
    try:
        release = await fetch_latest_release()
        # ... process release
    except httpx.TimeoutException:
        decky.logger.warning("Update check timed out")
        return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:  # Rate limited
            decky.logger.warning("GitHub API rate limited")
            return None
        decky.logger.error(f"GitHub API error: {e}")
        return None
    except Exception as e:
        decky.logger.error(f"Update check failed: {e}")
        return None

async def install_update(asset_url: str) -> bool:
    zip_path = None
    try:
        zip_path = await download_update(asset_url)
        success = extract_update(zip_path)
        return success
    except Exception as e:
        decky.logger.error(f"Update installation failed: {e}")
        return False
    finally:
        if zip_path:
            zip_path.unlink(missing_ok=True)
```

### Frontend Error Scenarios

| Scenario | Handling | UI Feedback |
|----------|----------|-------------|
| **Check fails** | Show error message, allow retry | "Failed to check for updates. [Retry]" |
| **Install fails** | Show error, suggest manual install | "Installation failed. [Download Manually]" |
| **No internet** | Show offline indicator | "Offline. Updates unavailable." |
| **Already up to date** | Show success message | "You're up to date!" |

### Logging Strategy

| Level | When | Example |
|-------|------|---------|
| `INFO` | Successful check, update found, install success | "Update available: v0.2.0" |
| `WARNING` | Network timeout, rate limit, retry | "Update check timed out, retrying..." |
| `ERROR` | Failed check, failed install, unexpected error | "Update installation failed: Permission denied" |

---

## Testing Strategy

### Backend Tests

**Unit Tests:**

| Test | Input | Expected Output |
|------|-------|-----------------|
| `parse_version("0.2.0")` | `"0.2.0"` | `(0, 2, 0)` |
| `parse_version("v1.0.0")` | `"v1.0.0"` | `(1, 0, 0)` |
| `is_newer("0.2.0", "0.1.0")` | Both strings | `True` |
| `is_newer("0.1.0", "0.1.0")` | Both strings | `False` |
| `is_newer("0.1.0", "0.2.0")` | Both strings | `False` |

**Integration Tests (Mocked):**

| Test | Mock | Expected Behavior |
|------|------|-------------------|
| `check_for_update()` with new release | GitHub API returns `v0.2.0` | Returns `UpdateInfo(available=True)` |
| `check_for_update()` with current version | GitHub API returns `v0.1.0` | Returns `UpdateInfo(available=False)` |
| `check_for_update()` with network error | httpx raises `TimeoutException` | Returns `None`, logs warning |
| `install_update()` success | ZIP downloads and extracts | Returns `True`, emits event |
| `install_update()` extraction fails | ZIP is corrupt | Returns `False`, logs error |

**Test File:** `backend/test_auto_update.py`

### Frontend Tests

**Component Tests:**

| Test | Setup | Expected Behavior |
|------|-------|-------------------|
| Update banner appears | Mock `update_available` event | Banner renders with version |
| Update banner dismiss | Click dismiss button | Banner hides |
| Check for updates button | Mock RPC success | Shows "Up to date" message |
| Check for updates fails | Mock RPC error | Shows error message |
| Install button click | Mock RPC success | Shows loading, then success |

**Test File:** `src/__tests__/UpdateUI.test.tsx`

### End-to-End Testing (Manual)

**Test Scenarios:**

1. **First install (no updates)**
   - Install plugin
   - Verify version displays correctly
   - Click "Check for Updates"
   - Verify "Up to date" message

2. **Update available**
   - Create test release on GitHub
   - Wait for background check (or trigger manually)
   - Verify banner appears
   - Click "Install"
   - Verify restart prompt

3. **Update installation**
   - Click "Install Now"
   - Verify download progress
   - Verify extraction success
   - Verify restart prompt appears

4. **Error handling**
   - Disconnect network
   - Click "Check for Updates"
   - Verify error message
   - Reconnect and retry

### Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| `parse_version()` | 100% |
| `is_newer()` | 100% |
| `check_for_update()` | 80% (mocked network) |
| `install_update()` | 70% (mocked filesystem) |
| Frontend components | 60% (key interactions) |

---

## Implementation Order

1. **Backend `auto_update.py`** — Core update checking and installation logic
2. **`main.py` integration** — RPC methods and background thread
3. **Frontend `useUpdateStatus` hook** — State management and event listeners
4. **Settings Panel UI** — Update section with buttons and status
5. **Main View UI** — Update notification banner
6. **CI/CD workflow** — GitHub Actions release pipeline
7. **Release scripts** — pnpm scripts for version bumping
8. **Testing** — Unit and integration tests
9. **Documentation** — README with install and update instructions

---

## Open Questions

- **GitHub API rate limiting:** Anonymous requests are limited to 60/hour. Should we add a GitHub token for higher limits? (Current design: no token, accept rate limits)
- **Pre-releases:** Should the plugin check for pre-release versions? (Current design: no, only stable releases)
- **Downgrades:** Should users be able to downgrade to a previous version? (Current design: no, YAGNI)
