# AGENTS.md — Decky-STPlugin

## Project Objective

Port **LTSteamPlugin** (a Millennium desktop Steam plugin) to **Decky Loader** (Steam Deck plugin framework). The Millennium source lives in `./ltsteamplugin/` for reference and analysis.

## Current State

**Phase: Build — Tasks 1-12 complete.** Backend, frontend scaffolding, all QAM panels (Download, InstalledApps, Settings) are implemented. Tests pass (17/17). Build produces dist/index.js.

**⚠️ Store button injection needs redesign.** The current React patch (`storeButton.tsx`) finds `module.Q` in `webpackChunksteamui` but this component never renders — it's a config wrapper. The actual store game page on Windows BPM overlay is an **embedded CEF webview** loading `store.steampowered.com` (server-rendered HTML, not React). React patching cannot reach into the webview. Must switch to `executeInTab` CDP injection. See [#store-page-architecture](#store-page-architecture) below.

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
5. **No direct DOM manipulation in GamepadUI.** Use Decky's module patching (`findModuleExport`, `afterPatch`, `createReactTreePatcher`) for React-rendered UI. **Exception:** The store game page on Windows BPM overlay is a CEF webview loading server-rendered `store.steampowered.com` HTML — it has no React components. Store page injection MUST use `executeInTab` CDP injection with DOM manipulation inside the webview context. The Millennium plugin uses `document.querySelector` and `MutationObserver` extensively — these patterns apply ONLY to the store webview, not to GamepadUI React components.
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

## Store Page Architecture (Windows BPM Overlay)

**Critical finding (2026-06-02):** On Windows Desktop Steam with BPM overlay, the store game page is NOT React-rendered. It is a **CEF webview** loading `store.steampowered.com` directly.

```
┌─ BPM Overlay (GamepadUI / webpackChunksteamui) ──────────┐
│                                                           │
│  module.Q  ←── React component (creates/configures the     │
│               webview, but does NOT render store content)  │
│     │                                                     │
│     ▼                                                     │
│  <webview src="store.steampowered.com?IN_CLIENT=true..."> │
│     │                                                     │
│     │  ┌─ Separate JS context (server HTML, NOT React) ─┐ │
│     │  │  store.steampowered.com HTML                    │ │
│     │  │  - class="game_area_purchase_game"              │ │
│     │  │  - <form action="/cart/">                       │ │
│     │  │  - <a class="btn_green_steamui">Add to Cart</a> │ │
│     │  └────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**Consequences for injection:**
- React patching (`injectFCTrampoline`, `afterPatch`) **cannot** reach store page content — it's in a separate JS context
- Must use Decky's `executeInTab()` to inject JavaScript into the store CEF tab via CDP
- Injected scripts use `document.querySelector` / `MutationObserver` for DOM manipulation inside the webview
- Communication between injected webview script and React plugin requires `window.postMessage` bridging

**Steam Deck (SteamOS) note:** On actual Steam Deck hardware, the store IS React-rendered within GamepadUI. The original React patch approach would work there. The `executeInTab` approach should still function as a cross-platform fallback, but may need a dual-path implementation (try React patch first, fall back to CDP injection).