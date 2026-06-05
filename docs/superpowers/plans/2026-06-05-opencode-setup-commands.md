# OpenCode Setup Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create two slash commands (`/myConfigInit` and `/mySuperSpec`) that replicate the agentic coding environment setup for new machines and new projects.

**Architecture:** Pure instruction-based markdown command files in `~/.config/opencode/commands/`. The agent reads the command and executes steps using its native tools (bash, write, read). No shell scripts.

**Tech Stack:** OpenCode commands (markdown with frontmatter), ctx7 CLI, npx skills CLI

---

## File Structure

| File | Purpose |
|------|---------|
| `~/.config/opencode/commands/myConfigInit.md` | Global config setup command |
| `~/.config/opencode/commands/mySuperSpec.md` | Project scaffolding command |

---

### Task 1: Create `/myConfigInit` Command

**Files:**
- Create: `C:\Users\Marwan\.config\opencode\commands\myConfigInit.md`

- [ ] **Step 1: Create the command file with frontmatter and superpowers plugin check**

Create `C:\Users\Marwan\.config\opencode\commands\myConfigInit.md` with the following content:

```markdown
---
description: Set up global OpenCode environment (plugins, agents, skills)
---

Set up the global OpenCode agentic coding environment. Check each component before creating — skip if already installed.

## Step 1: Superpowers Plugin

Read `~/.config/opencode/opencode.json`. Check if the `plugin` array contains `superpowers@git+https://github.com/obra/superpowers.git`.

If missing:
- Run: `opencode plugin superpowers@git+https://github.com/obra/superpowers.git -g`
- If that command fails, edit `~/.config/opencode/opencode.json` directly and add the entry to the `plugin` array.

Verify: Re-read `opencode.json` and confirm the entry exists.
```

- [ ] **Step 2: Add ctx7 setup instructions**

Append to the same file:

```markdown
## Step 2: ctx7 Documentation Lookup

Run: `npx ctx7@latest setup --cli`

This creates `~/.config/opencode/AGENTS.md` with documentation lookup instructions automatically.

Verify: Read `~/.config/opencode/AGENTS.md` and confirm it contains ctx7 instructions.
```

- [ ] **Step 3: Add brainstorm agent instructions**

Append to the same file:

```markdown
## Step 3: Brainstorm Agent

Check if `~/.config/opencode/agents/brainstorm.md` exists.

If missing, create it with this content:

~~~markdown
---
description: >-
  Design and planning agent. Follows the superpowers brainstorming skill to
  explore project context, ask clarifying questions, propose approaches, present
  designs, write design docs to docs/superpowers/specs/, then hand off to the
  writing-plans skill for implementation plans in docs/superpowers/plans/.
mode: primary
color: "#8B5CF6"
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  question: allow
  webfetch: allow
  skill: allow
  todowrite: allow
  edit:
    "**": deny
    "docs/**": allow
    ".opencode/**": allow
    "openspec/**": allow
    "AGENTS.md": allow
  bash:
    "*": ask
    "git log*": allow
    "git diff*": allow
    "git status*": allow
    "grep *": allow
    "npx ctx7*": allow
    "node *": allow
  task:
    "*": deny
    "explore": allow
---
You are a **design and planning agent** that follows the superpowers brainstorming skill workflow.

## Workflow

1. **Explore project context** — read files, examine docs, check recent commits. Dispatch `@explore` subagents via the Task tool for parallel codebase exploration.

2. **Ask clarifying questions** — one at a time. Understand purpose, constraints, success criteria. Prefer multiple choice when possible.

3. **Propose 2-3 approaches** — with trade-offs and your clear recommendation. Lead with your recommended option and explain why.

4. **Present the design** — cover architecture, components, data flow, error handling, testing. Scale each section to its complexity. Ask after each section whether it looks right. Get user approval before moving on.

5. **Write the design doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Be comprehensive yet concise.

6. **Spec self-review** — scan for placeholders ("TBD", "TODO"), internal contradictions, scope creep, and ambiguity. Fix issues inline.

7. **User review gate** — ask the user to review the written spec before proceeding:
   > "Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

8. **Transition to implementation** — load and follow the superpowers writing-plans skill to create a detailed implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`.

9. **Hand off** — tell the user the plan is ready and they should switch to the **build** agent (Tab key) for implementation.

## Constraints

- **You MAY edit** files under `docs/`, `.opencode/`, and `openspec/` — for writing spec documents, implementation plans, and updating living specs.
- **You MUST NOT edit** source code files or project configuration. Those belong to the build agent.
- **Use `@explore` subagents** for codebase exploration rather than reading files manually in this session.
- **Use `npx ctx7@latest`** for API/library documentation lookups.
- **One question at a time** — never overwhelm the user with multiple clarifications in a single message.
- **YAGNI ruthlessly** — remove unnecessary features from all designs.

## Key Principles

- Small, well-bounded units are easier to reason about. Break systems into pieces with clear interfaces.
- Follow existing patterns in the codebase. Don't propose unrelated refactoring.
- If the request covers multiple independent subsystems, flag this immediately and help decompose.
- Design docs go to `docs/superpowers/specs/`, plan docs go to `docs/superpowers/plans/`.
~~~
```

