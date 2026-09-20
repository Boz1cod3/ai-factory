# Antigravity 2.0 Full Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Google Antigravity integration in `ai-factory` to 100% compliance with official Google Antigravity 2.0 specifications, achieving full feature parity with Claude Code and Codex CLI.

**Architecture:** Realign agent directories from `.agents/subagents` to `.agents/agents`, inject native Antigravity autonomy frontmatter (`permissionMode: acceptEdits`, `commandExecutionPolicy: auto`, `mainAgent: true`), enable worktree-isolated parallel worker execution (`Workspace: "branch"`), implement transparent CLI upgrade migration for existing projects, modernize transformer rules, and update the test suite.

**Tech Stack:** TypeScript (Node.js/ESM), Markdown/YAML frontmatter, Python (security-scan), Bash/Shell test scripts.

**Spec:** `docs/superpowers/specs/2026-09-17-antigravity-2-0-modernization-design.md`

## Global Constraints

- Never break existing installed agents (Claude Code, Cursor, Codex CLI, Windsurf, OpenCode, Universal).
- Preserve backward compatibility for projects already initialized with earlier versions.
- All TypeScript changes must compile cleanly under `npm run build` (`tsc`).
- Do not introduce external npm dependencies.
- Conventional commits format for all commit messages.

---

### Task 1: Core Agent Registry & Config Migration

**Files:**
- Modify: `src/core/agents.ts:184-196`
- Modify: `src/core/config.ts:260-275`
- Test: `npm run build`

**Interfaces:**
- Consumes: `AGENT_IDS.antigravity` from `src/core/agents.ts`
- Produces: `AgentConfig` with `agentsDir: '.agents/agents'` and automatic runtime config migration

- [ ] **Step 1: Update Antigravity AgentConfig in `src/core/agents.ts`**

Change `agentsDir` from `'.agents/subagents'` to `'.agents/agents'`:
```typescript
  [AGENT_IDS.antigravity]: {
    id: AGENT_IDS.antigravity,
    displayName: 'Antigravity',
    configDir: '.agents',
    skillsDir: '.agents/skills',
    agentsDir: '.agents/agents',
    agentFileExtension: '.md',
    agentsSourceDir: 'subagents/antigravity/agents',
    settingsFile: '.agents/mcp_config.json',
    supportsMcp: true,
    skillsCliAgent: 'antigravity',
    source: 'builtin',
  },
```

- [ ] **Step 2: Add legacy config path migration in `src/core/config.ts`**

In `src/core/config.ts`, inside `normalizeAgentConfig()` or where `legacyAgent.agentsDir` is read:
```typescript
    let agentsDir = legacyAgent.agentsDir || legacyAgent.subagentsDir || agentConfig?.agentsDir;
    if (agentId === AGENT_IDS.antigravity && agentsDir === '.agents/subagents') {
      agentsDir = '.agents/agents';
    }
```

- [ ] **Step 3: Run build to verify types**

Run: `npm run build`
Expected: Exits with code 0.

- [ ] **Step 4: Commit changes**

```bash
git add src/core/agents.ts src/core/config.ts
git commit -m "feat(antigravity): align agentsDir to .agents/agents with config migration"
```

---

### Task 2: CLI Upgrade Filesystem Migration

**Files:**
- Modify: `src/cli/commands/upgrade.ts:260-280`
- Test: `npm run build`

**Interfaces:**
- Consumes: `projectDir`, `agent` from `upgrade.ts`
- Produces: Automatic filesystem migration from `.agents/subagents` to `.agents/agents` during `ai-factory upgrade`

- [ ] **Step 1: Add directory migration logic in `src/cli/commands/upgrade.ts`**

In `upgradeAgent()`, before or during updating subagents:
```typescript
      // Migrate legacy .agents/subagents to .agents/agents for Antigravity
      if (agent.id === 'antigravity') {
        const oldSubagentsDir = path.join(projectDir, '.agents', 'subagents');
        const newAgentsDir = path.join(projectDir, '.agents', 'agents');
        if (await fileExists(oldSubagentsDir)) {
          if (!await fileExists(newAgentsDir)) {
            await ensureDirectory(newAgentsDir);
          }
          const files = await listFiles(oldSubagentsDir);
          for (const file of files) {
            const oldPath = path.join(oldSubagentsDir, file);
            const newPath = path.join(newAgentsDir, file);
            if (!await fileExists(newPath)) {
              await copyFile(oldPath, newPath);
            }
            await removeFile(oldPath);
          }
          await removeDirectory(oldSubagentsDir);
          agent.agentsDir = '.agents/agents';
        }
      }
```

