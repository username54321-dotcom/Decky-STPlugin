# Fix Unicode Mojibake in loadedappids.txt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix garbled Unicode characters (™, ©, ®, etc.) in the loadedappids.txt tracking file by fixing both the API response decoding and file I/O encoding.

**Architecture:** Three-layer fix: (1) force UTF-8 on all httpx JSON responses to prevent new corruption, (2) add a CP1252-based mojibake repair utility that reverses existing corrupted data, (3) ensure all file reads use explicit UTF-8 encoding. Defense-in-depth — each layer independently prevents corruption.

**Root cause:** When httpx fetches JSON from APIs, if the server's Content-Type header doesn't specify `charset=utf-8`, httpx may decode the UTF-8 response bytes using CP1252 (Windows default). This turns multi-byte UTF-8 chars like ™ (E2 84 A2) into garbled CP1252 sequences (â„¢). These get written to the file as UTF-8, creating mojibake. On read, the file is also read without explicit encoding, defaulting to CP1252 on Windows — double corruption.

**Tech Stack:** Python 3.10+, httpx, pytest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/downloads.py` | Modify | All encoding fixes live here |
| `tests/test_tracking.py` | Modify | Add mojibake repair tests |

---

## Task 1: Add `_fix_mojibake` utility function

**Files:**
- Modify: `backend/downloads.py` (after `_sanitize_title`, ~line 382)
- Test: `tests/test_tracking.py`

- [ ] **Step 1: Write failing tests for mojibake repair**

Add a new test class at the end of `tests/test_tracking.py`:

```python
class TestFixMojibake:
    """Tests for _fix_mojibake() — reverses CP1252/UTF-8 mojibake."""

    def test_clean_text_unchanged(self):
        """Normal Unicode text passes through untouched."""
        from backend.downloads import _fix_mojibake
        assert _fix_mojibake("LEGO\u00ae Batman\u2122") == "LEGO\u00ae Batman\u2122"

    def test_ascii_unchanged(self):
        """Pure ASCII passes through untouched."""
        from backend.downloads import _fix_mojibake
        assert _fix_mojibake("Slay the Spire 2") == "Slay the Spire 2"

    def test_reverses_single_mojibake_registered(self):
        """Reverses ® mojibake: UTF-8 bytes C2 AE read as CP1252 → Â®."""
        from backend.downloads import _fix_mojibake
        # ® → UTF-8 C2 AE → CP1252 Â® → UTF-8 C3 82 C2 AE
        mojibake = "\u00c2\u00ae"  # Â®
        assert _fix_mojibake(mojibake) == "\u00ae"  # ®

    def test_reverses_single_mojibake_trademark(self):
        """Reverses ™ mojibake: UTF-8 bytes E2 84 A2 read as CP1252 → â„¢."""
        from backend.downloads import _fix_mojibake
        # ™ → UTF-8 E2 84 A2 → CP1252 â„¢ → UTF-8 C3 A2 E2 80 9E C2 A2
        mojibake = "\u00e2\u201e\u00a2"  # â„¢
        assert _fix_mojibake(mojibake) == "\u2122"  # ™

    def test_reverses_single_mojibake_copyright(self):
        """Reverses © mojibake: UTF-8 bytes C2 A9 read as CP1252 → Â©."""
        from backend.downloads import _fix_mojibake
        mojibake = "\u00c2\u00a9"  # Â©
        assert _fix_mojibake(mojibake) == "\u00a9"  # ©

    def test_reverses_double_mojibake(self):
        """Reverses double mojibake (2 rounds of encoding corruption)."""
        from backend.downloads import _fix_mojibake
        original = "\u00ae"  # ®
        # Simulate double mojibake: UTF-8→CP1252→UTF-8→CP1252→UTF-8
        round1 = original.encode("utf-8").decode("cp1252")
        round2 = round1.encode("utf-8").decode("cp1252")
        assert _fix_mojibake(round2) == original

    def test_reverses_triple_mojibake(self):
        """Reverses triple mojibake (3 rounds of encoding corruption)."""
        from backend.downloads import _fix_mojibake
        original = "\u00ae"  # ®
        text = original
        for _ in range(3):
            text = text.encode("utf-8").decode("cp1252")
        assert _fix_mojibake(text) == original

    def test_mixed_clean_and_garbled(self):
        """Text with some clean and some garbled chars."""
        from backend.downloads import _fix_mojibake
        garbled_tm = "\u00e2\u201e\u00a2"  # â„¢ (mojibake of ™)
        text = f"Batman{garbled_tm}"
        assert _fix_mojibake(text) == "Batman\u2122"  # Batman™

    def test_full_game_title_mojibake(self):
        """Reverses mojibake in a realistic game title."""
        from backend.downloads import _fix_mojibake
        # Build "LEGO® Batman™" with mojibake
        original = "LEGO\u00ae Batman\u2122"
        mojibake = original.encode("utf-8").decode("cp1252")
        assert _fix_mojibake(mojibake) == original

    def test_empty_string(self):
        from backend.downloads import _fix_mojibake
        assert _fix_mojibake("") == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_tracking.py::TestFixMojibake -v`
Expected: FAIL with `ImportError: cannot import name '_fix_mojibake'`

- [ ] **Step 3: Implement `_fix_mojibake` in `backend/downloads.py`**

Add this function after `_sanitize_title` (after line 381):

```python
def _fix_mojibake(text: str) -> str:
    """Detect and reverse CP1252/UTF-8 mojibake.

    When UTF-8 bytes are misinterpreted as CP1252 (Windows codepage) and
    then re-encoded as UTF-8, multi-byte characters become garbled. For
    example, ™ (U+2122, UTF-8 bytes E2 84 A2) becomes â„¢ (â + „ + ¢)
    when those bytes are read as CP1252.

    This reversal works by encoding the text back to CP1252 bytes (which
    recovers the original UTF-8 byte sequence) and decoding as UTF-8.

    Handles multiple rounds of corruption (double, triple mojibake) via
    a loop that stabilizes when no further reversal is possible.
    """
    if not text:
        return text
    current = text
    for _ in range(5):  # Max 5 rounds of reversal
        try:
            # Encode as CP1252 to recover original UTF-8 bytes,
            # then decode as UTF-8 to get the correct text.
            recovered = current.encode("cp1252").decode("utf-8")
            if recovered == current:
                return current  # No change — text is clean
            current = recovered
        except (UnicodeDecodeError, UnicodeEncodeError):
            # If encoding/decoding fails, the current text is the best we can do
            break
    return current
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_tracking.py::TestFixMojibake -v`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/downloads.py tests/test_tracking.py
git commit -m "fix: add _fix_mojibake utility for reversing CP1252/UTF-8 mojibake"
```

