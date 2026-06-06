"""Unit tests for the auto-update system."""

import tempfile
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.auto_update import (
    UpdateInfo,
    _find_zip_asset,
    check_for_update,
    install_update,
    is_newer,
    parse_version,
)


class TestVersionParsing:
    def test_parse_version_simple(self):
        assert parse_version("0.2.0") == (0, 2, 0)

    def test_parse_version_with_v_prefix(self):
        assert parse_version("v1.0.0") == (1, 0, 0)

    def test_parse_version_single_digit(self):
        assert parse_version("1") == (1,)

    def test_is_newer_true(self):
        assert is_newer("0.2.0", "0.1.0") is True

    def test_is_newer_false_equal(self):
        assert is_newer("0.1.0", "0.1.0") is False

    def test_is_newer_false_older(self):
        assert is_newer("0.1.0", "0.2.0") is False

    def test_is_newer_major_version(self):
        assert is_newer("1.0.0", "0.9.9") is True

    def test_is_newer_with_v_prefix(self):
        assert is_newer("v0.2.0", "v0.1.0") is True


class TestFindZipAsset:
    def test_finds_zip_asset(self):
        assets = [
            {"name": "STPlugin-v0.2.0.zip", "browser_download_url": "https://example.com/STPlugin-v0.2.0.zip"},
            {"name": "source.tar.gz", "browser_download_url": "https://example.com/source.tar.gz"},
        ]
        assert _find_zip_asset(assets) == "https://example.com/STPlugin-v0.2.0.zip"

    def test_returns_none_when_no_zip(self):
        assets = [{"name": "source.tar.gz", "browser_download_url": "https://example.com/source.tar.gz"}]
        assert _find_zip_asset(assets) is None

    def test_returns_none_on_empty_assets(self):
        assert _find_zip_asset([]) is None


@pytest.mark.asyncio
class TestCheckForUpdate:
    async def test_new_version_available(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "tag_name": "v0.2.0",
            "html_url": "https://github.com/test/repo/releases/tag/v0.2.0",
            "assets": [
                {
                    "name": "STPlugin-v0.2.0.zip",
                    "browser_download_url": "https://github.com/test/repo/releases/download/v0.2.0/STPlugin-v0.2.0.zip",
                }
            ],
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

    async def test_same_version(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "tag_name": "v0.1.0",
            "html_url": "https://github.com/test/repo/releases/tag/v0.1.0",
            "assets": [],
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            with patch("backend.auto_update._get_current_version", return_value="0.1.0"):
                result = await check_for_update()

                assert result is not None
                assert result.available is False
                assert result.latest_version == "0.1.0"

    async def test_network_error(self):
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )
            with patch("backend.auto_update._get_current_version", return_value="0.1.0"):
                result = await check_for_update()

                assert result is None


@pytest.mark.asyncio
class TestInstallUpdate:
    async def test_install_success(self):
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = Path(tmp.name)
            with zipfile.ZipFile(zip_path, "w") as zf:
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

    async def test_install_invalid_zip(self):
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

    async def test_install_download_failure(self):
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )

            result = await install_update("https://example.com/update.zip")

            assert result is False


@pytest.mark.asyncio
class TestInstallUpdateContract:
    """Verify the callable contract that the frontend hook depends on."""

    async def test_install_update_returns_true_on_success(self):
        """install_update must return True when it emits update_installed."""
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = Path(tmp.name)
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("main.py", "# test content")
                zf.writestr("package.json", '{"version": "0.2.0"}')

        try:
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.content = zip_path.read_bytes()
                mock_response.raise_for_status = MagicMock()
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_response
                )

                with patch("backend.auto_update.decky") as mock_decky:
                    mock_decky.DECKY_PLUGIN_DIR = tempfile.mkdtemp()
                    mock_decky.emit = AsyncMock()

                    result = await install_update(
                        "https://example.com/update.zip"
                    )

                    assert result is True
                    mock_decky.emit.assert_called_once_with(
                        "update_installed", {}
                    )
        finally:
            zip_path.unlink(missing_ok=True)

    async def test_install_update_returns_false_on_failure(self):
        """install_update must return False on download failure."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )

            result = await install_update(
                "https://example.com/update.zip"
            )

            assert result is False
