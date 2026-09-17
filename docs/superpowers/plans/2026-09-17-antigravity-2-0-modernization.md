# Antigravity 2.0 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize `ai-factory`'s Google Antigravity integration from legacy 1.0 flat workflows to full Antigravity 2.0 Agent Skills standards (`.agents/skills/`, `.agents/mcp_config.json`, and triggered rules).

**Architecture:** Update `AgentConfig` for Antigravity in `agents.ts` to enable MCP and target `.agents/`. Refactor `AntigravityTransformer` to package all skills as directory bundles with full frontmatter, add `always_on` and `model_decision` triggers to rules in `postInstall()`, and ensure legacy cleanup in `cleanup()` and `upgrade.ts`. Update docs and smoke tests.

**Tech Stack:** TypeScript, Node.js (ESM), Commander, Chalk, Google Antigravity 2.0 specs.

**Spec:** `docs/superpowers/specs/2026-09-17-antigravity-2-0-modernization-design.md`

## Global Constraints

- Preserve full frontmatter (`name` and `description`) for all skills installed to Antigravity.
- Do not create flat workflow `.md` files or shared `workflows/references/` directories.
- All MCP settings for Antigravity must write to `.agents/mcp_config.json` with root key `mcpServers`.
- Rule `aif-guardrails.md` must have `trigger: always_on`.
- Rule `aif-conventions.md` must have `trigger: model_decision`.
- Legacy files in `.agent/workflows/` must be cleaned up on upgrade or cleanup.

---

### Task 1: Update Antigravity Agent Definition and MCP Support

**Files:**
- Modify: `src/core/agents.ts:183-192`
- Test: `scripts/test-managed-skill-receipts.mjs`

**Interfaces:**
- Consumes: `AgentConfig` interface from `src/core/agents.ts`
- Produces: Updated `BUILTIN_AGENT_REGISTRY.antigravity` with `.agents` paths and `supportsMcp: true`

- [ ] **Step 1: Check existing agent configuration in test or node eval**

Run: `node -e "import('./dist/core/agents.js').then(m => console.log(m.getAgentConfig('antigravity')))"`
Expected: shows `configDir: '.agent'`, `supportsMcp: false`, `settingsFile: null`.

- [ ] **Step 2: Update `BUILTIN_AGENT_REGISTRY.antigravity` in `src/core/agents.ts`**

In `src/core/agents.ts`, change the `antigravity` entry to:
```typescript
  antigravity: {
    id: 'antigravity',
    displayName: 'Antigravity',
    configDir: '.agents',
    skillsDir: '.agents/skills',
    settingsFile: '.agents/mcp_config.json',
    supportsMcp: true,
    skillsCliAgent: 'antigravity',
    source: 'builtin',
  },
```

- [ ] **Step 3: Compile TypeScript**

Run: `npm run build`
Expected: `tsc` exits with 0.

- [ ] **Step 4: Verify updated agent config**

Run: `node -e "import('./dist/core/agents.js').then(m => console.log(m.getAgentConfig('antigravity')))"`
Expected: shows `configDir: '.agents'`, `skillsDir: '.agents/skills'`, `settingsFile: '.agents/mcp_config.json'`, `supportsMcp: true`.

- [ ] **Step 5: Commit**

```bash
git add src/core/agents.ts
git commit -m "feat(antigravity): update agent config to .agents and enable MCP"
```

---

### Task 2: Refactor `AntigravityTransformer` to Agent Skills Standard

**Files:**
- Modify: `src/core/transformers/antigravity.ts`
- Test: `scripts/test-init.sh`

**Interfaces:**
- Consumes: `AgentTransformer`, `TransformResult` from `src/core/transformer.ts`
- Produces: `AntigravityTransformer` that installs directory-based `SKILL.md` bundles, triggered rules, and legacy workflow cleanup

- [ ] **Step 1: Update `transform()` method in `src/core/transformers/antigravity.ts`**