---

## Task 2: Fix API response encoding (prevent new corruption)

**Files:**
- Modify: `backend/downloads.py` — `_load_applist()` (line ~83) and `resolve_app_name()` (line ~123)

- [ ] **Step 1: Fix `_load_applist` — force UTF-8 on applist response**

In `backend/downloads.py`, in the `_load_applist()` function, change:

```python
resp = await client.get(_APPLIST_URL, follow_redirects=True)
resp.raise_for_status()
data = resp.json()
```

to:

```python
resp = await client.get(_APPLIST_URL, follow_redirects=True)
resp.raise_for_status()
resp.encoding = "utf-8"
data = resp.json()
```

- [ ] **Step 2: Fix `resolve_app_name` — force UTF-8 on Steam Store API response**

In `backend/downloads.py`, in the `resolve_app_name()` function, change:

```python
resp = await client.get(url, follow_redirects=True)
resp.raise_for_status()
data = resp.json()
```

to:

```python
resp = await client.get(url, follow_redirects=True)
resp.raise_for_status()
resp.encoding = "utf-8"
data = resp.json()
```

- [ ] **Step 3: Apply `_fix_mojibake` to names from applist**

In `_load_applist()`, change:

```python
_applist_data[int(appid_str)] = str(name)
```

to:

```python
_applist_data[int(appid_str)] = _fix_mojibake(str(name))
```

