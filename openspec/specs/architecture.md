# Architecture Specification

> **Living document** — updating this is **critical and not optional**. Update when file structure, component relationships, or data flow change.
> Last updated: 2026-06-05

## Overview

The plugin has three layers:
- **Frontend** (TypeScript/React) — QAM panels, store page button, IPC consumption
- **Backend** (Python) — Plugin class, download pipeline, API manifest, Steam paths
- **IPC** (callable) — TypeScript `callable<>()` ↔ Python `async` methods

## File Structure

```
Decky-STPlugin/
├── src/                           # TypeScript/React frontend
│   ├── index.tsx                  # definePlugin() entry + QAM router + IPC bindings (thin, ~35 lines)
│   ├── MainPanel.tsx              # QAM status dashboard
│   ├── DownloadPanel.tsx          # QAM download panel
│   ├── DownloadForm.tsx           # Download form with search
│   ├── InstalledApps.tsx          # QAM installed apps panel
│   ├── SettingsPanel.tsx          # QAM settings panel
│   ├── main/
│   │   ├── NavTile.tsx            # Reusable QAM navigation tile
│   │   ├── StatsCard.tsx          # Installed scripts count display
│   │   └── styles.ts              # MainPanel style constants
│   ├── download/
│   │   ├── components/
│   │   │   ├── DownloadModal.tsx
│   │   │   └── GameSearchDropdown.tsx
│   │   └── hooks/
│   │       ├── useDebouncedSearch.ts
│   │       └── useDownloadLifecycle.ts
│   ├── installed/
│   │   └── components/
│   │       ├── InstalledAppCard.tsx
│   │       └── SkeletonCard.tsx
│   ├── patches/
│   │   └── PlayBarPatch.tsx        # PlayBar patch + ScriptStatusIcon component
│   └── shared/
│       ├── types.ts               # TypeScript interfaces
│       ├── styles.ts              # Shared styles
│       ├── constants.ts           # Constants
│       ├── navigationState.ts     # Module-level appid passing for QAM navigation
│       ├── components/
│       │   ├── PageLayout.tsx
│       │   └── RestartButton.tsx
│       └── hooks/
│           └── useRestartSteam.ts
├── backend/                       # Python modules
│   ├── downloads.py               # Download pipeline
│   ├── api_manifest.py            # API source management
│   └── steam_paths.py             # Steam directory resolution
├── main.py                        # Plugin class — all backend RPC methods
├── plugin.json                    # Decky manifest
├── package.json                   # pnpm + @decky deps
├── tsconfig.json                  # TypeScript config
└── rollup.config.js               # @decky/rollup preset
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEAM CLIENT (CEF)                            │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  Store Page Patch     │    │  Quick Access Menu (QAM)     │   │
│  │  (React tree patch)   │    │                              │   │
│  │  "Add via LuaTools"   │    │  Download / Installed /      │   │
│  │  button on game page  │    │  Settings panels             │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  ═══════════════════ IPC (callable) ═══════════════════════════  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  main.py — Python Plugin class (RPC router)               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ downloads.py │  │ api_manifest │  │ steam_paths.py  │   │   │
│  │  │              │  │   .py        │  │                 │   │   │
│  │  │ Download     │  │ Fetch JSON   │  │ Registry → env  │   │   │
│  │  │ pipeline     │  │ Normalize    │  │ → known paths   │   │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Download Flow
1. Frontend calls `startDownload(appid)` via `callable<>()`
2. Backend creates task, returns `task_id`
3. Backend runs pipeline: resolve name → download → validate → extract → install → track
4. Backend emits `download_progress` events at each phase
5. Frontend updates UI based on events

### Progress Events
```typescript
interface DownloadProgress {
  task_id: string;
  phase: "fetching_apis" | "downloading" | "extracting" | "installing" | "done" | "error" | "cancelled";
  percent: number;  // 0-100
  message: string;
  appid?: number;
  error?: string;
}
```

## Testing Strategy

| Layer | Approach |
|-------|----------|
| Backend unit | Mock HTTP, mock registry/env, mock GitHub |
| Backend integration | Real small app, verify `.lua` written to temp dir |
| Frontend | Manual testing on Windows Decky (Steam's CEF runtime required) |
| E2E | Manual: store → button → download → QAM → verify |