Remove the `WORKFLOW_SKILLS.has(skillName)` branching that previously emitted flat workflow files. All skills now install as directory bundles:
```typescript
  transform(skillName: string, content: string): TransformResult {
    return {
      targetDir: skillName,
      targetName: 'SKILL.md',
      content,
      flat: false,
    };
  }
```

- [ ] **Step 2: Update `postInstall()` to write rules with frontmatter triggers to `.agents/rules/`**

Update `postInstall(projectDir: string)`:
- Target `path.join(projectDir, '.agents', 'rules')`
- Prepend YAML frontmatter to `aif-guardrails.md`:
```markdown
---
trigger: always_on
---
# AI Factory Guardrails
...
```
- Prepend YAML frontmatter to `aif-conventions.md`:
```markdown
---
trigger: model_decision
---
# AI Factory Conventions
...
```
- Clean up legacy `.agent/rules/` if it exists.

- [ ] **Step 3: Update `cleanup()` and `getWelcomeMessage()` in `src/core/transformers/antigravity.ts`**

- In `cleanup()`: Remove installed skills from `.agents/skills/`, remove rules from `.agents/rules/`, and clean up any legacy `.agent/workflows/` files.
- In `getWelcomeMessage()`: Update instructions to mention `.agents/skills/`, `.agents/rules/`, and `.agents/mcp_config.json`.

- [ ] **Step 4: Compile and test**

Run: `npm run build`
Expected: Clean compilation with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/transformers/antigravity.ts
git commit -m "feat(antigravity): modernize transformer to Agent Skills and triggered rules"
```

---

### Task 3: Update Upgrade Logic and Documentation

**Files:**
- Modify: `src/cli/commands/upgrade.ts`
- Modify: `docs/getting-started.md`

**Interfaces:**
- Consumes: Upgrade workflow and docs table
- Produces: Clean migration of legacy Antigravity projects and accurate docs

- [ ] **Step 1: Update `upgrade.ts` legacy cleanup for Antigravity**

Ensure that upgrading an Antigravity project removes old `.agent/workflows/*.md` files and properly installs to `.agents/skills/`.

- [ ] **Step 2: Update `docs/getting-started.md`**

Update the agent table in `docs/getting-started.md`:
Change Antigravity row from `.agent/` and `.agent/skills/, .agent/workflows/` to `.agents/` and `.agents/skills/`, and list MCP as supported (`.agents/mcp_config.json`).

- [ ] **Step 3: Compile and lint**

Run: `npm run build && npm run lint:unused`
Expected: Exits with 0.

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/upgrade.ts docs/getting-started.md
git commit -m "docs(antigravity): update docs and upgrade migration for Antigravity 2.0"
```

---

### Task 4: Automated Testing & End-to-End Verification

**Files:**
- Modify: `scripts/test-init.sh`
- Test: Run init smoke test against Antigravity

- [ ] **Step 1: Update `scripts/test-init.sh` Antigravity smoke test section**

Lines 382-395: Update assertions to check `.agents/skills/aif/SKILL.md`, `.agents/skills/aif-rules-check/SKILL.md`, `.agents/rules/aif-guardrails.md`, and verify `.agent/workflows/` is NOT created.

- [ ] **Step 2: Run all existing unit and target tests**

Run: `node scripts/test-codex-skill-targets.mjs --group=control,targets,core,preflight,migration,extensions,ownership,cli,upgrade`
Expected: All tests PASS.

- [ ] **Step 3: Run full end-to-end init smoke test for Antigravity**

Run a script in a temporary test directory testing `ai-factory init --agents antigravity --skills aif,aif-plan --filesystem=true --github=false`.
Verify:
1. `.agents/skills/aif/SKILL.md` exists and contains `name: aif` and `description:`.
2. `.agents/mcp_config.json` exists with valid `mcpServers.filesystem`.
3. `.agents/rules/aif-guardrails.md` contains `trigger: always_on`.
4. `.agents/rules/aif-conventions.md` contains `trigger: model_decision`.
5. No `.agent/workflows/` folder exists.

- [ ] **Step 4: Commit and push**

```bash
git add scripts/test-init.sh
git commit -m "test(antigravity): update init smoke test for Antigravity 2.0"
```
