import type { AgentTransformer, TransformResult } from '../transformer.js';

import { writeTextFile, fileExists, removeFile, removeDirectory, listDirectories } from '../../utils/fs.js';
import path from 'path';

export class AntigravityTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    return {
      targetDir: skillName,
      targetName: 'SKILL.md',
      content,
      flat: false,
    };
  }

  async postInstall(projectDir: string): Promise<void> {
    const rulesDir = path.join(projectDir, '.agents', 'rules');

    const guardrailsContent = `---
trigger: always_on
---

# AI Factory Guardrails

## Project Conventions

- Follow existing code style and patterns in the project
- Use conventional commits format for all commit messages
- Always check for existing implementations before creating new ones
- Prefer editing existing files over creating new ones
- Run tests after making changes when test infrastructure exists

## Language Conventions

- Write implementation plans (\`PLAN.md\`), architectural specifications, code, variables, and code comments in English.
- Follow configured project language preferences for user communication and task logs.

## Skill Usage

- Use \`/aif-explore\` to think through ideas before planning — no implementation, just exploration
- Use \`/aif-warmup\` to load project context at session start or before a fork
- Use \`/aif-plan\` for new features — creates branch, plan, and tasks
- Use \`/aif-fix\` for bug fixes — analyzes, fixes, suggests tests
- Use \`/aif-implement\` to execute plans step by step
- Use \`/aif-verify\` to verify implementation against plan
- Use \`/aif-rules-check\` for a standalone project rules gate
- Use \`/aif-review\` before merging — checks code quality
- Use \`/aif-commit\` for commits — follows conventional commits

## Safety

- Never commit secrets, tokens, or credentials
- Never force-push to main/master branches
- Always create feature branches for new work
`;

    const conventionsContent = `---
trigger: model_decision
---

# AI Factory Conventions

## Workflow Structure

AI Factory organizes tools and customizations for Antigravity 2.0:

### Skills (.agents/skills/)
Modular Agent Skills with multi-file support and metadata:
- \`aif-explore/\` — Think through ideas, investigate problems
- \`aif-plan/\` — Plan and develop new features
- \`aif-fix/\` — Fix bugs with structured approach
- \`aif-implement/\` — Execute plans step by step
- \`aif-verify/\` — Verify implementation against plan
- \`aif-commit/\` — Create conventional commits
- \`aif-rules-check/\` — Run a standalone rules compliance gate
- \`aif-warmup/\` — Load startup context for a session or fork
- \`aif-review/\` — Code review checklist
- \`aif-ci/\` — CI/CD pipeline setup
- \`aif-best-practices/\` — Code quality standards
- \`aif-architecture/\` — Architecture decision records
- \`aif-roadmap/\` — Strategic project roadmap
- \`aif-rules/\` — Project rules and conventions
- \`aif-loop/\` — Iterative reflex loop
- \`aif-qa/\` — QA test generation

### Agents (.agents/agents/)
Native autonomous agents for parallel execution and quality sidecars:
- \`implement-coordinator.md\` — Parallel execution coordinator
- \`implement-worker.md\` — Bounded implementation worker
- \`plan-coordinator.md\` — Planning and polish coordinator
- \`plan-polisher.md\` — Plan refinement worker
- \`review-sidecar.md\` — Read-only code review auditor
- \`security-sidecar.md\` — Read-only security auditor
- \`best-practices-sidecar.md\` — Read-only best practices auditor
- \`rules-sidecar.md\` — Standalone rules compliance auditor
- \`commit-preparer.md\` — Conventional commit inspection sidecar
- \`docs-auditor.md\` — Documentation audit sidecar

### Rules (.agents/rules/)
Project rules with YAML frontmatter triggers:
- \`aif-guardrails.md\` (\`trigger: always_on\`) — Always-active guardrails and conventions
- \`aif-conventions.md\` (\`trigger: model_decision\`) — Contextual conventions

### MCP Servers (.agents/mcp_config.json)
Standard Model Context Protocol configuration with workspace scope.
`;

    await writeTextFile(path.join(rulesDir, 'aif-guardrails.md'), guardrailsContent);
    await writeTextFile(path.join(rulesDir, 'aif-conventions.md'), conventionsContent);
  }

  async cleanup(projectDir: string, skillsDir: string): Promise<void> {
    const configDir = path.dirname(skillsDir);
    const modernRulesDir = path.join(projectDir, configDir, 'rules');
    for (const ruleFile of ['aif-guardrails.md', 'aif-conventions.md']) {
      const rulePath = path.join(modernRulesDir, ruleFile);
      if (await fileExists(rulePath)) {
        await removeFile(rulePath);
      }
    }

    // Purge legacy .agents/subagents if present
    const legacySubagentsDir = path.join(projectDir, '.agents', 'subagents');
    if (await fileExists(legacySubagentsDir)) {
      await removeDirectory(legacySubagentsDir);
    }

    // Purge legacy v1 .agent artifacts if present
    const legacyWorkflowsDir = path.join(projectDir, '.agent', 'workflows');
    if (await fileExists(legacyWorkflowsDir)) {
      await removeDirectory(legacyWorkflowsDir);
    }
    const legacyRulesDir = path.join(projectDir, '.agent', 'rules');
    if (await fileExists(legacyRulesDir)) {
      await removeDirectory(legacyRulesDir);
    }
    const legacyAgentDir = path.join(projectDir, '.agent');
    if (await fileExists(legacyAgentDir)) {
      const remaining = await listDirectories(legacyAgentDir);
      if (remaining.length === 0) {
        await removeDirectory(legacyAgentDir);
      }
    }
  }

  getWelcomeMessage(): string[] {
    return [
      '1. Open Antigravity 2.0 in this directory',
      '2. Skills installed in .agents/skills/ (standard multi-file SKILL.md format)',
      '3. Agents installed in .agents/agents/ (parallel workers and sidecars)',
      '4. Rules installed in .agents/rules/ (triggered guardrails and conventions)',
      '5. MCP servers configured in .agents/mcp_config.json',
      '6. Run /aif to analyze project and generate project-relevant skills',
    ];
  }

  getInvocationHint(): string {
    return 'Antigravity: /aif-plan, /aif-commit, agy --agent implement-coordinator';
  }
}
