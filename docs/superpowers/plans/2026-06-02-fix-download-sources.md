# Fix Download Source URLs & Error Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 incorrect API source URLs in the manifest module and add per-source failure tracking so users see WHY each source failed instead of a vague "All download sources unavailable" error.

**Architecture:** Two-file change — `api_manifest.py` gets corrected URLs matching the original Millennium plugin's `api.json`; `downloads.py` adds a `failures` list during source iteration and a `_format_failure_message()` helper to construct an informative error string including HTTP reason phrases.

**Tech Stack:** Python 3.11+, httpx, pytest

---

### File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/api_manifest.py:12-15` | Modify | Fix manifest fetch URLs |
| `backend/api_manifest.py:92-123` | Modify | Fix hardcoded default source URLs |
| `backend/downloads.py:140-151` (after _substitute_url) | Modify | Add `_format_failure_message()` helper |
| `backend/downloads.py:196-303` | Modify | Track per-source failures in `download_lua()` loop |
| `tests/test_downloads.py` | Modify | Add tests for `_format_failure_message` |
| `tests/test_api_manifest.py` | Modify | Update default sources test to assert correct URLs |

---

### Task 1: Fix Manifest Fetch URLs

**Files:**
- Modify: `backend/api_manifest.py:12-15`

- [ ] **Step 1: Update `_API_MANIFEST_URL`**

The GitHub raw URL points to a non-existent file `api_links.json`. The correct endpoint is `load_free_manifest_apis`.

Replace line 12-13:
```python
_API_MANIFEST_URL = (
    "https://raw.githubusercontent.com/madoiscool/lt_api_links/refs/heads/main/api_links.json"
)
```

With:
```python
_API_MANIFEST_URL = (
    "https://raw.githubusercontent.com/madoiscool/lt_api_links/refs/heads/main/load_free_manifest_apis"
)
```

- [ ] **Step 2: Update `_API_MANIFEST_PROXY_URL`**

The Vercel deployment `lt-api-links.vercel.app` is gone. The correct proxy is `luatools.vercel.app` with the `load_free_manifest_apis` path.

Replace line 15:
```python
_API_MANIFEST_PROXY_URL = "https://lt-api-links.vercel.app/api_links.json"
```

With:
```python
_API_MANIFEST_PROXY_URL = "https://luatools.vercel.app/load_free_manifest_apis"
```

- [ ] **Step 3: Verify syntax**

Run: `pwsh -NoProfile -Command "python -c 'from backend.api_manifest import _API_MANIFEST_URL, _API_MANIFEST_PROXY_URL; print(_API_MANIFEST_URL); print(_API_MANIFEST_PROXY_URL)'"`

