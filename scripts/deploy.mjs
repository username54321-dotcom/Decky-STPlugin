import { cpSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const DEST = resolve(
  process.env.USERPROFILE || process.env.HOME || "~",
  "homebrew",
  "plugins",
  "STPlugin"
);

if (!existsSync(DEST)) mkdirSync(DEST, { recursive: true });

const entries = ["main.py", "plugin.json", "package.json"];

for (const f of entries) {
  cpSync(resolve(ROOT, f), resolve(DEST, f), { force: true });
}

cpSync(resolve(ROOT, "backend"), resolve(DEST, "backend"), {
  recursive: true,
  force: true,
});

cpSync(resolve(ROOT, "dist"), resolve(DEST, "dist"), {
  recursive: true,
  force: true,
});

console.log(`Deployed to ${DEST}`);
