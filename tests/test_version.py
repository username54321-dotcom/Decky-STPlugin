"""Tests for the get_plugin_version IPC method."""

import pytest

import decky
from main import Plugin


@pytest.mark.asyncio
async def test_get_plugin_version():
    plugin = Plugin()
    version = await plugin.get_plugin_version()
    assert version == decky.DECKY_PLUGIN_VERSION
    assert isinstance(version, str)
    assert len(version) > 0