- [ ] **Step 2: Run build to verify compilation**

Run: `npm run build`
Expected: Exits with code 0.

- [ ] **Step 3: Commit changes**

```bash
git add src/cli/commands/upgrade.ts
git commit -m "feat(upgrade): add filesystem migration from .agents/subagents to .agents/agents"
```

---

### Task 3: Coordinator & Subagent Frontmatter and Logic

**Files:**
- Modify: `subagents/antigravity/agents/implement-coordinator.md`
- Modify: `subagents/antigravity/agents/plan-coordinator.md`

**Interfaces:**
- Consumes: Antigravity 2.0 subagent schema (`mainAgent`, `permissionMode`, `commandExecutionPolicy`, `tools`, `skills`)
- Produces: Fully autonomous coordinator agent definitions supporting CLI invocation (`agy --agent implement-coordinator`) and worktree-isolated parallel execution (`Workspace: "branch"`)

- [ ] **Step 1: Update `implement-coordinator.md` frontmatter and instructions**

1. Set frontmatter:
```yaml
---
name: implement-coordinator
description: Coordinate parallel execution of independent plan tasks in Antigravity 2.0. Dispatches implement-worker workers and quality sidecars.
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
model: pro
tools:
  - invoke_subagent
  - send_message
  - manage_subagents
  - view_file
  - write_to_file
  - replace_file_content
  - grep_search
  - find_by_name
  - list_dir
  - run_command
skills:
  - aif-implement
  - aif-verify
  - aif-docs
  - aif-commit
  - aif-review
  - aif-security-checklist
  - aif-best-practices
---
```
2. Update dispatch instructions:
- Use `TypeName: "implement-worker"` with `Workspace: "branch"`.
- Use specific sidecar names (`review-sidecar`, `security-sidecar`, `best-practices-sidecar`, `rules-sidecar`, `commit-preparer`, `docs-auditor`).
- Emphasize passing git diff excerpts directly into sidecar prompts, as sidecars are read-only.

- [ ] **Step 2: Update `plan-coordinator.md` frontmatter and instructions**

1. Set frontmatter:
```yaml
---
name: plan-coordinator
description: Coordinate feature planning, exploration, and plan polish in Antigravity 2.0.
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
model: pro
tools:
  - invoke_subagent
  - send_message
  - manage_subagents
  - view_file
  - grep_search
  - find_by_name
  - list_dir
skills:
  - aif-plan
  - aif-explore
  - aif-roadmap
---
```
2. In dispatch instructions, replace `TypeName: "self"` with `TypeName: "plan-polisher"`.

- [ ] **Step 3: Commit changes**

```bash
git add subagents/antigravity/agents/implement-coordinator.md subagents/antigravity/agents/plan-coordinator.md
git commit -m "feat(antigravity): add autonomy flags and correct subagent dispatch in coordinators"
```

---

### Task 4: Antigravity Transformer & Rules Parity

**Files:**
- Modify: `src/core/transformers/antigravity.ts`
- Test: `npm run build`

**Interfaces:**
- Consumes: `AgentTransformer` from `src/core/transformer.js`
- Produces: Modernized rules templates, `getInvocationHint()`, legacy cleanup of `.agents/subagents/`

- [ ] **Step 1: Refactor `src/core/transformers/antigravity.ts`**

1. In `aif-guardrails.md`: Replace hardcoded Ukrainian with neutral language preference:
```markdown
## Language Conventions

- Write implementation plans (`PLAN.md`), architectural specifications, code, variables, and code comments in English.
- Follow configured project language preferences for user communication and task logs.
```
2. In `aif-conventions.md`:
- Change heading and paths to `.agents/agents/`.
- Update skill names to `aif-*` (e.g. `aif-best-practices/`, `aif-architecture/`, `aif-roadmap/`, `aif-rules/`, `aif-loop/`, `aif-qa/`).
- Document all 10 agents.
3. In `cleanup()`:
- Add removal of `.agents/subagents/` if present.
4. Add `getInvocationHint()`:
```typescript
  getInvocationHint(): string {
    return 'Antigravity: /aif-plan, /aif-commit, agy --agent implement-coordinator';
  }
```
5. In `getWelcomeMessage()`:
- Update item 3 to `'3. Agents installed in .agents/agents/ (parallel workers and sidecars)'`.