- [ ] **Step 4: Add user skills installation instructions**

Append to the same file:

```markdown
## Step 4: User Skills

For each skill below, check if `~/.agents/skills/<name>/SKILL.md` exists. If missing, install via `npx skills add`.

### Caveman Suite

Check for: `~/.agents/skills/caveman/SKILL.md`

If missing:
```bash
npx skills add JuliusBrussee/caveman -g -y
```

This installs: caveman, caveman-commit, caveman-compress, caveman-help, caveman-review, compress

### Find Skills

Check for: `~/.agents/skills/find-skills/SKILL.md`

If missing:
```bash
npx skills add vercel-labs/skills -g -y
```

### Agent Browser

Check for: `~/.agents/skills/agent-browser/SKILL.md`

If missing:
```bash
npx skills add vercel-labs/agent-browser -g -y
```
```

- [ ] **Step 5: Add personal skills verification instructions**

Append to the same file:

```markdown
## Step 5: Personal Skills (codemap & simplify)

### codemap

Check if `~/.config/opencode/skills/codemap/SKILL.md` exists.

If missing, create the directory structure and files:

**`~/.config/opencode/skills/codemap/SKILL.md`:**

~~~markdown
# Skill: codemap

Generate comprehensive hierarchical codemaps for UNFAMILIAR repositories. Expensive operation - only use when explicitly asked for codebase documentation or initial repository mapping.

## When to Use

- User asks for codebase documentation or mapping
- Initial repository exploration when no codemap exists
- After major structural changes that invalidate existing codemap

## Commands

### Initialize codemap
```bash
node ~/.config/opencode/skills/codemap/scripts/codemap.mjs init --root ./ --include "src/**/*.ts" --exclude "node_modules/**"
```

### Check for changes
```bash
node ~/.config/opencode/skills/codemap/scripts/codemap.mjs changes --root ./
```

### Update codemap
```bash
node ~/.config/opencode/skills/codemap/scripts/codemap.mjs update --root ./
```
~~~

**`~/.config/opencode/skills/codemap/README.md`:**

~~~markdown
# Codemap Skill

Generates hierarchical repository maps for unfamiliar codebases. Creates `.slim/codemap.json` for change tracking.

## Usage

```bash
node scripts/codemap.mjs init --root ./ --include "src/**/*.ts"
node scripts/codemap.mjs changes --root ./
node scripts/codemap.mjs update --root ./
```
~~~

Also create `~/.config/opencode/skills/codemap/scripts/codemap.mjs` — copy the script from the superpowers plugin if available, or create a minimal placeholder that logs "codemap skill not fully installed — reinstall via superpowers plugin".

### simplify

Check if `~/.config/opencode/skills/simplify/SKILL.md` exists.

If missing, create:

**`~/.config/opencode/skills/simplify/SKILL.md`:**

~~~markdown
# Skill: simplify

Simplifies code for clarity without changing behavior. Use for readability, maintainability, and complexity reduction after behavior is understood.

## Principles

1. **Preserve Behavior Exactly** — No functional changes. All tests must still pass.
2. **Follow Project Conventions** — Match existing patterns in the codebase.
3. **Prefer Clarity Over Cleverness** — Readable code > clever code.
4. **Maintain Balance** — Don't over-simplify. Keep abstractions where they add value.
5. **Scope to What Changed** — Only simplify code you're already modifying.

## When NOT to Use

- Code is already clean and readable
- You don't yet understand what the code does
- Performance-critical code where the "clever" version is measurably faster
- Code that's about to be rewritten entirely
~~~
```

- [ ] **Step 6: Add validation section**

Append to the same file:

```markdown
## Validation

After completing all steps, verify:

1. `opencode.json` has superpowers in plugin array
2. `~/.config/opencode/AGENTS.md` exists with ctx7 instructions
3. `~/.config/opencode/agents/brainstorm.md` exists with full agent definition
4. `~/.agents/skills/` has: caveman, find-skills, agent-browser directories
5. `~/.config/opencode/skills/` has: codemap and simplify directories

If any check fails, fix it before reporting completion.
```

- [ ] **Step 7: Verify the complete command file**

