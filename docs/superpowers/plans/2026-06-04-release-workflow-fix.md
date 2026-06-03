# Release Workflow Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the release workflow so plugins install correctly in Decky Loader — correct nested ZIP structure and bundled `httpx` dependency.

**Architecture:** New local `scripts/release.mjs` builds frontend, bundles `httpx` into `py_modules/`, creates nested ZIP, then pushes a tag. GitHub workflow mirrors the same build steps to create the release.

**Tech Stack:** Node.js (release script), Python pip (dependency bundling), GitHub Actions (release workflow)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `scripts/release.mjs` | Create | Local release script — build, bundle, zip, tag, push |
| `package.json` | Modify | Update `release:*` scripts to use new `scripts/release.mjs` |
| `.github/workflows/release.yml` | Modify | Fix ZIP structure (nested `STPlugin/`) + bundle `httpx` |
| `.gitignore` | Modify | Exclude httpx build artifacts and release ZIPs |

---

### Task 1: Create `scripts/release.mjs`

**Files:**
- Create: `scripts/release.mjs`

- [ ] **Step 1: Write the release script**

```js
// scripts/release.mjs
// Local release script: build → bundle httpx → create nested ZIP → tag → push
import { execSync } from "child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "fs";
import { resolve, join } from "path";
import { createRequire } from "module";

const ROOT = resolve(import.meta.dirname, "..");
const require = createRequire(join(ROOT, "package.json"));
const pkg = require(join(ROOT, "package.json"));

// ── Args ──
const bump = process.argv[2]; // "patch" | "minor" | "major"
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/release.mjs <patch|minor|major>");
  process.exit(1);
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

// ── Step 1: Build frontend ──
console.log("\n=== Building frontend ===");
run("pnpm run build");

// ── Step 2: Bundle httpx into py_modules ──
console.log("\n=== Bundling httpx into py_modules ===");
run("pip install --target py_modules httpx");

// ── Step 3: Bump version ──
console.log(`\n=== Bumping version (${bump}) ===`);
run(`pnpm version ${bump} --no-git-tag-version`);

// Read the new version
const updatedPkg = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf-8")
);
const version = updatedPkg.version;
const tagName = `v${version}`;
const zipName = `STPlugin-${tagName}.zip`;

console.log(`\nVersion: ${version}`);

// ── Step 4: Create nested ZIP ──
console.log("\n=== Creating release ZIP ===");
const releaseDir = resolve(ROOT, "release");
const pluginDir = join(releaseDir, "STPlugin");

// Clean and create
if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true });
mkdirSync(pluginDir, { recursive: true });

// Copy plugin files into STPlugin/ subdirectory
const files = ["main.py", "plugin.json", "package.json"];
for (const f of files) {
  cpSync(join(ROOT, f), join(pluginDir, f));
}
cpSync(join(ROOT, "backend"), join(pluginDir, "backend"), { recursive: true });
cpSync(join(ROOT, "dist"), join(pluginDir, "dist"), { recursive: true });
cpSync(join(ROOT, "py_modules"), join(pluginDir, "py_modules"), {
  recursive: true,
});

// Clean __pycache__
for (const dir of ["backend", "py_modules"]) {
  const pycache = join(pluginDir, dir, "__pycache__");
  if (existsSync(pycache)) rmSync(pycache, { recursive: true });
}

// Create ZIP (uses PowerShell on Windows, zip on Linux)
const zipPath = resolve(ROOT, zipName);
if (process.platform === "win32") {
  execSync(
    `Compress-Archive -Path "${pluginDir}" -DestinationPath "${zipPath}" -Force`,
    { cwd: ROOT, stdio: "inherit", shell: "pwsh" }
  );
} else {
  execSync(`cd "${releaseDir}" && zip -r "${zipPath}" STPlugin/`, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

// Verify ZIP structure
console.log("\n=== Verifying ZIP ===");
if (process.platform === "win32") {
  const testDir = resolve(ROOT, "release_verify");
  execSync(
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${testDir}" -Force`,
    { shell: "pwsh" }
  );
  const nested = join(testDir, "STPlugin", "main.py");
  if (!existsSync(nested)) {
    console.error("FAIL: ZIP missing STPlugin/main.py");
    process.exit(1);
  }
  console.log("OK: ZIP has correct nested structure");
  rmSync(testDir, { recursive: true });
} else {
  execSync(`unzip -t "${zipPath}" | grep -q "STPlugin/main.py"`, {
    cwd: ROOT,
    stdio: "inherit",
  });
  console.log("OK: ZIP has correct nested structure");
}

