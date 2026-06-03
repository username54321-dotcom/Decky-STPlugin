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
