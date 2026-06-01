# AGENTS.md — Decky-STPlugin

## Project Objective

Port **LTSteamPlugin** (a Millennium desktop Steam plugin) to **Decky Loader** (Steam Deck plugin framework). The Millennium source lives in `./ltsteamplugin/` for reference and analysis.

## Current State

**Phase: Design.** Feature triage complete (see `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md`). Scope locked to **Approach A: Lean Core** — download pipeline + store button + QAM panel. No Decky plugin code exists yet. Next step: implementation plan, then build.

## Target Platform

**Primary target: Windows (Decky Loader on Windows).** The plugin shall run on a Windows build of Decky Loader.

### Windows-First Principle

Always code for Windows first with a cross-platform fallback. When in doubt, choose the safe option:
- **Steam path detection:** Try Windows registry (`HKCU\Software\Valve\Steam\SteamPath`) first, fall back to environment variables or known paths.
- **File paths:** Use `pathlib.Path` exclusively — never hardcode `/` or `\`.
- **Process management:** Windows `.cmd` scripts are acceptable; provide Linux alternatives as fallback only.
- **Registry:** Only used for Steam path detection; no other registry dependencies.
- **`_root` flag:** Test without it first on Windows (Steam is usually in a user-writable location). Add only if needed.

## Feature Scope (Decided)

| Status | Features |
|--------|----------|
| ✅ **KEEP** | Lua download pipeline (4 API sources), store page button injection (React patch), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection |
| ❌ **DROP** | Game fixes system (entirely), 11 themes, 31 locales (English hardcoded only), SteamDB browser extension, key donation, games database (playability pills), playable warning |
| ⏸️ **DEFER** | In-plugin update check (GitHub), non-English locales, additional settings |

## Key Reference Files

Before making any code change or design decision, read these:

| Priority | File | Purpose |
|----------|------|---------|
| 🔴 **Always** | `./ltsteamplugin/project_analysis.md` | Complete analysis of the Millennium plugin — architecture, backends, frontend, data flows, external APIs, technical debt |
| 🔴 **Always** | `docs/references/decky-loader-plugin-development.md` | Decky development reference — file structure, APIs, components, lifecycle, communication, gotchas |
| 🔴 **Always** | `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` | Approved design spec — feature scope, architecture, IPC contract, exclusions |
| 🟡 **When unsure** | `./ltsteamplugin/backend/downloads.py` | Millennium download pipeline source (key reference for porting logic) |
| 🟡 **When unsure** | `./ltsteamplugin/backend/api_manifest.py` | Millennium API manifest source (~100 lines) |

## Hard Rules

1. **Keep this file current.** After any significant action (design decision, new file, architectural choice, completed milestone), update this file to reflect the new state. This is not optional.
2. **Read before writing.** If the task involves the Millennium source or Decky patterns and you are unsure, read the relevant reference files first. Do not guess.
3. **Decky first.** All new code uses Decky conventions (TypeScript/React frontend, `@decky/api`, `@decky/ui`, Python `Plugin` class with `async` methods, `decky` module). Do not replicate Millennium patterns (vanilla JS DOM injection, `Millennium.callServerMethod()`, `PluginUtils.Logger`).
4. **YAGNI.** Only port features in the KEEP list above. The 7426-line vanilla JS monolith does not get a 1:1 rewrite — it gets restructured into proper React components.
5. **No direct DOM manipulation.** Use Decky's module patching (`findModuleExport`, `afterPatch`, `createReactTreePatcher`). The Millennium plugin uses `document.querySelector` and `MutationObserver` extensively — these do not apply to Decky.
6. **Windows-first, always fallback.** Code for Windows Decky Loader as primary target. Always provide cross-platform fallbacks using `pathlib.Path` and OS-agnostic APIs.

## Project Structure (Planned)

```
Decky-STPlugin/
├── src/                    # TypeScript/React frontend (to be created)
│   ├── index.tsx           # definePlugin() entry point + QAM panel
│   ├── patches/            # React tree patchers (store button injection)
│   └── components/         # Shared React components (dialogs, progress)
├── backend/                # Python modules (to be created)
│   ├── downloads.py        # Download pipeline (trimmed from Millennium ~1200 lines)
│   ├── api_manifest.py     # API source management (~60 lines)
│   └── steam_paths.py      # Steam directory resolution (Windows registry + fallback)
├── main.py                 # Python Plugin class — all backend RPC methods
├── plugin.json             # Decky manifest
├── package.json            # pnpm + @decky deps
├── tsconfig.json           # TypeScript config
├── rollup.config.js        # @decky/rollup preset
├── docs/                   # Project documentation
│   ├── references/
│   │   └── decky-loader-plugin-development.md
│   └── superpowers/
│       ├── specs/          # Design specs
│       └── plans/          # Implementation plans
└── ltsteamplugin/          # Millennium reference (gitignored, not part of the build)
```

## Key Differences: Millennium → Decky

| Concern | Millennium | Decky |
|---------|-----------|-------|
| Frontend language | Vanilla JS IIFE | TypeScript + React (TSX) |
| UI injection | `document.querySelector` + DOM manipulation | React module patching (`afterPatch`, `createReactTreePatcher`) |
| Backend IPC | `Millennium.callServerMethod()` | `callable()` (TS) / async methods on Plugin class (Python) |
| Events | `PluginUtils.Logger` bridge | `decky.emit()` → `addEventListener()` |
| Settings | Custom JSON persistence | `decky.DECKY_PLUGIN_SETTINGS_DIR` |
| Logging | Custom Logger singleton | `decky.logger` |
| Bundler | None (raw JS) | Rollup via `@decky/rollup` |
| Package manager | None | `pnpm` |