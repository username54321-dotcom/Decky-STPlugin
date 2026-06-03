# AGENTS.md — Decky-STPlugin

## Project Objective

Port **LTSteamPlugin** (a Millennium desktop Steam plugin) to **Decky Loader** (Steam Deck plugin framework). The Millennium source lives in `./ltsteamplugin/` for reference and analysis.

## Current State

**Phase: Build — Tasks 1-14 complete.** Backend, frontend scaffolding, all QAM panels (Download, InstalledApps, Settings) are implemented. Game name search added (Steam `/search/suggest` proxy with debounced dropdown). Steam restart button added (main menu + post-download prompt). Tests pass (37/37). Build produces dist/index.js.

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
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection, **game name search** (Steam suggest proxy + dropdown UI), **Steam restart button** (main menu + post-download prompt) |
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
5. **No direct DOM manipulation in GamepadUI.** Use Decky's module patching (`findModuleExport`, `afterPatch`, `createReactTreePatcher`) for React-rendered UI.
6. **Windows-first, always fallback.** Code for Windows Decky Loader as primary target. Always provide cross-platform fallbacks using `pathlib.Path` and OS-agnostic APIs.

## Project Structure

```
Decky-STPlugin/
├── src/
│   ├── index.tsx
│   ├── DownloadPanel.tsx
│   ├── DownloadForm.tsx
│   ├── InstalledApps.tsx
│   ├── SettingsPanel.tsx
│   ├── download/
│   │   ├── components/
│   │   │   ├── DownloadProgress.tsx
│   │   │   ├── GameSearchDropdown.tsx
│   │   │   └── PostDownloadRestart.tsx
│   │   └── hooks/
│   │       ├── useDebouncedSearch.ts
│   │       └── useDownloadLifecycle.ts
│   ├── installed/
│   │   └── components/
│   │       ├── InstalledAppCard.tsx
│   │       └── SkeletonCard.tsx
│   └── shared/
│       ├── types.ts
│       ├── styles.ts
│       ├── constants.ts
│       ├── components/
│       │   ├── PageLayout.tsx
│       │   └── RestartButton.tsx
│       └── hooks/
│           └── useRestartSteam.ts
├── backend/                # Python modules
│   ├── downloads.py
│   ├── api_manifest.py
│   └── steam_paths.py
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
│       ├── plans/          # Implementation plans
│   │       ├── 2026-06-02-game-search.md
│   │       ├── 2026-06-02-steam-restart-button.md
│   │       └── 2026-06-03-frontend-flat-restructure.md
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
