# Fix Download Source URLs & Error Reporting — Design Spec

**Date:** 2026-06-02  
**Status:** Draft  
**Bug:** App ID 2868840 errors with "All download sources unavailable"

## Root Cause

Two bugs in `backend/api_manifest.py`:

1. **Manifest fetch URLs are wrong** — both GitHub and Vercel URLs point to non-existent endpoints (`api_links.json` instead of `load_free_manifest_apis`; `lt-api-links.vercel.app` instead of `luatools.vercel.app`). Both return 404, so the plugin **always** falls back to hardcoded defaults.

2. **All 4 hardcoded default source URLs are wrong** — domains, paths, and query parameters don't match the original Millennium plugin's `api.json`. None of the 4 hardcoded sources can actually serve content.

**Secondary issue:** The error message is unhelpful (`"All download sources unavailable"`) — it doesn't tell the user WHY each source failed, making debugging impossible.

## Design

### Part 1: Fix URLs

**File:** `backend/api_manifest.py`

#### Manifest fetch URLs (lines 12-15)

| | Wrong | Right |
|---|---|---|
| GitHub | `.../refs/heads/main/api_links.json` | `.../refs/heads/main/load_free_manifest_apis` |
| Vercel | `lt-api-links.vercel.app/api_links.json` | `luatools.vercel.app/load_free_manifest_apis` |

#### Hardcoded default sources (lines 92-123, `_get_default_sources()`)

| Source | Wrong | Right |
|--------|-------|------|
| Morrenus | `morrenus.xyz/morrenus/api/<appid>/lua/download?key=<moapikey>` | `hubcapmanifest.com/api/v1/manifest/<appid>?api_key=<moapikey>` |
| Ryuu | `167.235.229.108/<appid>/lua` | `167.235.229.108/<appid>` |
| TwentyTwo Cloud | `api.22cloud.pw/<appid>/lua` | `api.twentytwocloud.com/download?appid=<appid>` |
| Sushi | `madoiscool/lua-sushi/main/<appid>/<appid>.zip` | `sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/<appid>.zip` |

All 6 URL changes are direct replacements — no logic changes needed.

### Part 2: Per-Source Error Reporting

**File:** `backend/downloads.py` — `download_lua()` function

#### Problem

The download loop silently `continue`s past every source failure. If all fail, the user sees a single generic message with no indication of what went wrong.

#### Solution

Track failures as `(source_name, reason)` during the source loop. Append them to the final error message.

#### Failure categories and messages

| Failure Condition | Error String |
|------------------|-------------|
| `<moapikey>` in URL but no API key | `"{name} (no API key)"` |
| HTTP status == unavailable_code | `"{name} ({code} {reason_phrase})"` |
| HTTP status != success_code | `"{name} ({code} {reason_phrase})"` |
| ZIP magic bytes invalid | `"{name} (invalid file)"` |
| No .lua found in archive | `"{name} (no .lua found)"` |
| httpx exception (connection/timeout/etc.) | `"{name} (connection failed)"` |

Where `reason_phrase` comes from `resp.reason_phrase` (e.g., "Not Found", "Forbidden").

#### Before/After

**Before:**
```
All download sources unavailable
```

**After:**
```
All download sources unavailable: Morrenus (no API key); Ryuu (403 Forbidden); TwentyTwo Cloud (connection failed); Sushi (404 Not Found)
```

#### Implementation sketch

```python
failures: list[str] = []

for src in all_sources:
    name = src.get("name", "Unknown")
    template = src.get("url", "")
    
    if "<moapikey>" in template and not api_key:
        failures.append(f"{name} (no API key)")
        continue
    
    try:
        resp = await client.get(url)
        code = resp.status_code
        
        if code == unavailable_code or code != success_code:
            reason = resp.reason_phrase or f"HTTP {code}"
            failures.append(f"{name} ({code} {reason})")
            continue
        
        # ... ZIP validation ...
        if magic not in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
            failures.append(f"{name} (invalid file)")
            continue
        
        result = _extract_and_install(appid, zip_path, lua_dir)
        if not result:
            failures.append(f"{name} (no .lua found)")
            continue
        
        # ... success path ...
        
    except Exception:
        failures.append(f"{name} (connection failed)")
        continue

# All sources exhausted — emit detailed error
detail = "; ".join(failures)
await decky.emit("download_progress", task_id, {
    "task_id": task_id, "phase": "error",
    "percent": 0, "message": f"All download sources unavailable: {detail}",
})
```

#### Data flow

```
User enters appid → DownloadPanel calls startDownload()
 → Plugin._run() → download_lua()
  → iterates sources, collects failures list
  → if all fail: emits error event with detail string
  → DownloadPanel listener renders error + toast
```

No new IPC events. No frontend changes. Same `download_progress` event, richer `message` field.

## Impact

| Concern | Assessment |
|---------|-----------|
| **Backward compat** | ✅ None — same event name, same field, just richer string |
| **Frontend changes** | ✅ None — DownloadPanel already shows `message` in toast/error |
| **Test changes** | ⚠️ Need to update `test_manifest.py` if it asserts on URL values |
| **APIs hit** | No new external calls — same count, correct URLs |
| **Risk of breakage** | ✅ Low — URL changes are from verified Millennium source |

## Edge Cases

1. **Single source available** — Works fine, e.g., `"All download sources unavailable: Sushi (404 Not Found)"`
2. **No sources at all** — Existing early check at line 189-194 handles this with "No API sources available" (unchanged)
3. **Steam path not found** — Existing early check at line 172-177 handles this (unchanged)
4. **Cancellation mid-download** — Unchanged, cancellation checks still fire before failure tracking
5. **Empty failures list** — Should never happen (sources are exhausted only if all fail), but safety fallback to original generic message

## Files Modified

| File | Change | Est. lines |
|------|--------|-----------|
| `backend/api_manifest.py` | 6 URL replacements | 6 |
| `backend/downloads.py` | Add `failures` tracking + detailed error message | ~15 |

## Exclusions

- No frontend changes (same IPC contract, richer string)
- No new API calls
- No per-source progress events (deferred — can add later if needed)
- No changes to cancellation logic
- No changes to Steam path detection