- [ ] **Step 2: Run build to verify compilation**

Run: `npm run build`
Expected: Exits with code 0.

- [ ] **Step 3: Commit changes**

```bash
git add src/core/transformers/antigravity.ts
git commit -m "refactor(antigravity): modernize transformer rules, add invocation hint, and update welcome message"
```

---

### Task 5: Security Scanner Regex Update

**Files:**
- Modify: `skills/aif-skill-generator/scripts/security-scan.py:121`
- Test: `python skills/aif-skill-generator/scripts/security-scan.py --help`

**Interfaces:**
- Consumes: Python regex for protected configuration paths
- Produces: Protected path matching for `\.agents`

- [ ] **Step 1: Add `\.agents` to `security-scan.py`**

In `skills/aif-skill-generator/scripts/security-scan.py`:
Change:
```python
PROTECTED_CONFIG_RE = re.compile(
    r'(?:\.claude|\.cursor|\.codex|\.github|\.gemini|\.junie)[/\\]'
)
```
To:
```python
PROTECTED_CONFIG_RE = re.compile(
    r'(?:\.claude|\.cursor|\.codex|\.github|\.gemini|\.junie|\.agents)[/\\]'
)
```

- [ ] **Step 2: Run test on security-scan.py**

Run: `python skills/aif-skill-generator/scripts/security-scan.py --help`
Expected: Exits with code 0.

- [ ] **Step 3: Commit changes**

```bash
git add skills/aif-skill-generator/scripts/security-scan.py
git commit -m "fix(security-scan): add .agents to protected config paths"
```

---

### Task 6: E2E Test Suite & Test Scripts Update

**Files:**
- Modify: `scripts/test-antigravity-e2e.mjs`
- Modify: `scripts/test-init.sh`
- Test: `node scripts/test-antigravity-e2e.mjs`

**Interfaces:**
- Consumes: Compiled CLI in `dist/`
- Produces: End-to-end verification of `.agents/agents`, rules, MCP, and migration

- [ ] **Step 1: Update `scripts/test-antigravity-e2e.mjs`**

1. Replace all occurrences of `'subagents'` path resolution with `'agents'`.
2. Update assertions:
```javascript
assert.strictEqual(agAgent.agentsDir, '.agents/agents');
```
3. Add a test case verifying migration from `.agents/subagents` to `.agents/agents` on upgrade.

- [ ] **Step 2: Update `scripts/test-init.sh`**

Replace `assert_exists "$AG_PROJECT_DIR/.agents/subagents/implement-coordinator.md"` with:
`assert_exists "$AG_PROJECT_DIR/.agents/agents/implement-coordinator.md"`

- [ ] **Step 3: Build and run E2E test**

Run:
```bash
npm run build
node scripts/test-antigravity-e2e.mjs
```
Expected: All tests PASS.

- [ ] **Step 4: Commit changes**

```bash
git add scripts/test-antigravity-e2e.mjs scripts/test-init.sh
git commit -m "test(antigravity): update e2e and init tests for .agents/agents directory"
```

---

### Task 7: Documentation & Upstream Sync Synchronization

**Files:**
- Modify: `docs/subagents.md`
- Modify: `docs/getting-started.md`
- Modify: `README.md`
- Modify: `docs/upstream-sync.md`

**Interfaces:**
- Consumes: Updated project structure
- Produces: Synchronized documentation reflecting Antigravity 2.0 `.agents/agents`

- [ ] **Step 1: Update `docs/subagents.md`**

Update all path references to `.agents/agents/`, document `mainAgent: true`, `permissionMode: acceptEdits`, and `Workspace: "branch"`.

- [ ] **Step 2: Update `docs/getting-started.md` and `README.md`**

Update tables and descriptions to reflect `.agents/agents/` and Antigravity 2.0 CLI hints.

- [ ] **Step 3: Commit changes**

```bash
git add docs/subagents.md docs/getting-started.md README.md docs/upstream-sync.md
git commit -m "docs(antigravity): synchronize documentation with Antigravity 2.0 .agents/agents layout"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-20-antigravity-2-0-full-alignment.md`.
