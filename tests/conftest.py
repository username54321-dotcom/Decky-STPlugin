"""pytest configuration: mock decky module for test isolation."""
import sys
from unittest.mock import MagicMock

# decky is a runtime-only module; provide a mock for tests
if "decky" not in sys.modules:
    mock_decky = MagicMock()
    mock_decky.logger = MagicMock()
    mock_decky.DECKY_PLUGIN_NAME = "STPlugin"
    mock_decky.DECKY_PLUGIN_VERSION = "1.0.3"
    mock_decky.DECKY_PLUGIN_SETTINGS_DIR = "/tmp/stplugin"
    sys.modules["decky"] = mock_decky
