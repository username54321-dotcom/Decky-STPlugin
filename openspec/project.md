# Decky-STPlugin

> **Living document** — update this when project conventions, scope, or platform rules change.
> Last updated: 2026-06-05

## Objective

Port **LTSteamPlugin** (a Millennium desktop Steam plugin) to **Decky Loader** (Steam Deck plugin framework).

## Target Platform

**Primary: Windows Decky Loader**

### Windows-First Principles
- Steam path detection: Try Windows registry (`HKCU\Software\Valve\Steam\SteamPath`) first, fall back to env vars or known paths
- File paths: Use `pathlib.Path` exclusively — never hardcode `/` or `\`
- Process management: Windows `.cmd` scripts acceptable; Linux alternatives as fallback only
- Registry: Only for Steam path detection; no other registry dependencies

## Feature Scope

| Status | Features |
|--------|----------|
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection, game name search (Steam suggest proxy + dropdown UI), Steam restart button (main menu + post-download prompt) |
| ❌ **DROP** | Game fixes system, 11 themes, 31 locales (English only), SteamDB browser extension, key donation, games database, playable warning |
| ⏸️ **DEFER** | In-plugin update check (GitHub), non-English locales, additional settings |

## Key Differences: Millennium → Decky

| Concern | Millennium | Decky |
|---------|-----------|-------|
| Frontend | Vanilla JS IIFE | TypeScript + React (TSX) |
| UI injection | `document.querySelector` + DOM | React module patching (`afterPatch`, `createReactTreePatcher`) |
| Backend IPC | `Millennium.callServerMethod()` | `callable()` (TS) / async methods on Plugin class (Python) |
| Events | `PluginUtils.Logger` bridge | `decky.emit()` → `addEventListener()` |
| Settings | Custom JSON persistence | `decky.DECKY_PLUGIN_SETTINGS_DIR` |
| Logging | Custom Logger singleton | `decky.logger` |
| Bundler | None (raw JS) | Rollup via `@decky/rollup` |
| Package manager | None | `pnpm` |

## Conventions

- All new code uses Decky conventions (`@decky/api`, `@decky/ui`, Python `Plugin` class with `async` methods, `decky` module)
- No direct DOM manipulation in GamepadUI — use Decky's module patching
- YAGNI — only port features in the KEEP list
- English hardcoded strings only (no i18n)