Read `C:\Users\Marwan\.config\opencode\commands\myConfigInit.md` and confirm it contains all 5 steps plus validation. The file should be a complete, self-contained instruction set that any agent can follow.

---

### Task 2: Create `/mySuperSpec` Command

**Files:**
- Create: `C:\Users\Marwan\.config\opencode\commands\mySuperSpec.md`

- [ ] **Step 1: Create the command file with frontmatter and project analysis instructions**

Create `C:\Users\Marwan\.config\opencode\commands\mySuperSpec.md` with the following content:

```markdown
---
description: Scaffold OpenSpec structure and AGENTS.md for a new project
---

Scaffold the OpenSpec workflow for this project. Analyze the project first, then create the structure.

## Step 1: Analyze the Project

Read these files to understand the project:
- `README*` (any README variant)
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod` (whatever exists)
- Config files: `tsconfig.json`, `rollup.config.*`, `webpack.config.*`, `vite.config.*`
- `.gitignore`
- Source entry points (look for `index.*`, `main.*`, `app.*`)

Identify:
- **Project name** (from package.json name field or README title)
- **Objective** (what does this project do?)
- **Tech stack** (languages, frameworks, build tools)
- **File structure** (main directories and their purposes)
- **Entry points** (where does execution start?)

If the project objective is unclear, ask the user one question: "What is this project's main purpose?"
```

- [ ] **Step 2: Add openspec directory creation instructions**

Append to the same file:

```markdown
## Step 2: Create OpenSpec Structure

Create the following directories:
- `openspec/`
- `openspec/specs/`
- `openspec/changes/`
- `openspec/archive/`
```

- [ ] **Step 3: Add project.md template instructions**

Append to the same file:

```markdown
## Step 3: Create `openspec/project.md`

Create `openspec/project.md` with this template, filling in `{{placeholders}}` from your analysis:

~~~markdown
# {{PROJECT_NAME}}

> **Living document** — update this when project conventions, scope, or platform rules change.
> Last updated: {{DATE}}

## Objective

{{OBJECTIVE — one paragraph describing what this project does}}

## Target Platform

{{PLATFORM — e.g., "Web (React)", "Desktop (Electron)", "CLI tool", "Library"}}

## Feature Scope

| Status | Features |
|--------|----------|
| ✅ **KEEP** | {{features to implement}} |
| ❌ **DROP** | {{features explicitly out of scope}} |
| ⏸️ **DEFER** | {{features for later}} |

## Conventions

{{List 3-5 project-specific conventions that agents must follow}}
~~~
```

- [ ] **Step 4: Add spec file template instructions**

Append to the same file:

```markdown
## Step 4: Create Spec Files

### `openspec/specs/architecture.md`

~~~markdown
# Architecture Specification

> **Living document** — update this when file structure, component relationships, or data flow change.
> Last updated: {{DATE}}

## Overview

{{Describe the main layers/components of the system}}

## File Structure

~~~
{{PROJECT_NAME}}/
{{directory tree with comments explaining each major directory/file}}
~~~

## Component Relationships

{{Describe how components interact — use text or ASCII diagram}}

## Data Flow

{{Describe the main data flows through the system}}

## Testing Strategy

| Layer | Approach |
|-------|----------|
| {{layer}} | {{approach}} |
~~~

### `openspec/specs/backend.md`

~~~markdown
# Backend Specification

> **Living document** — update this when backend modules, APIs, or error handling change.
> Last updated: {{DATE}}

## Modules

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| {{module}} | {{purpose}} | {{functions}} |

## API / IPC Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| {{method}} | {{params}} | {{returns}} | {{description}} |

## Error Handling

{{Describe error handling patterns used in the backend}}
~~~

### `openspec/specs/frontend.md`

~~~markdown
# Frontend Specification

> **Living document** — update this when frontend components, patterns, or state management change.
> Last updated: {{DATE}}

## Component Patterns

{{Describe how components are structured — props, hooks, state management}}

## UI Framework Conventions

{{List framework-specific patterns — e.g., Decky patching, React hooks, etc.}}

## State Management

{{Describe how state is managed — context, stores, signals, etc.}}
~~~

### `openspec/specs/api-contracts.md`

~~~markdown
# API Contracts

> **Living document** — update this when types, interfaces, or IPC contracts change.
> Last updated: {{DATE}}

## TypeScript Interfaces

~~~typescript
// Add project-specific interfaces here
~~~

## IPC Contracts

| Direction | Method | Input | Output |
|-----------|--------|-------|--------|
| {{direction}} | {{method}} | {{input type}} | {{output type}} |

## Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| {{event}} | {{payload type}} | {{description}} |
~~~

