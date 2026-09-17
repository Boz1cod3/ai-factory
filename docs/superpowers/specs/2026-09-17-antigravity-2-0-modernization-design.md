# Design Specification: Antigravity 2.0 Modernization in ai-factory

## 1. Overview and Problem Statement

`ai-factory` currently supports Google Antigravity using a legacy 1.0 architecture that treats action skills as flat workflows (`.agent/workflows/<name>.md`). This approach has several critical flaws:
1. **Deprecated Flat Workflows**: In Antigravity 2.0, flat workflows in `.agent/workflows/` are deprecated in favor of the unified Agent Skills standard (`.agents/skills/<name>/SKILL.md`).
2. **Stripped Frontmatter Metadata**: The `simplifyFrontmatter()` function strips the `name:` field from YAML frontmatter, breaking slash command autocompletion (`/aif`, `/aif-plan`, `/aif-verify`) and semantic agent discovery in Antigravity 2.0.
3. **Reference Asset Collisions**: Workflow skills copy their `references/` directories into a single shared folder (`.agent/workflows/references/`), leading to silent file overwrites.
4. **Disabled MCP Support**: In `src/core/agents.ts`, Antigravity is configured with `supportsMcp: false` and `settingsFile: null`, preventing automatic configuration of MCP servers (GitHub, Postgres, Filesystem, Playwright, Chrome DevTools).
5. **Legacy Directory Name**: Uses `.agent/` (singular) rather than the standard `.agents/` (plural) directory.
6. **Untriggered Rule Files**: Guardrails and conventions are written without YAML frontmatter triggers (`trigger: always_on`, `trigger: model_decision`), causing context bloating.

This specification outlines the architectural changes required to bring `ai-factory` into 100% compliance with Google Antigravity 2.0 standards.

---

## 2. Architecture & Design

### 2.1 Agent Definition (`src/core/agents.ts`)

Update `BUILTIN_AGENT_REGISTRY.antigravity`:
- `configDir`: Change from `'.agent'` to `'.agents'`.
- `skillsDir`: Change from `'.agent/skills'` to `'.agents/skills'`.
- `settingsFile`: Change from `null` to `'.agents/mcp_config.json'`.
- `supportsMcp`: Change from `false` to `true`.
- `skillsCliAgent`: Retain `'antigravity'`.

### 2.2 Skill Transformation (`src/core/transformers/antigravity.ts`)

Eliminate the flat workflow branching:
- **Unified Skill Packaging**: All skills (including `WORKFLOW_SKILLS` such as `aif`, `aif-plan`, `aif-implement`, `aif-fix`, `aif-verify`) are installed as directories:
  ```text
  .agents/skills/<skill-name>/
  ├── SKILL.md
  ├── references/
  └── scripts/
  ```
- **Preserve Full Frontmatter**: Do not strip YAML frontmatter. Keep `name:` and `description:` intact to enable native slash commands and Progressive Disclosure.
- **TransformResult**:
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

### 2.3 Rules and Guardrails (`postInstall`)

In `AntigravityTransformer.postInstall(projectDir)`:
- Target directory: `.agents/rules/`.
- `aif-guardrails.md`:
  ```markdown
  ---
  trigger: always_on
  ---
  # AI Factory Guardrails
  ...
  ```
- `aif-conventions.md`:
  ```markdown
  ---
  trigger: model_decision
  ---
  # AI Factory Conventions
  ...
  ```
- Clean up any legacy rules in `.agent/rules/` if present from an earlier install.

### 2.4 Cleanup & Migration (`cleanup`, `upgrade.ts`)

In `AntigravityTransformer.cleanup()`:
- Remove `.agents/skills/` entries for installed skills.
- Remove `.agents/rules/aif-guardrails.md` and `.agents/rules/aif-conventions.md`.
- Legacy cleanup: Remove any deprecated `.agent/workflows/*.md` and `.agent/workflows/references/` from earlier legacy installations to prevent stale files from persisting.

In `src/cli/commands/upgrade.ts`:
- Update legacy cleanup routines to handle the transition from `.agent/workflows/` and `.agent/skills/` to `.agents/skills/`.

### 2.5 MCP Integration Verification (`src/core/mcp.ts`)

In `src/core/mcp.ts`:
- `resolveMcpSettingsFormat('antigravity')` returns `'standard'`.
- `getContainerKey('standard')` returns `'mcpServers'`.
- This automatically produces `.agents/mcp_config.json`:
  ```json
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
      }
    }
  }
  ```
  Fully compliant with Antigravity 2.0 workspace-level MCP specification.

---

## 3. Files Impacted

1. `src/core/agents.ts`: Update Antigravity `AgentConfig`.
2. `src/core/transformers/antigravity.ts`: Refactor `AntigravityTransformer` (transform, postInstall, cleanup, welcome message).
3. `src/cli/commands/upgrade.ts`: Update migration handling for Antigravity.
4. `docs/getting-started.md`: Update Antigravity directory table and MCP support status.
5. `scripts/test-init.sh` & `scripts/test-update.sh`: Update Antigravity assertions for `.agents/skills/` and `.agents/mcp_config.json`.

---

## 4. Verification Plan

1. **Build**: `npm run build` (TypeScript compilation with `tsc`).
2. **Unit & Integration Tests**:
   - `node scripts/test-codex-skill-targets.mjs`
   - `node scripts/test-managed-skill-receipts.mjs`
   - `node scripts/test-skill-migration-modes.mjs`
3. **End-to-End Init Smoke Test**:
   - Run `ai-factory init --agents antigravity --skills aif,aif-plan --github=false --filesystem=true` in a temporary directory.
   - Verify `.agents/skills/aif/SKILL.md` exists and contains valid YAML frontmatter.
   - Verify `.agents/mcp_config.json` exists with `mcpServers.filesystem`.
   - Verify `.agents/rules/aif-guardrails.md` contains `trigger: always_on`.
   - Verify `.agents/rules/aif-conventions.md` contains `trigger: model_decision`.
   - Verify no `.agent/workflows/` directory is created.
4. **Linting**:
   - `npm run lint:unused`
