# Plugin Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an auto-update system that checks GitHub Releases for new versions and installs them automatically, with CI/CD via GitHub Actions.

**Architecture:** Backend Python module (`auto_update.py`) handles GitHub API checking and ZIP installation. Frontend React components show update status and install buttons. GitHub Actions builds and publishes releases on tag push.

**Tech Stack:** Python (httpx, zipfile, asyncio), TypeScript/React (@decky/api, @decky/ui), GitHub Actions

> **⚠️ PREREQUISITES — What you must do on your side before this will work:**
> 
> 1. **Update `GITHUB_OWNER`** — In `backend/auto_update.py`, change `GITHUB_OWNER = "your-username"` to your actual GitHub username (line ~97).
> 2. **Ensure GitHub Releases are enabled** — The repo must be hosted on GitHub with the Releases feature available (it's on by default for public repos).
> 3. **Enable GitHub Actions** — Verify Actions are enabled in the repo Settings → Actions → General.
> 4. **Push the first version tag** — Run `pnpm release:patch` (or create a tag manually like `git tag v0.1.0 && git push --tags`) to trigger the first CI/CD release build.
> 5. **Verify `window.open` works in Decky** — The "View Release" buttons use `window.open(url, "_blank")`. Decky's embedded Chromium webview may block popups. Test this on a real Decky Loader instance. If it doesn't work, you'll need to use an alternative (e.g., `SteamClient.Browser.OpenURL` or a Decky-specific navigation API).

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `backend/auto_update.py` | GitHub API checking, version comparison, ZIP download/extraction |
| `backend/test_auto_update.py` | Unit tests for update logic |
| `.github/workflows/release.yml` | CI/CD pipeline for automated releases |

### Modified Files

| File | Changes |
|------|---------|
| `main.py` | Add `check_for_update()` and `install_update()` RPC methods, start background task in `_main()` |
| `src/index.tsx` | Add update notification banner, listen for update events |
| `src/SettingsPanel.tsx` | Add "Plugin Updates" section with check/install buttons |
| `src/shared/types.ts` | Add `UpdateInfo` and `UpdateStatus` interfaces |
| `package.json` | Add release scripts |

---

## Task 1: Backend Update Checker (`backend/auto_update.py`)

**Files:**
- Create: `backend/auto_update.py`
- Create: `backend/test_auto_update.py`

### Step 1: Write failing tests for version parsing

```python
# tests/test_auto_update.py
import pytest
from backend.auto_update import parse_version, is_newer

def test_parse_version_simple():
    assert parse_version("0.2.0") == (0, 2, 0)

def test_parse_version_with_v_prefix():
    assert parse_version("v1.0.0") == (1, 0, 0)

def test_parse_version_single_digit():
    assert parse_version("1") == (1,)

def test_is_newer_true():
    assert is_newer("0.2.0", "0.1.0") is True

def test_is_newer_false_equal():
    assert is_newer("0.1.0", "0.1.0") is False

def test_is_newer_false_older():
    assert is_newer("0.1.0", "0.2.0") is False

def test_is_newer_major_version():
    assert is_newer("1.0.0", "0.9.9") is True

def test_is_newer_with_v_prefix():
    assert is_newer("v0.2.0", "v0.1.0") is True
```

### Step 2: Run tests to verify they fail

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'backend.auto_update'"

### Step 3: Implement version parsing functions

```python
# backend/auto_update.py
"""Auto-update system for Decky-STPlugin."""

import asyncio
import tempfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

import decky

# GitHub repository configuration
# Update these with your actual GitHub username/repo after creating the repository
GITHUB_OWNER = "your-username"
GITHUB_REPO = "Decky-STPlugin"
UPDATE_CHECK_INTERVAL = 7200  # 2 hours in seconds


@dataclass
class UpdateInfo:
    """Information about an available update."""
    available: bool
    current_version: str
    latest_version: Optional[str] = None
    release_url: Optional[str] = None
    asset_url: Optional[str] = None
    checked_at: Optional[float] = None


def parse_version(version_str: str) -> tuple[int, ...]:
    """Parse version string to comparable tuple.
    
    Args:
        version_str: Version string like "0.2.0" or "v1.0.0"
    
    Returns:
        Tuple of version numbers, e.g., (0, 2, 0)
    """
    clean = version_str.lstrip('v')
    return tuple(int(x) for x in clean.split('.'))


def is_newer(latest: str, current: str) -> bool:
    """Check if latest version is newer than current.
    
    Args:
        latest: Latest version string (e.g., "0.2.0")
        current: Current version string (e.g., "0.1.0")
    
    Returns:
        True if latest > current
    """
    return parse_version(latest) > parse_version(current)
```

### Step 4: Run tests to verify they pass

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v`
Expected: PASS (8 tests)

### Step 5: Commit

```bash
git add backend/auto_update.py tests/test_auto_update.py
git commit -m "feat(update): add version parsing functions with tests"
```

---

## Task 2: GitHub API Integration

**Files:**
- Modify: `backend/auto_update.py`
- Modify: `backend/test_auto_update.py`

### Step 1: Write failing tests for GitHub API

```python
# Add to tests/test_auto_update.py

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.auto_update import check_for_update, UpdateInfo

@pytest.mark.asyncio
async def test_check_for_update_new_version():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "tag_name": "v0.2.0",
        "html_url": "https://github.com/test/repo/releases/tag/v0.2.0",
        "assets": [
            {
                "name": "STPlugin-v0.2.0.zip",
                "browser_download_url": "https://github.com/test/repo/releases/download/v0.2.0/STPlugin-v0.2.0.zip"
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        with patch("backend.auto_update._get_current_version", return_value="0.1.0"):
            result = await check_for_update()
            
            assert result is not None
            assert result.available is True
            assert result.latest_version == "0.2.0"
            assert result.release_url == "https://github.com/test/repo/releases/tag/v0.2.0"
            assert result.asset_url == "https://github.com/test/repo/releases/download/v0.2.0/STPlugin-v0.2.0.zip"

@pytest.mark.asyncio
async def test_check_for_update_same_version():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "tag_name": "v0.1.0",
        "html_url": "https://github.com/test/repo/releases/tag/v0.1.0",
        "assets": []
    }
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        with patch("backend.auto_update._get_current_version", return_value="0.1.0"):
            result = await check_for_update()
            
            assert result is not None
            assert result.available is False
            assert result.latest_version == "0.1.0"

@pytest.mark.asyncio
async def test_check_for_update_network_error():
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        with patch("backend.auto_update._get_current_version", return_value="0.1.0"):
            result = await check_for_update()
            
            assert result is None
```

### Step 2: Run tests to verify they fail

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v -k "check_for_update"`
Expected: FAIL with "AttributeError: module 'backend.auto_update' has no attribute 'check_for_update'"

### Step 3: Implement GitHub API functions

```python
# Add to backend/auto_update.py

def _get_current_version() -> str:
    """Get current plugin version from the Decky runtime."""
    return getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0")


async def _fetch_latest_release() -> dict:
    """Fetch latest release from GitHub API.
    
    Returns:
        GitHub release JSON response
    
    Raises:
        httpx.HTTPStatusError: On HTTP errors
        httpx.TimeoutException: On timeout
    """
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
    
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "Decky-STPlugin"})
        resp.raise_for_status()
        return resp.json()


def _find_zip_asset(assets: list[dict]) -> Optional[str]:
    """Find ZIP asset URL from release assets.
    
    Args:
        assets: List of GitHub release asset objects
    
    Returns:
        Download URL for ZIP asset, or None if not found
    """
    for asset in assets:
        if asset.get("name", "").endswith(".zip"):
            return asset.get("browser_download_url")
    return None


async def check_for_update() -> Optional[UpdateInfo]:
    """Check GitHub for new version.
    
    Returns:
        UpdateInfo if check successful, None on error
    """
    try:
        current_version = _get_current_version()
        release = await _fetch_latest_release()
        
        tag_name = release.get("tag_name", "")
        latest_version = tag_name.lstrip("v")
        release_url = release.get("html_url")
        asset_url = _find_zip_asset(release.get("assets", []))
        
        return UpdateInfo(
            available=is_newer(latest_version, current_version),
            current_version=current_version,
            latest_version=latest_version,
            release_url=release_url,
            asset_url=asset_url,
            checked_at=time.time()
        )
    except httpx.TimeoutException:
        decky.logger.warning("Update check timed out")
        return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            decky.logger.warning("GitHub API rate limited")
        else:
            decky.logger.error(f"GitHub API error: {e}")
        return None
    except Exception as e:
        decky.logger.error(f"Update check failed: {e}")
        return None
```

### Step 4: Run tests to verify they pass

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v`
Expected: PASS (11 tests)

### Step 5: Commit

```bash
git add backend/auto_update.py tests/test_auto_update.py
git commit -m "feat(update): add GitHub API integration for version checking"
```

---

## Task 3: Update Installer

**Files:**
- Modify: `backend/auto_update.py`
- Modify: `backend/test_auto_update.py`

### Step 1: Write failing tests for installation

```python
# Add to tests/test_auto_update.py

import tempfile
import zipfile
from pathlib import Path

@pytest.mark.asyncio
async def test_install_update_success():
    # Create a test ZIP file
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        zip_path = Path(tmp.name)
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr("main.py", "# test content")
            zf.writestr("package.json", '{"version": "0.2.0"}')
    
    try:
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.content = zip_path.read_bytes()
            mock_response.raise_for_status = MagicMock()
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with patch("backend.auto_update.decky") as mock_decky:
                mock_decky.DECKY_PLUGIN_DIR = tempfile.mkdtemp()
                mock_decky.emit = AsyncMock()
                
                result = await install_update("https://example.com/update.zip")
                
                assert result is True
                mock_decky.emit.assert_called_once_with("update_installed", {})
    finally:
        zip_path.unlink(missing_ok=True)

@pytest.mark.asyncio
async def test_install_update_invalid_zip():
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        zip_path = Path(tmp.name)
        tmp.write(b"not a zip file")
    
    try:
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.content = zip_path.read_bytes()
            mock_response.raise_for_status = MagicMock()
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with patch("backend.auto_update.decky") as mock_decky:
                mock_decky.DECKY_PLUGIN_DIR = tempfile.mkdtemp()
                
                result = await install_update("https://example.com/update.zip")
                
                assert result is False
    finally:
        zip_path.unlink(missing_ok=True)

@pytest.mark.asyncio
async def test_install_update_download_failure():
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        
        result = await install_update("https://example.com/update.zip")
        
        assert result is False
```

### Step 2: Run tests to verify they fail

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v -k "install_update"`
Expected: FAIL with "AttributeError: module 'backend.auto_update' has no attribute 'install_update'"

### Step 3: Implement installation functions

```python
# Add to backend/auto_update.py

async def _download_update(asset_url: str) -> Optional[Path]:
    """Download update ZIP from GitHub release.
    
    Args:
        asset_url: Direct download URL for ZIP asset
    
    Returns:
        Path to downloaded ZIP file, or None on error
    """
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(asset_url, headers={"User-Agent": "Decky-STPlugin"})
            resp.raise_for_status()
            
            # Save to temp file
            tmp_dir = Path(tempfile.gettempdir())
            zip_path = tmp_dir / "stplugin-update.zip"
            zip_path.write_bytes(resp.content)
            
            return zip_path
    except Exception as e:
        decky.logger.error(f"Failed to download update: {e}")
        return None


def _extract_update(zip_path: Path, target_dir: Path) -> bool:
    """Extract update ZIP to target directory via temp staging.
    
    Extracts to a temporary directory first, validates required files
    exist, then moves contents to target_dir. This prevents a partial
    or corrupt installation if extraction fails mid-way.
    """
    import shutil
    try:
        with tempfile.TemporaryDirectory() as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(tmp_dir)
            
            # Validate: at least main.py or package.json must exist
            if not (tmp_dir / "main.py").exists() and not (tmp_dir / "package.json").exists():
                decky.logger.error("ZIP missing required files (main.py or package.json)")
                return False
            
            # Move files from temp to target, overwriting existing
            for item in tmp_dir.iterdir():
                dest = target_dir / item.name
                if item.is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)
            
            return True
    except zipfile.BadZipFile:
        decky.logger.error("Invalid ZIP file")
        return False
    except Exception as e:
        decky.logger.error(f"Failed to extract update: {e}")
        return False


async def install_update(asset_url: str) -> bool:
    """Download and install update from GitHub release.
    
    Args:
        asset_url: Direct download URL for ZIP asset
    
    Returns:
        True on success, False on error
    """
    zip_path = None
    try:
        # Download ZIP
        zip_path = await _download_update(asset_url)
        if not zip_path:
            return False
        
        # Extract to plugin directory
        plugin_dir = Path(decky.DECKY_PLUGIN_DIR)
        success = _extract_update(zip_path, plugin_dir)
        
        if success:
            await decky.emit("update_installed", {})
        
        return success
    except Exception as e:
        decky.logger.error(f"Update installation failed: {e}")
        return False
    finally:
        # Cleanup temp file
        if zip_path and zip_path.exists():
            zip_path.unlink(missing_ok=True)
```

### Step 4: Run tests to verify they pass

Run: `cd D:\Git\Decky-STPlugin && python -m pytest tests/test_auto_update.py -v`
Expected: PASS (14 tests)

### Step 5: Commit

```bash
git add backend/auto_update.py tests/test_auto_update.py
git commit -m "feat(update): add update download and installation logic"
```

---

## Task 4: Plugin Integration (main.py)

**Files:**
- Modify: `main.py`

### Step 1: Add import and update methods to Plugin class

```python
# Add to imports at top of main.py
from backend.auto_update import check_for_update as _check_for_update, install_update as _install_update, UpdateInfo, UPDATE_CHECK_INTERVAL

# Add to Plugin class methods:

    async def check_for_updates(self) -> dict:
        """Check GitHub for new version.
        
        Returns:
            Dict with update info or error
        """
        info = await _check_for_update()
        if info is None:
            return {"error": "Failed to check for updates"}
        
        return {
            "available": info.available,
            "current_version": info.current_version,
            "latest_version": info.latest_version,
            "release_url": info.release_url,
            "asset_url": info.asset_url,
            "checked_at": info.checked_at
        }

    async def install_update(self, asset_url: str) -> dict:
        """Download and install update.
        
        Args:
            asset_url: Direct download URL for ZIP asset
        
        Returns:
            Dict with success status
        """
        success = await _install_update(asset_url)
        return {"success": success}
```

### Step 2: Add background update check to `_main()`

```python
# Add to _main() method, after existing initialization:

    # Start background update checker
    async def _update_checker():
        while True:
            await asyncio.sleep(UPDATE_CHECK_INTERVAL)
            info = await _check_for_update()
            if info and info.available:
                await decky.emit("update_available", {
                    "current_version": info.current_version,
                    "latest_version": info.latest_version,
                    "release_url": info.release_url,
                    "asset_url": info.asset_url
                })
    
    asyncio.ensure_future(_update_checker())
```

### Step 3: Manual test

1. Deploy plugin to Decky
2. Open Settings panel
3. Verify no errors in console
4. Verify plugin loads correctly

### Step 4: Commit

```bash
git add main.py
git commit -m "feat(update): integrate update checker into plugin backend"
```

---

## Task 5: Frontend Types and Hook

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/update/hooks/useUpdateStatus.ts`

### Step 1: Add update types to shared/types.ts

```typescript
// Add to src/shared/types.ts

export interface UpdateInfo {
    available: boolean;
    current_version: string;
    latest_version: string | null;
    release_url: string | null;
    asset_url: string | null;
    checked_at: number | null;
}

export interface UpdateStatus {
    available: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
    assetUrl: string | null;
    checkedAt: number | null;
    installing: boolean;
}
```

### Step 2: Create useUpdateStatus hook

```typescript
// src/update/hooks/useUpdateStatus.ts

import { useState, useEffect, useCallback } from "react";
import { callable, addEventListener, removeEventListener, toaster } from "@decky/api";
import type { UpdateInfo, UpdateStatus } from "../../shared/types";

const checkForUpdates = callable<[], UpdateInfo | { error: string }>("check_for_updates");
const installUpdate = callable<[string], { success: boolean }>("install_update");

export function useUpdateStatus() {
    const [status, setStatus] = useState<UpdateStatus>({
        available: false,
        currentVersion: "0.1.0",
        latestVersion: null,
        releaseUrl: null,
        assetUrl: null,
        checkedAt: null,
        installing: false
    });

    // Listen for update events from backend
    useEffect(() => {
        const handleUpdateAvailable = (info: {
            current_version: string;
            latest_version: string;
            release_url: string;
            asset_url: string;
        }) => {
            setStatus(prev => ({
                ...prev,
                available: true,
                currentVersion: info.current_version,
                latestVersion: info.latest_version,
                releaseUrl: info.release_url,
                assetUrl: info.asset_url
            }));
        };

        const handleUpdateInstalled = () => {
            setStatus(prev => ({
                ...prev,
                available: false,
                installing: false
            }));
            toaster.toast({
                title: "STPlugin",
                body: "Update installed! Restart Steam to apply."
            });
        };

        const unlistenAvailable = addEventListener<[{ current_version: string; latest_version: string; release_url: string; asset_url: string }]>(
            "update_available",
            handleUpdateAvailable
        );
        const unlistenInstalled = addEventListener<[]>(
            "update_installed",
            handleUpdateInstalled
        );

        return () => {
            removeEventListener("update_available", unlistenAvailable);
            removeEventListener("update_installed", unlistenInstalled);
        };
    }, []);

    // Check for updates manually
    const checkUpdate = useCallback(async () => {
        try {
            const result = await checkForUpdates();
            if ("error" in result) {
                toaster.toast({ title: "Update Check Failed", body: result.error });
                return;
            }
            
            setStatus(prev => ({
                ...prev,
                available: result.available,
                currentVersion: result.current_version,
                latestVersion: result.latest_version,
                releaseUrl: result.release_url,
                assetUrl: result.asset_url,
                checkedAt: result.checked_at
            }));

            if (!result.available) {
                toaster.toast({ title: "STPlugin", body: "You're up to date!" });
            }
        } catch (err) {
            toaster.toast({ title: "Update Check Failed", body: String(err) });
        }
    }, []);

    // Install update
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

    return { status, checkUpdate, install };
}
```

### Step 3: Manual test

1. Deploy plugin
2. Open browser console
3. Verify hook imports correctly
4. Verify no TypeScript errors

### Step 4: Commit

```bash
git add src/shared/types.ts src/update/hooks/useUpdateStatus.ts
git commit -m "feat(update): add frontend update types and hook"
```

---

## Task 6: Settings Panel UI

**Files:**
- Modify: `src/SettingsPanel.tsx`

### Step 1: Add imports and update section

```typescript
// Add to imports in src/SettingsPanel.tsx
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";
```

### Step 2: Add update section to SettingsPanel component

```tsx
// Add to SettingsPanel component, before the closing </PageLayout>:

    const { status: updateStatus, checkUpdate, install } = useUpdateStatus();

    // Add this JSX block inside PageLayout, after existing settings sections:

    <PanelSectionRow>
        <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
    </PanelSectionRow>
    
    <PanelSectionRow>
        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Plugin Updates</div>
    </PanelSectionRow>
    
    <PanelSectionRow>
        <div style={{ fontSize: "12px", color: "#8b929a" }}>
            Current Version: {updateStatus.currentVersion}
        </div>
    </PanelSectionRow>
    
    {updateStatus.checkedAt && (
        <PanelSectionRow>
            <div style={{ fontSize: "12px", color: "#8b929a" }}>
                Last Checked: {new Date(updateStatus.checkedAt * 1000).toLocaleString()}
            </div>
        </PanelSectionRow>
    )}
    
    <PanelSectionRow>
        <ButtonItem
            layout="below"
            onClick={checkUpdate}
            disabled={updateStatus.installing}
        >
            {updateStatus.installing ? "Installing..." : "Check for Updates"}
        </ButtonItem>
    </PanelSectionRow>
    
    {updateStatus.available && updateStatus.latestVersion && (
        <PanelSectionRow>
            <div style={{
                background: "rgba(0, 255, 0, 0.1)",
                border: "1px solid rgba(0, 255, 0, 0.3)",
                borderRadius: "4px",
                padding: "8px",
                marginBottom: "8px"
            }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    Update Available: v{updateStatus.latestVersion}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    {updateStatus.releaseUrl && (
                        <ButtonItem
                            onClick={() => {
                                // ⚠️ Test this in Decky - webview may block window.open.
                                // Fallback: SteamClient.Browser.OpenURL or similar API.
                                window.open(updateStatus.releaseUrl!, "_blank");
                            }}
                        >
                            View Release
                        </ButtonItem>
                    )}
                    <ButtonItem
                        layout="below"
                        onClick={install}
                        disabled={updateStatus.installing}
                    >
                        {updateStatus.installing ? "Installing..." : "Install Now"}
                    </ButtonItem>
                </div>
            </div>
        </PanelSectionRow>
    )}
```

### Step 3: Manual test

1. Deploy plugin
2. Open Settings panel
3. Verify "Plugin Updates" section appears
4. Verify version displays correctly
5. Click "Check for Updates" button
6. Verify toast appears (success or error)

### Step 4: Commit

```bash
git add src/SettingsPanel.tsx
git commit -m "feat(update): add update UI to settings panel"
```

---

## Task 7: Main View Update Banner

**Files:**
- Modify: `src/index.tsx`

### Step 1: Add imports

```typescript
// Add to imports in src/index.tsx
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";
```

### Step 2: Add update banner to main component

```tsx
// Add to main component (Content or App):

    const { status: updateStatus, install } = useUpdateStatus();
    const [bannerDismissed, setBannerDismissed] = useState(false);

    // Add this JSX at the top of the return, before other content:
    {updateStatus.available && updateStatus.latestVersion && !bannerDismissed && (
        <div style={{
            background: "rgba(0, 255, 0, 0.1)",
            border: "1px solid rgba(0, 255, 0, 0.3)",
            borderRadius: "4px",
            padding: "12px",
            margin: "8px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        }}>
            <div>
                <span style={{ fontWeight: "bold" }}>Update Available: v{updateStatus.latestVersion}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
                {updateStatus.releaseUrl && (
                    <ButtonItem
                        onClick={() => {
                            // ⚠️ Test in Decky first — webview may block popups.
                            window.open(updateStatus.releaseUrl!, "_blank");
                        }}
                    >
                        View
                    </ButtonItem>
                )}
                <ButtonItem
                    onClick={install}
                    disabled={updateStatus.installing}
                >
                    {updateStatus.installing ? "Installing..." : "Install"}
                </ButtonItem>
                <ButtonItem
                    onClick={() => setBannerDismissed(true)}
                >
                    Dismiss
                </ButtonItem>
            </div>
        </div>
    )}
```


### Step 3: Manual test

1. Deploy plugin
2. Verify update banner appears (if update available)
3. Verify banner links work
4. Verify install button works

### Step 4: Commit

```bash
git add src/index.tsx
git commit -m "feat(update): add update notification banner to main view"
```

---

## Task 8: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/release.yml`

### Step 1: Create release workflow

```yaml
# .github/workflows/release.yml

name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build frontend
        run: pnpm run build
      
      - name: Create plugin ZIP
        run: |
          mkdir -p release
          cp main.py release/
          cp plugin.json release/
          cp package.json release/
          cp -r backend release/
          cp -r dist release/
          rm -rf release/backend/__pycache__
          cd release && zip -r ../STPlugin-${{ github.ref_name }}.zip .
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: STPlugin-${{ github.ref_name }}.zip
          generate_release_notes: true
          draft: false
          prerelease: false
```

### Step 2: Manual test (dry run)

1. Create a test tag: `git tag v0.1.0-test`
2. Push: `git push origin v0.1.0-test`
3. Verify workflow runs in GitHub Actions
4. Verify release is created
5. Verify ZIP contains correct files
6. Delete test release and tag

### Step 3: Commit

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow"
```

---

## Task 9: Release Scripts

**Files:**
- Modify: `package.json`

### Step 1: Add release scripts

```json
// Add to "scripts" in package.json:

    "release:patch": "pnpm version patch && git push && git push --tags",
    "release:minor": "pnpm version minor && git push && git push --tags",
    "release:major": "pnpm version major && git push && git push --tags"
```

### Step 2: Test locally

```bash
# Verify scripts are recognized
pnpm run

# Should show:
#   release:patch
#   release:minor
#   release:major
```

### Step 3: Commit

```bash
git add package.json
git commit -m "feat: add release automation scripts"
```

---

## Task 10: Final Integration Testing

### Step 1: Build and deploy

```bash
pnpm run build
node scripts/deploy.mjs
```

### Step 2: Test update flow end-to-end

1. **Install plugin on Steam Deck / Decky Loader**
2. **Verify version displays in Settings**
3. **Click "Check for Updates"**
   - If no update: Verify "You're up to date!" toast
   - If update available: Verify banner appears
4. **Click "Install Now"**
   - Verify download progress
   - Verify extraction success
   - Verify "Update installed!" toast
5. **Restart Steam**
   - Verify new version loads

### Step 3: Test error scenarios

1. **Disconnect network**
   - Click "Check for Updates"
   - Verify error toast appears
2. **Reconnect and retry**
   - Verify check succeeds

### Step 4: Create first release

```bash
pnpm release:patch   # 0.1.0 → 0.1.1
```

### Step 5: Verify CI/CD

1. Check GitHub Actions workflow runs
2. Verify release is created
3. Verify ZIP contains correct files
4. Install from release ZIP
5. Verify update check finds new version

---

## Checklist

- [ ] Backend update checker (`auto_update.py`)
- [ ] Version parsing tests pass
- [ ] GitHub API integration tests pass
- [ ] Update installer tests pass
- [ ] Plugin integration (`main.py`)
- [ ] Frontend types (`shared/types.ts`)
- [ ] Update hook (`useUpdateStatus.ts`)
- [ ] Settings panel UI
- [ ] Main view banner
- [ ] GitHub Actions workflow
- [ ] Release scripts
- [ ] End-to-end testing
- [ ] First release created