- [ ] **Step 4: Apply `_fix_mojibake` to names from Steam Store API**

In `resolve_app_name()`, after `name = name.strip()` (inside the Steam Store API block), add:

```python
name = _fix_mojibake(name)
```

- [ ] **Step 5: Commit**

```bash
git add backend/downloads.py
git commit -m "fix: force UTF-8 on API responses and apply mojibake repair to app names"
```

---

## Task 3: Fix file read encoding and repair existing data

**Files:**
- Modify: `backend/downloads.py` — 4 `read_text()` calls + `_parse_tracking_line()`

- [ ] **Step 1: Fix all 4 `read_text()` calls to use explicit UTF-8**

In `backend/downloads.py`, change every `tracking_file.read_text()` (without encoding) to `tracking_file.read_text(encoding="utf-8")`.

Locations:
1. `_track_installed()` line ~411: `tracking_file.read_text()` → `tracking_file.read_text(encoding="utf-8")`
2. `_track_installed()` line ~427: `tracking_file.read_text()` → `tracking_file.read_text(encoding="utf-8")`
3. `get_installed_apps()` line ~456: `tracking_file.read_text()` → `tracking_file.read_text(encoding="utf-8")`
4. `_remove_loaded_app()` line ~471: `tracking_file.read_text()` → `tracking_file.read_text(encoding="utf-8")`

- [ ] **Step 2: Apply `_fix_mojibake` to names in `_parse_tracking_line`**

In `_parse_tracking_line()`, after `name = parts[1] if len(parts) > 1 else ""`, add:

```python
name = _fix_mojibake(name)
```

This repairs existing corrupted data in the file when it's read.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `pytest tests/test_tracking.py -v`
Expected: All existing tests still PASS (the write tests already use `encoding="utf-8"` to read back).

- [ ] **Step 4: Run full test suite**

Run: `pytest tests/ -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/downloads.py
git commit -m "fix: use explicit UTF-8 for all file reads and repair mojibake on parse"
```

---

## Task 4: Verify end-to-end with real mojibake data

**Files:**
- Modify: `tests/test_tracking.py` — add integration test

- [ ] **Step 1: Add round-trip test with mojibake data**

Add to `tests/test_tracking.py`:

```python
class TestMojibakeRoundTrip:
    """Integration test: write garbled data, read it back repaired."""

    def test_read_repairs_existing_mojibake_file(self, tmp_path):
        """Simulate a file with CP1252 mojibake and verify repair on read."""
        from backend.downloads import get_installed_apps
        import backend.steam_paths as sp

        # Build mojibake: "LEGO® Batman™" mangled through UTF-8→CP1252
        original = "LEGO\u00ae Batman\u2122"
        garbled = original.encode("utf-8").decode("cp1252")

        tracking_file = tmp_path / "loadedappids.txt"
        tracking_file.write_text(
            f"2215200|{garbled}|https://example.com/img.jpg\n",
            encoding="utf-8",
        )

        # Monkey-patch path resolution to use our temp dir
        orig_get_steam = sp.get_steam_path
        orig_get_lua = sp.get_lua_dir
        sp.get_steam_path = lambda: str(tmp_path)
        sp.get_lua_dir = lambda p: tmp_path
        try:
            apps = get_installed_apps()
            assert len(apps) == 1
            assert apps[0]["name"] == original
        finally:
            sp.get_steam_path = orig_get_steam
            sp.get_lua_dir = orig_get_lua
```

- [ ] **Step 2: Run test**

Run: `pytest tests/test_tracking.py::TestMojibakeRoundTrip -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_tracking.py
git commit -m "test: add mojibake round-trip integration test"
```
