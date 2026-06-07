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
                                # PluginLoader path injected into set command
                                assert "set \"PLUGIN_LOADER_PATH=C:\\homebrew\\services\\PluginLoader_noconsole.exe\"" in content
                                assert ":wait_pl" in content
                                assert "if %COUNT% lss 10 goto :wait_pl" in content
                                # Steam launch
                                assert "start \"\" \"C:\\Steam\\steam.exe\"" in content
                                assert "del \"%~f0\"" in content

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
                                # Path variable is set to empty
                                assert "set \"PLUGIN_LOADER_PATH=\"" in content
                                # Guard redirects to steam when path is empty
                                assert "if \"%PLUGIN_LOADER_PATH%\"==\"\" goto :start_steam" in content
                                # Should still launch Steam
                                assert "start \"\" \"C:\\Steam\\steam.exe\"" in content

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
                            assert "pkill -9 PluginLoader" in content
                            assert "pkill -9 PluginLoader_noconsole" in content
                            assert "steam &" in content

    @pytest.mark.asyncio
    @pytest.mark.skipif(sys.platform != "win32", reason="Windows-only test")
    async def test_detachment_windows(self):
        """Verifies cmd.exe /c and CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.get_steam_path", return_value="C:\\Steam"):
                    with patch("main.subprocess.Popen") as mock_popen:
                        with patch("main.sys.platform", "win32"):
                            plugin = _plugin_instance()
                            await plugin.restart_steam()

                            args, kwargs = mock_popen.call_args
                            assert args[0] == ["cmd.exe", "/c", str(Path(tmpdir) / "restart_steam.bat")]
                            assert "creationflags" in kwargs
                            import subprocess
                            expected = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
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
            bat = Path(tmpdir) / "restart_steam.bat"
            ps1.write_text("stale")
            sh.write_text("stale")
            bat.write_text("stale")

            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.refresh_manifest", return_value=[]):
                    plugin = _plugin_instance()
                    await plugin._main()

                    assert not ps1.exists()
                    assert not sh.exists()
                    assert not bat.exists()

    @pytest.mark.asyncio
    async def test_cleanup_no_files_no_error(self):
        """_main() succeeds even when no stale scripts exist."""
        import os as real_os  # avoid shadowing

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("main.decky.DECKY_PLUGIN_SETTINGS_DIR", tmpdir):
                with patch("main.refresh_manifest", return_value=[]):
                    plugin = _plugin_instance()
                    await plugin._main()  # Should not raise


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

        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            pl_dir = Path(tmpdir) / "services"
            pl_dir.mkdir(parents=True, exist_ok=True)
            pl_exe = pl_dir / "PluginLoader_noconsole.exe"
            pl_exe.touch()

            with patch("main.decky.DECKY_HOME", tmpdir):
                result = main.Plugin._resolve_plugin_loader_path()
                assert result == str(pl_exe)
