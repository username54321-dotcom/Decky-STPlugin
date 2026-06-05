# Design: OpenCode Setup Slash Commands

> **Date:** 2026-06-05
> **Status:** Approved
> **Scope:** Two slash commands for replicating the agentic coding environment

## Objective

Create two slash commands that replicate the current OpenCode agentic coding setup:

1. **`/myConfigInit`** — One-time global config setup (plugins, agents, skills)
2. **`/mySuperSpec`** — Per-project scaffolding (AGENTS.md, OpenSpec structure)

## Background

The current setup consists of:

| Layer | Location | Purpose |
|-------|----------|---------|
| Superpowers plugin | `opencode.json` plugin array | Provides ~15 skills (brainstorming, writing-plans, TDD, etc.) |
| Global AGENTS.md | `~/.config/opencode/AGENTS.md` | ctx7 documentation lookup (auto-created by ctx7 setup) |
| Brainstorm agent | `~/.config/opencode/agents/brainstorm.md` | Primary design/planning agent |
| User skills | `~/.agents/skills/` | caveman suite, find-skills, agent-browser |
| Personal skills | `~/.config/opencode/skills/` | codemap, simplify |
| Project AGENTS.md | `./AGENTS.md` | Project-specific instructions + OpenSpec workflow |
| OpenSpec structure | `./openspec/` | Living specifications (project.md, specs/) |

## Design

### Approach: Pure Instruction-Based Commands

Both commands are `.md` files in `~/.config/opencode/commands/` containing step-by-step instructions. The agent executes them using its native tools (bash, write, read, edit). No shell scripts — the agent adapts to current state (checks what exists before creating).

---

### Command 1: `/myConfigInit`

**File:** `~/.config/opencode/commands/myConfigInit.md`
**Purpose:** One-time global OpenCode environment setup.

#### Steps

1. **Check & install superpowers plugin**
   - Read `~/.config/opencode/opencode.json`
   - Verify `plugin` array contains `superpowers@git+https://github.com/obra/superpowers.git`
   - If missing, add it to the plugin array
   - Run `opencode plugin superpowers@git+https://github.com/obra/superpowers.git -g` or edit opencode.json directly

2. **Run ctx7 setup**
   - Execute `npx ctx7@latest setup` (or `npx ctx7@latest setup --cli`)
   - This auto-creates `~/.config/opencode/AGENTS.md` with documentation lookup instructions
   - Verify the file was created

3. **Ensure brainstorm agent exists**
   - Check `~/.config/opencode/agents/brainstorm.md`
   - If missing, create with the full design/planning agent definition:
     - Mode: primary, Color: #8B5CF6
     - Permissions: read/glob/grep/list/question/webfetch/skill/todowrite allowed; edit restricted to docs/, .opencode/, openspec/, AGENTS.md
     - Workflow: Explore → Clarify → Propose → Design → Write spec → Self-review → User review → Writing-plans → Hand off
     - Constraint: May NOT edit source code

4. **Install user skills**
   - For each skill, check `~/.agents/skills/<name>/SKILL.md`
   - If missing, install via `npx skills add <package> -g`:
     - `JuliusBrussee/caveman` → caveman, caveman-commit, caveman-compress, caveman-help, caveman-review, compress
     - `vercel-labs/skills` → find-skills
     - `vercel-labs/agent-browser` → agent-browser

5. **Verify personal skills**
   - Check `~/.config/opencode/skills/codemap/SKILL.md`
   - Check `~/.config/opencode/skills/simplify/SKILL.md`
   - If missing, create from bundled templates (the command file includes the full SKILL.md content for each)

#### Validation

After completion, verify:
- `opencode.json` has superpowers in plugin array
- `~/.config/opencode/AGENTS.md` exists with ctx7 instructions
- `~/.config/opencode/agents/brainstorm.md` exists
- `~/.agents/skills/` has caveman, find-skills, agent-browser directories
- `~/.config/opencode/skills/` has codemap and simplify directories

---

### Command 2: `/mySuperSpec`

**File:** `~/.config/opencode/commands/mySuperSpec.md`
**Purpose:** Per-project OpenSpec scaffolding.

#### Steps

1. **Analyze the project**
   - Read README, package.json, config files, existing code
   - Identify: project type, tech stack, file structure, entry points
   - Ask user for any missing context (project objective, conventions)

2. **Create `openspec/` directory structure**
   - Create `openspec/project.md`:
     - Project objective (from analysis)
     - Target platform
     - Feature scope table (KEEP/DROP/DEFER — filled from analysis or user input)
     - Conventions
     - Living document note
   - Create `openspec/specs/architecture.md`:
     - Overview (layers)
     - File structure (from analysis)
     - Component relationships
     - Data flow
     - Testing strategy
   - Create `openspec/specs/backend.md`:
     - Module listing
     - API/IPC methods
     - Error handling patterns
   - Create `openspec/specs/frontend.md`:
     - Component patterns
     - UI framework conventions
     - State management
   - Create `openspec/specs/api-contracts.md`:
     - TypeScript interfaces
     - IPC callable signatures
     - Event types
   - Create empty `openspec/changes/` directory
   - Create empty `openspec/archive/` directory

3. **Create project-level `AGENTS.md`**
   - Include:
     - Project objective
     - Current state tracking
     - OpenSpec integration section:
       - Living specs location
       - Workflow (read specs → brainstorm → write plan → implement → update specs)
       - When to update each spec
     - Key reference files table
     - Hard rules
     - Living document note (must be updated after significant changes)

4. **Verify `docs/superpowers/` structure**
   - Create `docs/superpowers/specs/` (for design docs)
   - Create `docs/superpowers/plans/` (for implementation plans)

#### Template Content

The command file includes template content for each openspec file. Templates have placeholders like `{{PROJECT_NAME}}`, `{{OBJECTIVE}}`, `{{TECH_STACK}}` that the agent fills from its analysis.

#### Validation

After completion, verify:
- `openspec/project.md` exists with project-specific content
- `openspec/specs/` has architecture.md, backend.md, frontend.md, api-contracts.md
- `AGENTS.md` exists at project root with OpenSpec workflow instructions
- `docs/superpowers/specs/` and `docs/superpowers/plans/` directories exist

---

## File Locations

| File | Location |
|------|----------|
| `/myConfigInit` command | `~/.config/opencode/commands/myConfigInit.md` |
| `/mySuperSpec` command | `~/.config/opencode/commands/mySuperSpec.md` |
| Design doc | `docs/superpowers/specs/2026-06-05-opencode-setup-commands-design.md` |

## Non-Goals

- Provider/model configuration (user customizes separately)
- OpenSpec plugin (use workflow instructions in AGENTS.md instead)
- Project-specific tooling setup (build systems, test runners, etc.)
- CI/CD configuration
