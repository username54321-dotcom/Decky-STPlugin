# Decky-STPlugin

> **Living document** — updating this is **critical and not optional**. Update when project conventions, scope, or platform rules change.
> Last updated: 2026-06-07

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
| ✅ **KEEP** | Lua download pipeline (4 API sources), QAM management panel, API manifest, fastDownload + morrenusApiKey settings, DLC warning, loaded apps tracking, download progress/cancel, URL-based download, Windows registry Steam path detection, game name search (Steam suggest proxy + dropdown UI), Steam restart button (main menu + post-download prompt), **auto-update** (GitHub release check, background + manual, download + extract in-place) |
| ❌ **DROP** | Game fixes system, 11 themes, 31 locales (English only), SteamDB browser extension, key donation, games database, playable warning |
| ⏸️ **DEFER** | Non-English locales, additional settings |

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

## Technical Debt / Known Issues (2026-06-07 Audit)

### Auto-Update System — Critical

| Severity | Issue | Location |
|----------|-------|----------|
| 🔴 | **No integrity verification** — downloaded ZIP is extracted without checksum/signature check | `backend/auto_update.py:146` |
| 🔴 | **No rollback** — extraction overwrites files in-place; partial failure corrupts plugin | `backend/auto_update.py:106-137` |
| 🔴 | **Live-plugin overwrite** — files extracted while plugin is loaded; potential file locks/crashes on Windows | `backend/auto_update.py:147` |
| 🟡 | **2-hour initial delay** — background checker sleeps full interval before first check | `main.py:91-93` |
| 🟡 | **Pre-release tags crash** — `parse_version("1.0.0-rc1")` raises ValueError, silently swallowed | `backend/auto_update.py:31-33` |
| 🟡 | **Asset naming fragile** — `STPlugin-*.zip` convention is undocumented; change breaks silently | `backend/auto_update.py:52-57` |
| 🟡 | **No download progress** — install shows "Installing..." with no progress indicator | `src/update/hooks/useUpdateStatus.ts:102` |
| 🔵 | **Test gaps** — no tests for nested ZIP, missing required files, pre-release tags, or integration | `tests/test_auto_update.py` |
| 🔵 | **Duplicate IPC calls** — two `useUpdateStatus` instances call `getPluginVersion` on mount | `src/index.tsx` + `src/SettingsPanel.tsx` |
| 🔵 | **Banner dismiss not persistent** — local state only; reappears on panel navigation | `src/index.tsx:27` |

## Conventions

- All new code uses Decky conventions (`@decky/api`, `@decky/ui`, Python `Plugin` class with `async` methods, `decky` module)
- No direct DOM manipulation in GamepadUI — use Decky's module patching
- YAGNI — only port features in the KEEP list
- English hardcoded strings only (no i18n)