Expected: Both URLs print without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/api_manifest.py
git commit -m "fix: correct manifest fetch URLs to match Millennium source"
```

---

### Task 2: Fix Hardcoded Default Source URLs

**Files:**
- Modify: `backend/api_manifest.py:92-123`

All four source URLs in `_get_default_sources()` are wrong. Replace them with the URLs from the original Millennium `api.json`.

- [ ] **Step 1: Fix Morrenus URL**

Replace lines 95-99:
```python
        {
            "name": "Morrenus",
            "url": "https://morrenus.xyz/morrenus/api/<appid>/lua/download?key=<moapikey>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

With:
```python
        {
            "name": "Morrenus",
            "url": "https://hubcapmanifest.com/api/v1/manifest/<appid>?api_key=<moapikey>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

- [ ] **Step 2: Fix Ryuu URL**

Replace lines 101-106:
```python
        {
            "name": "Ryuu",
            "url": "http://167.235.229.108/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

With:
```python
        {
            "name": "Ryuu",
            "url": "http://167.235.229.108/<appid>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

- [ ] **Step 3: Fix TwentyTwo Cloud URL**

Replace lines 108-113:
```python
        {
            "name": "TwentyTwo Cloud",
            "url": "https://api.22cloud.pw/<appid>/lua",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

With:
```python
        {
            "name": "TwentyTwo Cloud",
            "url": "https://api.twentytwocloud.com/download?appid=<appid>",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

- [ ] **Step 4: Fix Sushi URL**

Replace lines 115-120:
```python
        {
            "name": "Sushi",
            "url": "https://raw.githubusercontent.com/madoiscool/lua-sushi/main/<appid>/<appid>.zip",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

With:
```python
        {
            "name": "Sushi",
            "url": "https://raw.githubusercontent.com/sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/<appid>.zip",
            "enabled": True,
            "success_code": 200,
            "unavailable_code": 404,
        },
```

- [ ] **Step 5: Commit**

```bash
git add backend/api_manifest.py
git commit -m "fix: correct all 4 hardcoded default source URLs to match Millennium api.json"
```

---

### Task 3: Update Default Sources Tests

**Files:**
- Modify: `tests/test_api_manifest.py:58-62`

The existing test only checks source count and names. Extend it to assert the corrected URLs.

- [ ] **Step 1: Rewrite `test_default_sources_has_four_entries`**

Replace lines 58-62:
```python
def test_default_sources_has_four_entries():
    defaults = _get_default_sources()
    assert len(defaults) == 4
    names = {s["name"] for s in defaults}
    assert names == {"Morrenus", "Ryuu", "TwentyTwo Cloud", "Sushi"}
```

With:
```python
def test_default_sources_has_four_entries():
    defaults = _get_default_sources()
    assert len(defaults) == 4

    by_name = {s["name"]: s for s in defaults}
    assert set(by_name.keys()) == {"Morrenus", "Ryuu", "TwentyTwo Cloud", "Sushi"}

    assert by_name["Ryuu"]["url"] == "http://167.235.229.108/<appid>"
    assert by_name["Sushi"]["url"] == (
        "https://raw.githubusercontent.com/sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/<appid>.zip"
    )
    assert by_name["Morrenus"]["url"] == (
        "https://hubcapmanifest.com/api/v1/manifest/<appid>?api_key=<moapikey>"
    )
    assert by_name["TwentyTwo Cloud"]["url"] == (
        "https://api.twentytwocloud.com/download?appid=<appid>"
    )
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pytest tests/test_api_manifest.py::test_default_sources_has_four_entries -v`

Expected: PASS

- [ ] **Step 3: Run full api_manifest test suite**

Run: `pytest tests/test_api_manifest.py -v`

Expected: All 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test_api_manifest.py
git commit -m "test: assert corrected default source URLs in manifest tests"
```

---

### Task 4: Add `_format_failure_message()` Helper

**Files:**
- Modify: `backend/downloads.py` — insert after `_substitute_url` (line ~151)

Extract the failure message formatting into a pure function so it's testable without the Decky runtime.

- [ ] **Step 1: Add the helper function**

Insert after the `_substitute_url` function (after line 151), before the `download_lua` function:
```python
def _format_failure_message(failures: list[str]) -> str:
    """Build a detailed error message from per-source failure reasons."""
    if not failures:
        return "All download sources unavailable"
    detail = "; ".join(failures)
    return f"All download sources unavailable: {detail}"
```

- [ ] **Step 2: Verify syntax**

Run: `pwsh -NoProfile -Command "python -c 'from backend.downloads import _format_failure_message; print(_format_failure_message([\"A (404)\", \"B (403)\"]))'"`

Expected: Prints `All download sources unavailable: A (404); B (403)`

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: add _format_failure_message helper for per-source error reporting"
```

---

### Task 5: Write Tests for `_format_failure_message()`

**Files:**
- Modify: `tests/test_downloads.py`

- [ ] **Step 1: Add test class**

Append to `tests/test_downloads.py` (after line 17):
```python


class TestFormatFailureMessage:
    def test_single_failure(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message(["Sushi (404 Not Found)"])
        assert result == "All download sources unavailable: Sushi (404 Not Found)"

    def test_multiple_failures(self):
        from backend.downloads import _format_failure_message
        failures = [
            "Morrenus (no API key)",
            "Ryuu (403 Forbidden)",
            "TwentyTwo Cloud (connection failed)",
            "Sushi (404 Not Found)",
        ]
        result = _format_failure_message(failures)
        expected = (
            "All download sources unavailable: "
            "Morrenus (no API key); Ryuu (403 Forbidden); "
            "TwentyTwo Cloud (connection failed); Sushi (404 Not Found)"
        )
        assert result == expected

    def test_empty_failures_fallback(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message([])
        assert result == "All download sources unavailable"

    def test_http_reason_phrase_included(self):
        from backend.downloads import _format_failure_message
        result = _format_failure_message(["TestSource (503 Service Unavailable)"])
        assert "503" in result
        assert "Service Unavailable" in result
```

- [ ] **Step 2: Run the new tests**

Run: `pytest tests/test_downloads.py::TestFormatFailureMessage -v`

Expected: 4 tests PASS

- [ ] **Step 3: Run full downloads test suite**

Run: `pytest tests/test_downloads.py -v`

Expected: All 7 tests pass (3 existing + 4 new).

- [ ] **Step 4: Commit**

```bash
git add tests/test_downloads.py
git commit -m "test: add unit tests for _format_failure_message helper"
```

---

### Task 6: Integrate Failure Tracking into `download_lua()`

**Files:**
- Modify: `backend/downloads.py:196-303`

Add a `failures` list at the start of the source loop and append a reason string at each failure point. Replace the hardcoded final error message with `_format_failure_message(failures)`.

- [ ] **Step 1: Add `failures` list before the source loop**

After line 208 (`async with httpx.AsyncClient(...) as client:`) and before line 210 (`for src in all_sources:`), insert:

```python
        failures: list[str] = []
```

- [ ] **Step 2: Track API key skip failure**

Replace line 221:
```python
            if "<moapikey>" in template and not api_key:
                continue
```

With:
```python
            if "<moapikey>" in template and not api_key:
                failures.append(f"{name} (no API key)")
                continue
```

- [ ] **Step 3: Track HTTP status failures**

Replace lines 234-237:
```python
                if code == unavailable_code:
                    continue
                if code != success_code:
                    continue
```

With:
```python
                if code == unavailable_code or code != success_code:
                    reason = resp.reason_phrase or f"HTTP {code}"
                    failures.append(f"{name} ({code} {reason})")
                    continue
```

- [ ] **Step 4: Track invalid ZIP failure**

Replace line 258:
```python
                    continue  # Not a zip file, try next source
```

With:
```python
                    failures.append(f"{name} (invalid file)")
                    continue  # Not a zip file, try next source
```

- [ ] **Step 5: Track no .lua found failure**

After line 270 (`result = _extract_and_install(appid, zip_path, lua_dir)`) and before line 271 (`if result:`), the `continue` at line 292 handles the `None` case. Replace lines 291-292:
```python
                # Source succeeded but no lua found — try next
                continue
```

With:
```python
                # Source succeeded but no lua found — try next
                failures.append(f"{name} (no .lua found)")
                continue
```

- [ ] **Step 6: Track connection/exception failures**

Replace line 294-295:
```python
            except Exception:
                continue  # Try next source
```

With:
```python
            except Exception:
                failures.append(f"{name} (connection failed)")
                continue  # Try next source
```

- [ ] **Step 7: Replace final error message**

Replace lines 297-301:
```python
    # All sources failed
    await decky.emit("download_progress", task_id, {
        "task_id": task_id, "phase": "error",
        "percent": 0, "message": "All download sources unavailable",
    })
```

With:
```python
    # All sources failed — emit detailed error
    await decky.emit("download_progress", task_id, {
        "task_id": task_id, "phase": "error",
        "percent": 0, "message": _format_failure_message(failures),
    })
```

- [ ] **Step 8: Verify syntax and imports**

Run: `pwsh -NoProfile -Command "python -c 'from backend.downloads import download_lua, _format_failure_message; print(\"imports ok\")'"`

Expected: `imports ok`

- [ ] **Step 9: Run full test suite**

Run: `pytest tests/ -v`

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/downloads.py
git commit -m "feat: track per-source failure reasons in download_lua for detailed error messages"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pytest tests/ -v`

Expected: All tests pass.

- [ ] **Step 2: Verify build**

Run: `pnpm run build` (or the project's build command)

Expected: Build succeeds without errors.

- [ ] **Step 3: Check git status**

Run: `git status`

Expected: Working tree clean.

- [ ] **Step 4: Review diff summary**

Run: `git diff --stat HEAD~6..HEAD`

Expected: 4 files changed, ~40 insertions, ~15 deletions.
