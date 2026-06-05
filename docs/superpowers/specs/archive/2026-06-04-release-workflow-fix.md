# Release Workflow Fix — Design Spec

## Problem

The plugin doesn't show up in Decky Loader after installation from GitHub release. Root causes:

1. **Wrong ZIP structure** — Release ZIP has flat layout (`main.py` at root), but Decky expects nested layout (`STPlugin/main.py` inside a subdirectory).
2. **Missing Python dependency** — `httpx` is not bundled in `py_modules/`. Decky's sandboxed Python environment doesn't have it, causing `ImportError` on plugin load.
3. **`py_modules/` not copied** — Release workflow doesn't include the `py_modules/` directory in the ZIP.

## Solution

Rework the release process: **build locally → push tag → GitHub workflow creates release from the same build steps**.

### New Release Flow

```
Developer runs:  pnpm run release:patch
                        │
                        ▼
            ┌───────────────────────┐
            │  scripts/release.mjs  │
            │  (local build script) │
            └───────────┬───────────┘
                        │
          1. pnpm run build (frontend)
          2. pip install httpx → py_modules/
          3. Create STPlugin-vX.Y.Z.zip (nested structure)
          4. Verify ZIP structure
          5. git tag vX.Y.Z
          6. git push && git push --tags
                        │
                        ▼
            ┌───────────────────────┐
            │  GitHub Actions       │
            │  release.yml          │
            └───────────┬───────────┘
                        │
          1. Checkout repo
          2. pnpm install + build
          3. pip install httpx → py_modules/
          4. Create ZIP (nested structure)
          5. Create GitHub Release with ZIP
```

Both local and CI use identical build steps, ensuring consistency.

---

## Changes Required

### 1. New file: `scripts/release.mjs`

Local release script that:
- Reads current version from `package.json`
- Runs `pnpm run build` to build frontend
- Runs `pip install --target py_modules httpx` to bundle dependency
- Creates nested ZIP: `STPlugin-vX.Y.Z.zip` containing `STPlugin/` subdirectory
- Verifies ZIP contains required files (`main.py`, `plugin.json`, `dist/index.js`)
- Cleans up `py_modules/httpx*` from working tree after ZIP creation (don't commit build artifacts)
- Bumps version (`pnpm version patch|minor|major`)
- Pushes tag to trigger GitHub workflow

### 2. Modify: `package.json` scripts

```json
{
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w",
    "deploy": "node scripts/deploy.mjs",
    "build:deploy": "rollup -c && node scripts/deploy.mjs",
    "release": "node scripts/release.mjs",
    "release:patch": "node scripts/release.mjs patch",
    "release:minor": "node scripts/release.mjs minor",
    "release:major": "node scripts/release.mjs major"
  }
}
```

Remove old `release:*` scripts that just did `pnpm version` + `git push`.

### 3. Modify: `.github/workflows/release.yml`

Update the "Create plugin ZIP" step to:
- Install httpx into `py_modules/` via `pip install --target`
- Create nested ZIP structure (`STPlugin/` subdirectory)
- Clean up `__pycache__` from both `backend/` and `py_modules/`

```yaml
- name: Install Python dependencies into py_modules
  run: pip install --target py_modules httpx

- name: Create plugin ZIP (nested structure)
  run: |
    mkdir -p release/STPlugin
    cp main.py release/STPlugin/
    cp plugin.json release/STPlugin/
    cp package.json release/STPlugin/
    cp -r backend release/STPlugin/
    cp -r dist release/STPlugin/
    cp -r py_modules release/STPlugin/
    rm -rf release/STPlugin/backend/__pycache__
    rm -rf release/STPlugin/py_modules/__pycache__
    cd release && zip -r ../STPlugin-${{ github.ref_name }}.zip STPlugin/
```

### 4. Modify: `.gitignore`

Add entries to prevent committing build artifacts:

```
# Python dependency bundling (installed during release)
py_modules/httpx/
py_modules/httpx-*.dist-info/
py_modules/anyio/
py_modules/anyio-*.dist-info/
py_modules/certifi/
py_modules/certifi-*.dist-info/
py_modules/h11/
py_modules/h11-*.dist-info/
py_modules/httpcore/
py_modules/httpcore-*.dist-info/
py_modules/idna/
py_modules/idna-*.dist-info/
py_modules/sniffio/
py_modules/sniffio-*.dist-info/

# Release artifacts
STPlugin-*.zip
```

### 5. No changes needed: `backend/auto_update.py`

The `_extract_update()` function (lines 114-120) already handles both flat and nested ZIP structures:

```python
if not (tmp_dir / "main.py").exists() and not (tmp_dir / "package.json").exists():
    subdir = next((d for d in tmp_dir.iterdir() if d.is_dir()), None)
    if subdir and ((subdir / "main.py").exists() or (subdir / "package.json").exists()):
        tmp_dir = subdir
```

This logic correctly detects the `STPlugin/` subdirectory and adjusts the extraction path.

### 6. No changes needed: `scripts/deploy.mjs`

The local deploy script copies files directly to `~/homebrew/plugins/STPlugin/` — no ZIP involved. It's used for local development only.

---

## Expected ZIP Structure (After Fix)

```
STPlugin-v1.0.2.zip
  └── STPlugin/
      ├── main.py
      ├── plugin.json
      ├── package.json
      ├── backend/
      │   ├── __init__.py
      │   ├── api_manifest.py
      │   ├── auto_update.py
      │   ├── downloads.py
      │   └── steam_paths.py
      ├── dist/
      │   └── index.js
      └── py_modules/
          ├── httpx/
          ├── httpx-*.dist-info/
          ├── anyio/
          ├── certifi/
          ├── h11/
          ├── httpcore/
          ├── idna/
          └── sniffio/
```

---

## Verification

After implementation:
1. Run `pnpm run release:patch` — should build, create ZIP, push tag
2. Verify ZIP structure locally: `Expand-Archive STPlugin-vX.Y.Z.zip -DestinationPath test && ls test/STPlugin/`
3. GitHub workflow should trigger and create release with the ZIP
4. Install from ZIP in Decky Loader — plugin should appear and load without errors

---

## Out of Scope

- No changes to `auto_update.py` (already handles nested ZIP)
- No changes to `deploy.mjs` (local dev tool, not related to releases)
- No changes to frontend/backend source code
