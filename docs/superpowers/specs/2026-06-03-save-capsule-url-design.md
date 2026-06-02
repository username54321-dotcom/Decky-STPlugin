# Save Capsule Image URL at Install Time

**Date:** 2026-06-03  
**Status:** Approved  
**Scope:** Fix broken capsule images in installed apps page + persist image URLs

## Problem

The InstalledAppCard constructs capsule URLs using `cdn.akamai.steamstatic.com`, which fails in Steam's embedded Chromium browser. The working GameSearchDropdown uses `cdn.cloudflare.steamstatic.com` (via the Steam suggest API), but that URL is discarded — never saved or passed to the download flow.

## Solution

Persist the capsule image URL from the Steam search API into the tracking file at install time. Use the saved URL for display; fall back to constructing a Cloudflare CDN URL for legacy entries.

## Tracking File Format

**Current:** `appid:name`  
**New:** `appid:name:image_url`

Parsing uses `split(":", maxsplit=2)` for safety (name could theoretically contain colons).

Example:
```
730:Counter-Strike 2:https://cdn.cloudflare.steamstatic.com/steam/apps/730/capsule_sm_120.jpg
440:Team Fortress 2:https://cdn.cloudflare.steamstatic.com/steam/apps/440/capsule_sm_120.jpg
570:legacy entry without image
```

## Data Flow

```
User searches → GameSearchResult { id, name, img }
    ↓
User selects → DownloadForm stores result.img
    ↓
User clicks download → onStart(appid, source, imgUrl)
    ↓
useDownloadLifecycle.start(appid, source, imgUrl)
    ↓
callable → Plugin.start_download(appid, api_source, img_url)
    ↓
download_lua(task_id, appid, api_source, api_key, img_url)
    ↓
_track_installed(appid, lua_dir, name, img_url)
    ↓
writes: "appid:name:img_url" to loadedappids.txt
    ↓
get_installed_apps() → returns [{ appid, name, img_url }]
    ↓
InstalledAppCard uses saved img_url
```

## Fallback Strategy

| Scenario | Image Source |
|----------|-------------|
| Has saved `img_url` | Use saved URL |
| No saved URL (legacy or URL download) | Construct `https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/capsule_sm_120.jpg` |
| Image load error | `FaGamepad` icon (existing behavior) |
| Re-download from InstalledAppCard | Keep existing saved URL (don't overwrite) |

## Files to Modify

### 1. `backend/downloads.py`

**`_track_installed`** — add `img_url` parameter:
```python
def _track_installed(appid: int, lua_dir: Path, name: str = "", img_url: str = "") -> None:
    # Format: appid:name:img_url
    if img_url:
        entry = f"{appid}:{name}:{img_url}"
    elif name:
        entry = f"{appid}:{name}"
    else:
        entry = str(appid)
```

**`get_installed_apps`** — parse 3-part format:
```python
parts = line.split(":", 2)  # maxsplit=2
appid = int(parts[0])
name = parts[1] if len(parts) > 1 else ""
img_url = parts[2] if len(parts) > 2 else ""
apps.append({"appid": appid, "name": name, "img_url": img_url})
```

**`download_lua`** — accept and forward `img_url`:
```python
async def download_lua(task_id, appid, api_source="", api_key="", img_url=""):
    # ...
    _track_installed(appid, lua_dir, app_name, img_url)
```

### 2. `main.py`

**`start_download`** — accept optional `img_url`:
```python
async def start_download(self, appid: int, api_source: str = "", img_url: str = "") -> str:
    # pass img_url to download_lua
```

**`start_download_from_url`** — pass empty `img_url` (no search context):
```python
_track_installed(appid, lua_dir, app_name, "")
```

### 3. `src/shared/types.ts`

**`InstalledApp`** — add optional field:
```typescript
export interface InstalledApp {
  appid: number;
  name: string;
  img_url?: string;
}
```

### 4. `src/download/DownloadForm.tsx`

Store selected result's `img` URL and pass to `onStart`:
```typescript
const [selectedImg, setSelectedImg] = useState("");

const handleSearchSelect = (result: GameSearchResult) => {
  setAppidInput(String(result.id));
  setResolvedName(result.name);
  setSelectedImg(result.img);  // ← capture image URL
  setSearchOpen(false);
  setSearchQuery("");
};

const handleStart = () => {
  const id = parseInt(appidInput);
  if (isNaN(id) || id <= 0) return;
  const source = fastDownload ? "" : selectedSource;
  onStart(id, source, selectedImg);  // ← pass image URL
  setSelectedImg("");  // reset
};
```

Update `DownloadFormProps`:
```typescript
interface DownloadFormProps {
  onStart: (appid: number, source?: string, imgUrl?: string) => void;
}
```

### 5. `src/download/hooks/useDownloadLifecycle.ts`

Accept and forward `imgUrl`:
```typescript
const start = useCallback(async (appid: number, source?: string, imgUrl?: string) => {
  const taskId = await startDownload(appid, source, imgUrl);  // ← pass through
  // ...
}, []);
```

Update callable signature:
```typescript
const startDownload = callable<[number, string?, string?], string>("start_download");
```

### 6. `src/installed/InstalledAppCard.tsx`

Use saved URL with Cloudflare fallback:
```typescript
const capsuleUrl = app.img_url
  || `https://cdn.cloudflare.steamstatic.com/steam/apps/${app.appid}/capsule_sm_120.jpg`;
```

Remove the hardcoded Akamai CDN URL.

## Backward Compatibility

- Legacy `appid` entries (plain integer) → `img_url` = `""` → fallback CDN construction
- Legacy `appid:name` entries → `img_url` = `""` → fallback CDN construction
- Existing `loadedappids.txt` files work without migration
- Re-downloads preserve existing saved URL (don't overwrite)