Fill in as much as you can from the project analysis. Use `{{TODO}}` only for things that genuinely can't be determined from the codebase.
```

- [ ] **Step 5: Add AGENTS.md creation instructions**

Append to the same file:

```markdown
## Step 5: Create Project-Level `AGENTS.md`

Create `AGENTS.md` at the project root with this structure, filled from your analysis:

~~~markdown
# AGENTS.md — {{PROJECT_NAME}}

## Project Objective

{{OBJECTIVE}}

## Current State

**Phase: Initial setup.** OpenSpec structure created. Living specs in `openspec/`.

## Key Reference Files

Before making any code change or design decision, read these:

| Priority | File | Purpose |
|----------|------|---------|
| 🔴 **Always** | `openspec/project.md` | Project overview, conventions, scope |
| 🔴 **Always** | `openspec/specs/architecture.md` | Overall structure, file layout |
| 🔴 **Always** | `openspec/specs/backend.md` | Backend modules, APIs |
| 🔴 **Always** | `openspec/specs/frontend.md` | Frontend patterns, components |
| 🔴 **Always** | `openspec/specs/api-contracts.md` | Types, interfaces |

## OpenSpec Integration

This project uses OpenSpec for living specifications.

### Living Specs (Source of Truth)
- `openspec/project.md` — Project overview, conventions, scope
- `openspec/specs/` — Component specifications

### Workflow
1. Read `openspec/specs/*.md` for context before any code change
2. Use superpowers brainstorming skill for design exploration
3. Use superpowers writing-plans skill for implementation planning
4. After implementation, update `openspec/specs/*.md` if architecture changed

### When to Update Living Specs
- Project conventions or scope change → update `project.md`
- New API/IPC method → update `backend.md`
- New UI component → update `frontend.md`
- New type/interface → update `api-contracts.md`
- File structure changes → update `architecture.md`

## Hard Rules

1. **Keep this file current.** After any significant action, update this file to reflect the new state.
2. **Read before writing.** Read the relevant spec files before making changes.
3. **Update specs after changes.** If your change affects a spec, update it.

## Key Differences: {{FROM}} → {{TO}}

| Concern | {{FROM}} | {{TO}} |
|---------|---------|--------|
| {{concern}} | {{old}} | {{new}} |
~~~

If there's no migration (the project is new), skip the "Key Differences" section. Fill in what you can from the codebase. Ask the user if the project has a migration context.
```

- [ ] **Step 6: Add docs/superpowers directory creation instructions**

Append to the same file:

```markdown
## Step 6: Create `docs/superpowers/` Structure

Create these directories:
- `docs/superpowers/specs/` — for design docs from the brainstorm agent
- `docs/superpowers/plans/` — for implementation plans from writing-plans skill
```

- [ ] **Step 7: Add validation section**

Append to the same file:

```markdown
## Validation

After completing all steps, verify:

1. `openspec/project.md` exists with project-specific content (not just placeholders)
2. `openspec/specs/` has: architecture.md, backend.md, frontend.md, api-contracts.md
3. `openspec/changes/` directory exists (empty)
4. `openspec/archive/` directory exists (empty)
5. `AGENTS.md` exists at project root with OpenSpec workflow instructions
6. `docs/superpowers/specs/` directory exists
7. `docs/superpowers/plans/` directory exists

If any check fails, fix it before reporting completion.
```

- [ ] **Step 8: Verify the complete command file**

Read `C:\Users\Marwan\.config\opencode\commands\mySuperSpec.md` and confirm it contains all 6 steps plus validation. The file should be a complete, self-contained instruction set.

---

### Task 3: Verify Both Commands

**Files:**
- Read: `C:\Users\Marwan\.config\opencode\commands\myConfigInit.md`
- Read: `C:\Users\Marwan\.config\opencode\commands\mySuperSpec.md`

- [ ] **Step 1: Verify myConfigInit.md exists and is complete**

Read `C:\Users\Marwan\.config\opencode\commands\myConfigInit.md`. Confirm:
- Has frontmatter with `description` field
- Has 5 numbered steps (superpowers, ctx7, brainstorm, user skills, personal skills)
- Has validation section
- No placeholder content (TBD, TODO, etc.)

- [ ] **Step 2: Verify mySuperSpec.md exists and is complete**

Read `C:\Users\Marwan\.config\opencode\commands\mySuperSpec.md`. Confirm:
- Has frontmatter with `description` field
- Has 6 numbered steps (analyze, directory structure, project.md, spec files, AGENTS.md, docs/superpowers)
- Has validation section
- Templates have `{{placeholder}}` syntax for agent to fill

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/
git commit -m "feat: add opencode setup commands design and plan"
```
