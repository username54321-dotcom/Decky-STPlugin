# Delimiter Fix & Title Sanitization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the corrupted image URL bug caused by `:` in game names by switching the `loadedappids.txt` delimiter to `|`, and sanitize game titles to strip control characters and delimiter injection.

**Architecture:** Change the tracking file format from `appid:name:imageUrl` to `appid|name|imageUrl`. Add a `_sanitize_title()` helper that strips control characters, pipe characters, and normalizes whitespace. Add a `_parse_tracking_line()` helper for clean pipe-delimited parsing. No frontend changes — the `InstalledApp` TypeScript interface is unchanged.

**Tech Stack:** Python (backend only), no new dependencies

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/downloads.py` | Add `_sanitize_title()`, `_parse_tracking_line()`, update `_track_installed()`, `get_installed_apps()`, `_remove_loaded_app()` |

No frontend changes needed — `InstalledApp` interface (`appid`, `name`, `img_url`) stays the same.

---

### Task 1: Add `_sanitize_title()` and `_parse_tracking_line()` helpers

**Files:**
- Modify: `backend/downloads.py` (add two new functions before `_track_installed`)

- [ ] **Step 1: Add the sanitization and parsing functions**

Add these two functions in `backend/downloads.py` right before the `_track_installed` function (before line 377):

```python
def _sanitize_title(name: str) -> str:
    """Sanitize a game title for safe storage in the tracking file.

    Strips control characters, pipe delimiters, and normalizes whitespace.
    Preserves Unicode characters (®, ™, é, 日本語, etc.).
    """
    # Strip control characters (\x00-\x1f, \x7f) and pipe delimiter
    name = re.sub(r"[\x00-\x1f\x7f|]", "", name)
    # Collapse multiple spaces to one, then strip leading/trailing
    name = re.sub(r"\s+", " ", name).strip()
    return name
