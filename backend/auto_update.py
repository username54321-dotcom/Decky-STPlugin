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


GITHUB_OWNER = "username54321-dotcom"
GITHUB_REPO = "Decky-STPlugin"
UPDATE_CHECK_INTERVAL = 30  # temporary: 30s for dev; change to 1800 before production release


@dataclass
class UpdateInfo:
    available: bool
    current_version: str
    latest_version: Optional[str] = None
    release_url: Optional[str] = None
    asset_url: Optional[str] = None
    checked_at: Optional[float] = None


def parse_version(version_str: str) -> tuple[int, ...]:
    clean = version_str.lstrip("v")
    return tuple(int(x) for x in clean.split("."))


def is_newer(latest: str, current: str) -> bool:
    return parse_version(latest) > parse_version(current)


def _get_current_version() -> str:
    return getattr(decky, "DECKY_PLUGIN_VERSION", "0.0.0")


async def _fetch_latest_release() -> dict:
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "Decky-STPlugin"})
        resp.raise_for_status()
        return resp.json()


def _find_zip_asset(assets: list[dict]) -> Optional[str]:
    for asset in assets:
        name = asset.get("name", "")
        if name.startswith("STPlugin-") and name.endswith(".zip"):
            return asset.get("browser_download_url")
    return None


async def check_for_update() -> Optional[UpdateInfo]:
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
            checked_at=time.time(),
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


async def _download_update(asset_url: str) -> Optional[Path]:
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(asset_url, headers={"User-Agent": "Decky-STPlugin"})
            resp.raise_for_status()

            with tempfile.NamedTemporaryFile(prefix="stplugin-", suffix=".zip", delete=False) as tmp:
                tmp.write(resp.content)
                return Path(tmp.name)
    except Exception as e:
        decky.logger.error(f"Failed to download update: {e}")
        return None


def _extract_update(zip_path: Path, target_dir: Path) -> bool:
    import shutil
    try:
        with tempfile.TemporaryDirectory() as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(tmp_dir)

            if not (tmp_dir / "main.py").exists() and not (tmp_dir / "package.json").exists():
                subdir = next((d for d in tmp_dir.iterdir() if d.is_dir()), None)
                if subdir and ((subdir / "main.py").exists() or (subdir / "package.json").exists()):
                    tmp_dir = subdir
                else:
                    decky.logger.error("ZIP missing required files (main.py or package.json)")
                    return False

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
    zip_path = None
    try:
        zip_path = await _download_update(asset_url)
        if not zip_path:
            return False

        plugin_dir = Path(decky.DECKY_PLUGIN_DIR)
        success = _extract_update(zip_path, plugin_dir)

        if success:
            await decky.emit("update_installed", {})

        return success
    except Exception as e:
        decky.logger.error(f"Update installation failed: {e}")
        return False
    finally:
        if zip_path and zip_path.exists():
            zip_path.unlink(missing_ok=True)