// Clean up release dir
rmSync(releaseDir, { recursive: true });

// ── Step 5: Clean httpx from py_modules (don't commit build artifacts) ──
console.log("\n=== Cleaning py_modules build artifacts ===");
const pyModulesDir = join(ROOT, "py_modules");
if (existsSync(pyModulesDir)) {
  for (const entry of readdirSync(pyModulesDir)) {
    // Keep websockets (committed dependency), remove httpx and its deps
    if (entry === "websockets" || entry === "websockets-16.0.dist-info" || entry === "bin") {
      continue;
    }
    const entryPath = join(pyModulesDir, entry);
    rmSync(entryPath, { recursive: true, force: true });
  }
}

// ── Step 6: Git commit, tag, push ──
console.log("\n=== Git commit, tag, push ===");
run("git add -A");
run(`git commit -m "release: ${tagName}"`);
run(`git tag ${tagName}`);
run("git push");
run(`git push origin ${tagName}`);

console.log(`\n=== Done! ===`);
console.log(`Released ${tagName}`);
console.log(`ZIP: ${zipName} (deleted from working tree)`);
console.log(`GitHub workflow will create the release shortly.`);
```

- [ ] **Step 2: Verify the script parses correctly**

Run: `node --check scripts/release.mjs`
Expected: No output (exit code 0)

---

### Task 2: Update `package.json` scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the scripts section**

Replace the existing `release:*` scripts:

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

- [ ] **Step 2: Verify scripts are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf-8'))"`
Expected: No output (exit code 0)

---

### Task 3: Fix `.github/workflows/release.yml`

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Update the release workflow**

Replace the entire file with:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Build frontend
        run: pnpm run build

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

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: STPlugin-${{ github.ref_name }}.zip
          generate_release_notes: true
          draft: false
          prerelease: false
```

---

### Task 4: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add httpx and release artifact exclusions**

Append to the existing `.gitignore`:

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
release/
```

- [ ] **Step 2: Verify gitignore works**

Run: `pnpm run build && pip install --target py_modules httpx && git status`
Expected: httpx files should NOT appear in `git status` output

Clean up: `Remove-Item -Recurse -Force py_modules/httpx, py_modules/httpx-*.dist-info, py_modules/anyio*, py_modules/certifi*, py_modules/h11*, py_modules/httpcore*, py_modules/idna*, py_modules/sniffio*`

---

### Task 5: End-to-end verification

- [ ] **Step 1: Build the frontend**

Run: `pnpm run build`
Expected: `created dist in X.Xs`

- [ ] **Step 2: Bundle httpx**

Run: `pip install --target py_modules httpx`
Expected: httpx files appear in `py_modules/`

- [ ] **Step 3: Create test ZIP manually**

Run (PowerShell):
```powershell
mkdir -p release/STPlugin
cp main.py release/STPlugin/
cp plugin.json release/STPlugin/
cp package.json release/STPlugin/
cp -r backend release/STPlugin/
cp -r dist release/STPlugin/
cp -r py_modules release/STPlugin/
rm -rf release/STPlugin/backend/__pycache__
rm -rf release/STPlugin/py_modules/__pycache__
Compress-Archive -Path release/STPlugin -DestinationPath test-release.zip -Force
```

- [ ] **Step 4: Verify ZIP structure**

Run (PowerShell):
```powershell
Expand-Archive -Path test-release.zip -DestinationPath test-verify -Force
ls test-verify/STPlugin/
```

Expected output should show:
```
STPlugin/
  ├── main.py
  ├── plugin.json
  ├── package.json
  ├── backend/
  ├── dist/
  └── py_modules/
```

- [ ] **Step 5: Clean up test artifacts**

Run: `Remove-Item -Recurse -Force release, test-release.zip, test-verify`
Then: `Remove-Item -Recurse -Force py_modules/httpx, py_modules/httpx-*.dist-info, py_modules/anyio*, py_modules/certifi*, py_modules/h11*, py_modules/httpcore*, py_modules/idna*, py_modules/sniffio*`

- [ ] **Step 6: Commit all changes**

Run:
```bash
git add scripts/release.mjs package.json .github/workflows/release.yml .gitignore
git commit -m "fix(release): correct ZIP structure and bundle httpx dependency

- Create nested ZIP (STPlugin/ subdirectory) for Decky compatibility
- Bundle httpx into py_modules during release build
- New local release script (scripts/release.mjs)
- Update .gitignore to exclude build artifacts"
```