```

(`re` is already imported at the top of the file — line 6.)

Then add a second helper right after `_sanitize_title`:

```python
def _parse_tracking_line(line: str) -> dict[str, Any] | None:
    """Parse a single line from loadedappids.txt.

    Format: appid|name|imageUrl (pipe-delimited).
    """
    line = line.strip()
    if not line:
        return None
    if line.isdigit():
        return {"appid": int(line), "name": "", "img_url": ""}
    if "|" not in line:
        return None
    parts = line.split("|", 2)
    try:
        appid = int(parts[0])
    except ValueError:
        return None
    name = parts[1] if len(parts) > 1 else ""
    img_url = parts[2] if len(parts) > 2 else ""
    return {"appid": appid, "name": name, "img_url": img_url}
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `python -m pytest tests/ -v`
Expected: All existing tests pass (this is a new function, nothing calls it yet).

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: add _sanitize_title() and _parse_tracking_line() helpers"
```

---

### Task 2: Update `_track_installed()` to use `|` delimiter and sanitize titles

**Files:**
- Modify: `backend/downloads.py` — `_track_installed()` (lines 377–404)

- [ ] **Step 1: Rewrite `_track_installed()`**

Replace the entire `_track_installed` function (lines 377–404) with:

```python
def _track_installed(appid: int, lua_dir: Path, name: str = "", img_url: str = "") -> None:
    """Append appid|name|img_url to loaded app tracking file."""
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        if not img_url and tracking_file.exists():
            for line in tracking_file.read_text().splitlines():
                line = line.strip()
                if line.startswith(f"{appid}|"):
                    parts = line.split("|", 2)
                    if len(parts) > 2:
                        img_url = parts[2]
                    break
        name = _sanitize_title(name)
        if img_url:
            entry = f"{appid}|{name}|{img_url}"
        elif name:
            entry = f"{appid}|{name}"
        else:
            entry = str(appid)
        lines = []
        if tracking_file.exists():
            lines = tracking_file.read_text().splitlines()
        appid_str = str(appid)
        lines = [ln for ln in lines if not (ln.strip() == appid_str or ln.strip().startswith(f"{appid_str}|"))]
        lines.append(entry)
        with tracking_file.open("w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception:
        pass
```

Key changes:
- Line 384: `appid:` → `appid|`
- Line 385: `split(":", 2)` → `split("|", 2)`
- Line 389: `name = _sanitize_title(name)` added
- Lines 390–394: `:` delimiter → `|` delimiter in format strings
- Line 399: `appid:` prefix filter → `appid|` prefix filter

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `python -m pytest tests/ -v`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: switch _track_installed() to pipe delimiter with title sanitization"
```

---

### Task 3: Update `get_installed_apps()` to parse `|` delimiter

**Files:**
- Modify: `backend/downloads.py` — `get_installed_apps()` (lines 415–443)

- [ ] **Step 1: Rewrite `get_installed_apps()`**

Replace the entire `get_installed_apps` function (lines 415–443) with:

```python
def get_installed_apps() -> list[dict[str, Any]]:
    """Return list of installed app IDs from the tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return []
    lua_dir = get_lua_dir(steam_path)
    tracking_file = lua_dir / "loadedappids.txt"
    if not tracking_file.exists():
        return []

    apps = []
    for line in tracking_file.read_text().splitlines():
        parsed = _parse_tracking_line(line)
        if parsed is not None:
            apps.append(parsed)
    return apps
```

Key changes:
- Extracted parsing logic to `_parse_tracking_line()` helper (Task 1)
- `get_installed_apps()` now delegates to `_parse_tracking_line()` for each line

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `python -m pytest tests/ -v`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: switch get_installed_apps() to pipe delimiter parsing"
```

---

### Task 4: Update `_remove_loaded_app()` to use `|` delimiter

**Files:**
- Modify: `backend/downloads.py` — `_remove_loaded_app()` (lines 446–460)

- [ ] **Step 1: Rewrite `_remove_loaded_app()`**

Replace the entire `_remove_loaded_app` function (lines 446–460) with:

```python
def _remove_loaded_app(appid: int) -> None:
    """Remove appid from the loaded app tracking file."""
    steam_path = get_steam_path()
    if not steam_path:
        return
    tracking_file = get_lua_dir(steam_path) / "loadedappids.txt"
    if not tracking_file.exists():
        return
    lines = tracking_file.read_text().splitlines()
    prefix = f"{appid}|"
    new_lines = [line for line in lines if not line.strip().startswith(prefix)]
    new_lines = [line for line in new_lines if line.strip() != str(appid)]
    if len(new_lines) != len(lines):
        tracking_file.write_text("\n".join(new_lines) + "\n")
```

Key change:
- Line 456: `f"{appid}:"` → `f"{appid}|"`

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `python -m pytest tests/ -v`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: switch _remove_loaded_app() to pipe delimiter"
```

---

### Task 5: Add tests for `_sanitize_title()` and pipe delimiter parsing

**Files:**
- Create: `tests/test_tracking.py`

- [ ] **Step 1: Write the test file**

```python
"""Tests for loadedappids.txt tracking — sanitization and pipe delimiter parsing."""

from __future__ import annotations

import tempfile
from pathlib import Path

from backend.downloads import _sanitize_title, _parse_tracking_line, _track_installed


class TestSanitizeTitle:
    """Tests for _sanitize_title()."""

    def test_plain_title(self):
        assert _sanitize_title("Portal 2") == "Portal 2"

    def test_unicode_symbols(self):
        """Preserves ®, ™, é, etc."""
        assert _sanitize_title("LEGO® Batman™") == "LEGO® Batman™"

    def test_strips_pipe_delimiter(self):
        """Pipe must be stripped to prevent format injection."""
        assert _sanitize_title("Game|Name") == "GameName"

    def test_strips_control_characters(self):
        assert _sanitize_title("Game\x00Name\x1f") == "GameName"

    def test_strips_null_byte(self):
        assert _sanitize_title("Game\x00") == "Game"

    def test_collapses_multiple_spaces(self):
        assert _sanitize_title("Game   Name   Here") == "Game Name Here"

    def test_strips_leading_trailing_whitespace(self):
        assert _sanitize_title("  Game Name  ") == "Game Name"

    def test_colon_preserved(self):
        """Colons are fine in titles — the delimiter is now pipe."""
        assert _sanitize_title("LEGO® Batman™: Legacy") == "LEGO® Batman™: Legacy"

    def test_empty_string(self):
        assert _sanitize_title("") == ""

    def test_only_whitespace(self):
        assert _sanitize_title("   ") == ""

    def test_only_control_chars(self):
        assert _sanitize_title("\x00\x01\x02") == ""


class TestParseTrackingLine:
    """Tests for _parse_tracking_line() — the pipe-delimited parser."""

    def test_full_format_with_url(self):
        result = _parse_tracking_line("2215200|LEGO® Batman™|https://example.com/capsule.jpg")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™",
            "img_url": "https://example.com/capsule.jpg",
        }

    def test_name_only(self):
        result = _parse_tracking_line("2215200|LEGO® Batman™")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™",
            "img_url": "",
        }

    def test_legacy_bare_appid(self):
        result = _parse_tracking_line("2215200")
        assert result == {
            "appid": 2215200,
            "name": "",
            "img_url": "",
        }

    def test_empty_line(self):
        assert _parse_tracking_line("") is None

    def test_whitespace_only(self):
        assert _parse_tracking_line("   ") is None

    def test_name_with_colon(self):
        """Colons in names are preserved — pipe is the delimiter."""
        result = _parse_tracking_line("2215200|LEGO® Batman™: Legacy|https://example.com/img.jpg")
        assert result == {
            "appid": 2215200,
            "name": "LEGO® Batman™: Legacy",
            "img_url": "https://example.com/img.jpg",
        }

    def test_url_with_query_params(self):
        result = _parse_tracking_line("2215200|Game|https://example.com/img.jpg?t=123456")
        assert result["img_url"] == "https://example.com/img.jpg?t=123456"


class TestTrackingRoundTrip:
    """Tests that write → read round-trips correctly via _track_installed + get_installed_apps."""

    def _make_temp_dir(self) -> Path:
        return Path(tempfile.mkdtemp())

    def test_write_and_read_back(self):
        lua_dir = self._make_temp_dir()
        _track_installed(2215200, lua_dir, "LEGO® Batman™: Legacy", "https://example.com/img.jpg")
        # get_installed_apps() reads from steam_path, so test the file content directly
        content = (lua_dir / "loadedappids.txt").read_text(encoding="utf-8")
        assert "|" in content
        assert "2215200|LEGO® Batman™: Legacy|https://example.com/img.jpg" in content

    def test_write_and_read_parse(self):
        """Write with _track_installed, read back with _parse_tracking_line."""
        lua_dir = self._make_temp_dir()
        _track_installed(456, lua_dir, "Game: Subtitle", "https://cdn.example.com/456.jpg")
        content = (lua_dir / "loadedappids.txt").read_text(encoding="utf-8")
        line = content.strip().splitlines()[0]
        parsed = _parse_tracking_line(line)
        assert parsed == {
            "appid": 456,
            "name": "Game: Subtitle",
            "img_url": "https://cdn.example.com/456.jpg",
        }
```

- [ ] **Step 2: Run the new tests**

Run: `python -m pytest tests/test_tracking.py -v`
Expected: All tests pass.

- [ ] **Step 3: Run all tests to verify no regression**

Run: `python -m pytest tests/ -v`
Expected: All tests pass (37 existing + new tracking tests).

- [ ] **Step 4: Commit**

```bash
git add tests/test_tracking.py
git commit -m "test: add tests for pipe delimiter and title sanitization"
```

---

### Task 6: Handle existing `:` -delimited files on first read (optional — clean slate)

**Note:** Since backward compatibility is not required, existing `loadedappids.txt` files with `:` delimiters will not parse correctly after this change. Users should delete their existing `loadedappids.txt` file or let the plugin recreate it.

- [ ] **Step 1: No code changes needed.** Document in the commit message that existing tracking files should be deleted.

- [ ] **Step 2: Commit the final state**

```bash
git add -A
git commit -m "feat: switch loadedappids.txt to pipe delimiter, sanitize game titles

BREAKING: Existing loadedappids.txt files using colon delimiter will
not parse correctly. Delete the file and let the plugin recreate it."
```
