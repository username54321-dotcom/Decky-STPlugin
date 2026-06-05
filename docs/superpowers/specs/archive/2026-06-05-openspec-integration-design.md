# Design Spec: OpenSpec + Superpowers Integration

**Date:** 2026-06-05
**Status:** Proposed
**Approach:** OpenSpec for living specs, Superpowers for workflow

## 1. Objective

Integrate [OpenSpec](https://github.com/Fission-AI/OpenSpec) (Spec-Driven Development framework) into the Decky-STPlugin project as a **living specification system**, while keeping the superpowers plugin workflow for actual development (brainstorming → plans → build).

**Problem being solved:**
- Current `docs/superpowers/specs/` has 20 files (3,555 lines) of scattered, overlapping, often stale specifications
- Current `docs/superpowers/plans/` has 22 files (11,019 lines) of implementation plans
- Agents loading all this context get polluted with historical/exploratory documents
- No clear separation between "current state knowledge" and "feature-specific design explorations"

**Solution:**
- Use OpenSpec's directory structure for **living component specs** (source of truth)
- Keep superpowers skills for **workflow** (brainstorming → writing-plans → build)
- Agent reads ~620 lines of focused living specs instead of 3,500+ lines of scattered docs

## 2. Scope

### 2.1 What's Included

| Component | Description |
|-----------|-------------|
| `openspec/` directory structure | `project.md`, `specs/`, `changes/`, `archive/` |
| 4 living component specs | `architecture.md`, `backend.md`, `frontend.md`, `api-contracts.md` |
| `AGENTS.md` updates | New "OpenSpec Integration" section + updated reference files |
| Migration of existing specs | Distill 20 specs into 4 living docs, archive originals |

### 2.2 What's NOT Included

| Excluded | Reason |
|----------|--------|
| OpenSpec CLI installation | Not needed — we use OpenSpec structure, not its workflow |
| OpenSpec slash commands (`/opsx:*`) | Superpowers handles workflow |
| Changes to superpowers workflow | Brainstorming, writing-plans, build agent stay the same |
| Changes to `docs/superpowers/plans/` | Implementation plans stay as-is (history) |

## 3. Architecture

### 3.1 Directory Structure

```
Decky-STPlugin/
├── openspec/                          ← NEW: Living specs
│   ├── project.md                     ← Project overview, conventions, scope
│   ├── specs/                         ← Component specifications
│   │   ├── architecture.md            ← Overall structure, file layout, data flow
│   │   ├── backend.md                 ← Python modules, IPC methods, error handling
│   │   ├── frontend.md                ← React patterns, Decky UI, hooks
│   │   └── api-contracts.md           ← TypeScript types, callable signatures, events
│   ├── changes/                       ← Active change proposals (temporary)
│   └── archive/                       ← Completed change history
│
├── docs/                              ← EXISTING: Superpowers output
│   ├── references/
│   │   └── decky-loader-plugin-development.md  ← KEEP: Decky API reference
│   └── superpowers/
│       ├── specs/                     ← KEEP: Design explorations (brainstorming output)
│       └── plans/                     ← KEEP: Implementation plans
│
├── AGENTS.md                          ← UPDATE: Add OpenSpec references
└── ... (rest of project)
```

### 3.2 Responsibility Separation

| Concern | Location | Purpose |
|---------|----------|---------|
| **Knowledge** (how the system works) | `openspec/specs/` | Living docs, current-state-only |
| **Project context** (conventions, scope) | `openspec/project.md` | Stable reference |
| **Design exploration** (what we're building) | `docs/superpowers/specs/` | Brainstorming output, feature-specific |
| **Implementation plans** (how to build) | `docs/superpowers/plans/` | Writing-plans output, step-by-step |
| **External reference** (Decky API) | `docs/references/` | Third-party documentation |

### 3.3 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENSPEC (Knowledge)                      │
│  openspec/specs/*.md — Living component specs               │
│  (architecture, backend, frontend, api-contracts)           │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Agent reads for context
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 SUPERPOWERS (Workflow)                       │
│  1. brainstorming skill → design in docs/superpowers/specs/ │
│  2. writing-plans skill → plan in docs/superpowers/plans/   │
│  3. Build agent → executes plan                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ If architecture changed
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 UPDATE LIVING SPECS                          │
│  Update openspec/specs/*.md with new knowledge              │
└─────────────────────────────────────────────────────────────┘
```

## 4. Component Specifications

### 4.1 `openspec/project.md`

**Purpose:** Single project overview, conventions, scope.

**Content:**
- Project objective (port LTSteamPlugin to Decky Loader)
- Target platform (Windows Decky Loader)
- Windows-first principles
- Feature scope (KEEP/DROP/DEFER)
- Key differences (Millennium → Decky)
- Hard rules

**Source:** Distilled from `AGENTS.md` + `2026-06-01-ltsteamplugin-decky-port-design.md`

**Estimated size:** ~80 lines

### 4.2 `openspec/specs/architecture.md`

**Purpose:** Overall plugin structure, file layout, component relationships.

**Content:**
- ASCII architecture diagram
- File structure (src/, backend/, main.py)
- Component relationships
- Data flow overview
- Testing strategy

**Source:** Distilled from `2026-06-01-ltsteamplugin-decky-port-design.md` (sections 1-3)

**Estimated size:** ~100 lines

### 4.3 `openspec/specs/backend.md`

**Purpose:** Python modules, IPC methods, error handling.

**Content:**
- Plugin class (`main.py`) — all async methods
- IPC methods table (method, args, returns, notes)
- Download pipeline (`downloads.py`) — functions, progress events, cancellation
- API manifest (`api_manifest.py`) — functions
- Steam paths (`steam_paths.py`) — functions, registry fallback
- Settings structure
- Error handling matrix

**Source:** Distilled from `2026-06-01-ltsteamplugin-decky-port-design.md` (sections 4, 6, 7)

**Estimated size:** ~120 lines

### 4.4 `openspec/specs/frontend.md`

**Purpose:** React patterns, Decky UI components, hooks.

**Content:**
- Plugin entry (`index.tsx`) — definePlugin, IPC bindings, QAM routes
- Store page patch — afterPatch pattern, DLC detection
- QAM panels — DownloadPanel, InstalledApps, SettingsPanel
- Shared components — PageLayout, RestartButton
- Hooks — useDebouncedSearch, useDownloadLifecycle, useRestartSteam
- Decky UI patterns — ToggleField, TextField, ButtonItem

**Source:** Distilled from `2026-06-01-ltsteamplugin-decky-port-design.md` (section 5) + `2026-06-03-frontend-refactor-design.md` + `2026-06-03-frontend-polish-design.md`

**Estimated size:** ~120 lines

### 4.5 `openspec/specs/api-contracts.md`

**Purpose:** TypeScript types, callable signatures, events.

**Content:**
- `callable<>()` signatures for all IPC methods
- TypeScript interfaces (GameSearchResult, DownloadProgress, InstalledApp, ApiSource, Settings, DiscoverProgress, UpdateInfo)
- Event contracts (download_progress, etc.)
- Type definitions from `src/shared/types.ts`

**Source:** Distilled from `2026-06-01-ltsteamplugin-decky-port-design.md` (section 6.4) + codebase types

**Estimated size:** ~100 lines

## 5. AGENTS.md Updates

### 5.1 Replace "Key Reference Files" Section

**Current:**
```markdown
| Priority | File | Purpose |
|----------|------|---------|
| 🔴 Always | `./ltsteamplugin/project_analysis.md` | Complete analysis of the Millennium plugin |
| 🔴 Always | `docs/references/decky-loader-plugin-development.md` | Decky development reference |
| 🔴 Always | `docs/superpowers/specs/2026-06-01-ltsteamplugin-decky-port-design.md` | Approved design spec |
| 🟡 When unsure | `./ltsteamplugin/backend/downloads.py` | Millennium download pipeline source |
| 🟡 When unsure | `./ltsteamplugin/backend/api_manifest.py` | Millennium API manifest source |
```

**Updated:**
```markdown
| Priority | File | Purpose |
|----------|------|---------|
| 🔴 **Always** | `openspec/project.md` | Project overview, conventions, scope |
| 🔴 **Always** | `openspec/specs/architecture.md` | Overall plugin structure, file layout |
| 🔴 **Always** | `openspec/specs/backend.md` | Python modules, IPC methods, error handling |
| 🔴 **Always** | `openspec/specs/frontend.md` | React patterns, Decky UI components |
| 🔴 **Always** | `openspec/specs/api-contracts.md` | TypeScript types, callable signatures |
| 🟡 **When unsure** | `docs/references/decky-loader-plugin-development.md` | Decky API reference |
| 🟡 **When unsure** | `./ltsteamplugin/project_analysis.md` | Millennium source analysis |
```

### 5.2 Add "OpenSpec Integration" Section

```markdown
## OpenSpec Integration

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for living specifications.

### Living Specs (Source of Truth)
- `openspec/project.md` — Project overview, conventions, scope
- `openspec/specs/` — Component specifications (architecture, backend, frontend, api-contracts)

### Workflow
1. Read `openspec/specs/*.md` for context before any code change
2. Use superpowers brainstorming skill for design exploration
3. Use superpowers writing-plans skill for implementation planning
4. After implementation, update `openspec/specs/*.md` if architecture changed

### When to Update Living Specs
- New IPC method → update `backend.md`
- New React component → update `frontend.md`
- New TypeScript type → update `api-contracts.md`
- File structure changes → update `architecture.md`
```

## 6. Migration Plan

### Phase 1: Create OpenSpec Structure

1. Create `openspec/` directory
2. Create `openspec/specs/` directory
3. Create `openspec/changes/` directory
4. Create `openspec/archive/` directory

### Phase 2: Create Living Specs

1. Create `openspec/project.md` (distilled from AGENTS.md + existing specs)
2. Create `openspec/specs/architecture.md` (distilled from design spec sections 1-3)
3. Create `openspec/specs/backend.md` (distilled from design spec sections 4, 6, 7)
4. Create `openspec/specs/frontend.md` (distilled from design spec section 5 + refactor/polish specs)
5. Create `openspec/specs/api-contracts.md` (distilled from design spec section 6.4 + codebase types)

### Phase 3: Update AGENTS.md

1. Replace "Key Reference Files" section
2. Add "OpenSpec Integration" section

### Phase 4: Archive Old Specs

1. Move all 20 files from `docs/superpowers/specs/` to `docs/superpowers/specs/archive/`
2. Keep `docs/superpowers/plans/` as-is (implementation history)
3. Keep `docs/references/decky-loader-plugin-development.md` (external reference)

## 7. Testing

| Test | Verification |
|------|--------------|
| Agent context loading | Verify agent reads ~620 lines instead of 3,500+ |
| Spec accuracy | Each living spec matches current codebase state |
| Workflow unchanged | Brainstorming → plans → build works as before |
| Update workflow | Changing a component → update one living spec file |

## 8. Success Criteria

After implementation:
1. ✅ Agent reads ~620 lines of living specs instead of 3,500+ lines of scattered specs
2. ✅ Each component spec is focused and current-state-only
3. ✅ Superpowers workflow unchanged (brainstorming → plans → build)
4. ✅ Clear separation: OpenSpec = knowledge, Superpowers = workflow
5. ✅ Easy to maintain: update one file when one component changes
6. ✅ No CLI dependencies — uses OpenSpec structure only

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Living specs get stale | Add "Last updated" header; update rule in AGENTS.md |
| Too many specs to maintain | Start with 4 component specs only; add more only if needed |
| Confusion about where to look | Clear AGENTS.md references; "OpenSpec = knowledge, Superpowers = workflow" |
| Migration effort | One-time distillation; ~2 hours to create 4 specs from existing docs |

## 10. Explicit Exclusions

| Excluded | Reason |
|----------|--------|
| OpenSpec CLI (`npm install -g @fission-ai/openspec`) | Not needed — we use structure, not workflow |
| OpenSpec slash commands (`/opsx:propose`, `/opsx:apply`) | Superpowers handles workflow |
| Changes to superpowers brainstorming skill | No changes needed |
| Changes to superpowers writing-plans skill | No changes needed |
| Changes to build agent | No changes needed |
| OpenSpec changes/ workflow | Add later if needed for feature tracking |
