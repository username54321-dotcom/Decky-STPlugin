# Save Capsule Image URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken capsule images in the installed apps page by persisting the Steam CDN image URL at install time and using it for display.

**Architecture:** Extend the `loadedappids.txt` tracking format from `appid:name` to `appid:name:image_url`. Thread the image URL from the frontend search result through the download pipeline to the backend tracking file. On display, use the saved URL with a Cloudflare CDN fallback for legacy entries.

**Tech Stack:** Python (backend), TypeScript/React (frontend), `callable()` IPC

**Spec:** `docs/superpowers/specs/2026-06-03-save-capsule-url-design.md`

---

### Task 1: Update `InstalledApp` type to include `img_url`

**Files:**
- Modify: `src/shared/types.ts:21-24`

- [ ] **Step 1: Add `img_url` field to `InstalledApp`**

```typescript
export interface InstalledApp {
  appid: number;
  name: string;
  img_url?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add img_url to InstalledApp interface"
```

---

### Task 2: Update backend `_track_installed` to save image URL

**Files:**
- Modify: `backend/downloads.py:376-390`

- [ ] **Step 1: Add `img_url` parameter to `_track_installed`**

Replace the function signature and entry formatting:

```python
def _track_installed(appid: int, lua_dir: Path, name: str = "", img_url: str = "") -> None:
    """Append appid:name:img_url to loaded app tracking file."""
    tracking_file = lua_dir / "loadedappids.txt"
    try:
        if img_url:
            entry = f"{appid}:{name}:{img_url}"
        elif name:
            entry = f"{appid}:{name}"
        else:
            entry = str(appid)
        lines = []
        if tracking_file.exists():
            lines = tracking_file.read_text().splitlines()
        appid_str = str(appid)
        lines = [ln for ln in lines if not (ln.strip() == appid_str or ln.strip().startswith(f"{appid_str}:"))]
        lines.append(entry)
        with tracking_file.open("w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception:
        pass
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `pnpm test`
Expected: All existing tests pass (backward compatible change).

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat(backend): save img_url in tracking file"
```

---

### Task 3: Update backend `get_installed_apps` to parse and return `img_url`

**Files:**
- Modify: `backend/downloads.py:401-428`

- [ ] **Step 1: Update parsing logic to handle 3-part format**

Replace the parsing block inside `get_installed_apps`:

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
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            # Format: appid:name or appid:name:img_url
            parts = line.split(":", 2)
            try:
                appid = int(parts[0])
                name = parts[1] if len(parts) > 1 else ""
                img_url = parts[2] if len(parts) > 2 else ""
                apps.append({"appid": appid, "name": name, "img_url": img_url})
            except ValueError:
                continue
        elif line.isdigit():
            # Legacy format: plain appid
            apps.append({"appid": int(line), "name": "", "img_url": ""})
    return apps
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `pnpm test`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/downloads.py
git commit -m "feat(backend): parse img_url from tracking file"
```

---

### Task 4: Thread `img_url` through `download_lua`

**Files:**
- Modify: `backend/downloads.py` — `download_lua` function signature and the `_track_installed` call

- [ ] **Step 1: Add `img_url` parameter to `download_lua`**

Find the `download_lua` function signature (around line 200) and add the parameter:

```python
async def download_lua(task_id: str, appid: int, api_source: str = "", api_key: str = "", img_url: str = "") -> str | None:
```

- [ ] **Step 2: Pass `img_url` to `_track_installed` call**

Find the `_track_installed` call inside `download_lua` (around line 298) and update:

```python
                    _track_installed(appid, lua_dir, app_name, img_url)
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test`
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/downloads.py
git commit -m "feat(backend): thread img_url through download_lua"
```

---

### Task 5: Update `start_download` and `start_download_from_url` in `main.py`

**Files:**
- Modify: `main.py:107-132` (start_download)
- Modify: `main.py:138-182` (start_download_from_url)

- [ ] **Step 1: Add `img_url` parameter to `start_download`**

```python
async def start_download(self, appid: int, api_source: str = "", img_url: str = "") -> str:
```

Update the `download_lua` call inside `_run()`:

```python
await download_lua(task_id, appid, api_source, api_key, img_url)
```

- [ ] **Step 2: Pass empty `img_url` in `start_download_from_url`**

Find the `_track_installed` call in `start_download_from_url` (around line 166) and update:

```python
_track_installed(appid, lua_dir, app_name, "")
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test`
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat(backend): accept img_url in start_download RPC"
```

---

### Task 6: Update `useDownloadLifecycle` to accept and forward `imgUrl`

**Files:**
- Modify: `src/download/hooks/useDownloadLifecycle.ts`

- [ ] **Step 1: Update callable signature and `start` function**

```typescript
const startDownload = callable<[number, string?, string?], string>("start_download");
```

Update the `start` callback:

```typescript
const start = useCallback(async (appid: number, source?: string, imgUrl?: string) => {
  const taskId = await startDownload(appid, source, imgUrl);
  currentTaskIdRef.current = taskId;
  setIsActive(true);
  setState({
    task_id: taskId,
    phase: "fetching_apis",
    percent: 0,
    message: "Starting...",
  });
}, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/download/hooks/useDownloadLifecycle.ts
git commit -m "feat(frontend): pass imgUrl through download lifecycle"
```

---

### Task 7: Update `DownloadForm` to capture and pass image URL

**Files:**
- Modify: `src/download/DownloadForm.tsx`

- [ ] **Step 1: Add state for selected image URL**

After the existing `useState` declarations (around line 28), add:

```typescript
const [selectedImg, setSelectedImg] = useState("");
```

- [ ] **Step 2: Capture image URL in `handleSearchSelect`**

Update `handleSearchSelect`:

```typescript
const handleSearchSelect = (result: GameSearchResult) => {
  setAppidInput(String(result.id));
  setResolvedName(result.name);
  setSelectedImg(result.img);
  setSearchOpen(false);
  setSearchQuery("");
};
```

- [ ] **Step 3: Pass image URL in `handleStart`**

Update `handleStart`:

```typescript
const handleStart = () => {
  const id = parseInt(appidInput);
  if (isNaN(id) || id <= 0) return;

  const source = fastDownload ? "" : selectedSource;
  onStart(id, source, selectedImg);
  setSelectedImg("");
};
```

- [ ] **Step 4: Update `DownloadFormProps` interface**

```typescript
interface DownloadFormProps {
  onStart: (appid: number, source?: string, imgUrl?: string) => void;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/download/DownloadForm.tsx
git commit -m "feat(frontend): pass search img URL to download"
```

---

### Task 8: Update `InstalledAppCard` to use saved URL with fallback

**Files:**
- Modify: `src/installed/InstalledAppCard.tsx:20`

- [ ] **Step 1: Replace hardcoded CDN URL with saved URL + fallback**

Replace line 20:

```typescript
const capsuleUrl = app.img_url || `https://cdn.cloudflare.steamstatic.com/steam/apps/${app.appid}/capsule_sm_120.jpg`;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/installed/InstalledAppCard.tsx
git commit -m "fix(ui): use saved img_url with Cloudflare CDN fallback"
```

---

### Task 9: Run full test suite and verify build

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `pnpm run build`
Expected: Build succeeds, `dist/index.js` produced.

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: verify build after capsule URL changes"
```
