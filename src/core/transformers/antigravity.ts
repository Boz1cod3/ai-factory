import type { AgentTransformer, TransformResult } from '../transformer.js';

import {
  writeTextFile,
  fileExists,
  removeFile,
  removeDirectory,
  copyFile,
  listFilesRecursive,
  readFileBuffer,
} from '../../utils/fs.js';
import fs from 'fs-extra';
import path from 'path';

const KNOWN_LEGACY_RULE_FILES = new Set([
  'aif-guardrails.md',
  'aif-conventions.md',
]);

const KNOWN_LEGACY_WORKFLOW_FILES = new Set([
  // AI Factory v2 prefixed names
  'aif.md',
  'aif-architecture.md',
  'aif-archive.md',
  'aif-best-practices.md',
  'aif-build-automation.md',
  'aif-ci.md',
  'aif-commit.md',
  'aif-distillation.md',
  'aif-dockerize.md',
  'aif-docs.md',
  'aif-evolve.md',
  'aif-explore.md',
  'aif-fix.md',
  'aif-grounded.md',
  'aif-implement.md',
  'aif-improve.md',
  'aif-loop.md',
  'aif-plan.md',
  'aif-qa.md',
  'aif-qa-check.md',
  'aif-reference.md',
  'aif-review.md',
  'aif-roadmap.md',
  'aif-rules.md',
  'aif-rules-check.md',
  'aif-security-checklist.md',
  'aif-skill-generator.md',
  'aif-transfer.md',
  'aif-verify.md',
  'aif-warmup.md',
  // AI Factory v1 bare names
  'architecture.md',
  'archive.md',
  'best-practices.md',
  'build-automation.md',
  'ci.md',
  'commit.md',
  'distillation.md',
  'dockerize.md',
  'docs.md',
  'evolve.md',
  'explore.md',
  'feature.md',
  'fix.md',
  'grounded.md',
  'implement.md',
  'improve.md',
  'loop.md',
  'plan.md',
  'qa.md',
  'qa-check.md',
  'reference.md',
  'review.md',
  'roadmap.md',
  'rules.md',
  'rules-check.md',
  'security-checklist.md',
  'skill-generator.md',
  'task.md',
  'transfer.md',
  'verify.md',
  'warmup.md',
]);

const KNOWN_LEGACY_WORKFLOW_REFERENCES = new Set([
  'config-template.yaml',
  'update-config.mjs',
  'RULES-CHECK-CONTRACT.md',
  'README.md',
]);

const KNOWN_AGENT_FILES = new Set([
  'best-practices-sidecar.md',
  'commit-preparer.md',
  'docs-auditor.md',
  'implement-coordinator.md',
  'implement-worker.md',
  'plan-coordinator.md',
  'plan-polisher.md',
  'review-sidecar.md',
  'rules-sidecar.md',
  'security-sidecar.md',
]);

async function removeEmptyDirBottomUp(dirPath: string): Promise<boolean> {
  if (!await fileExists(dirPath)) {
    return true;
  }
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirBottomUp(path.join(dirPath, entry.name));
    }
  }
  try {
    const remaining = await fs.readdir(dirPath);
    if (remaining.length === 0) {
      await removeDirectory(dirPath);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

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
    return this.cleanupTargetSkills(projectDir, skillsDir);
  }

  async cleanupTargetSkills(projectDir: string, skillsDir?: string): Promise<void> {
    const configDir = skillsDir ? path.dirname(skillsDir) : '.agents';
    const modernRulesDir = path.join(projectDir, configDir, 'rules');
    for (const ruleFile of KNOWN_LEGACY_RULE_FILES) {
      const rulePath = path.join(modernRulesDir, ruleFile);
      if (await fileExists(rulePath)) {
        await removeFile(rulePath);
      }
    }

    // Ownership-aware cleanup of legacy .agents/subagents
    const legacySubagentsDir = path.join(projectDir, '.agents', 'subagents');
    const targetAgentsDir = path.join(projectDir, '.agents', 'agents');
    if (await fileExists(legacySubagentsDir)) {
      const files = await listFilesRecursive(legacySubagentsDir);
      for (const file of files) {
        const relPath = path.relative(legacySubagentsDir, file).replaceAll('\\', '/');
        const destPath = path.join(targetAgentsDir, relPath);
        const collision = await fileExists(destPath);
        if (!collision) {
          await copyFile(file, destPath);
          await removeFile(file);
        } else if (KNOWN_AGENT_FILES.has(relPath)) {
          const [srcBuf, destBuf] = await Promise.all([
            readFileBuffer(file),
            readFileBuffer(destPath),
          ]);
          if (srcBuf && destBuf && srcBuf.equals(destBuf)) {
            await removeFile(file);
          }
        }
      }
      await removeEmptyDirBottomUp(legacySubagentsDir);
    }

    // Ownership-aware cleanup of legacy v1 .agent workflows
    const legacyWorkflowsDir = path.join(projectDir, '.agent', 'workflows');
    if (await fileExists(legacyWorkflowsDir)) {
      for (const workflowFile of KNOWN_LEGACY_WORKFLOW_FILES) {
        const workflowPath = path.join(legacyWorkflowsDir, workflowFile);
        if (await fileExists(workflowPath)) {
          await removeFile(workflowPath);
        }
      }
      const legacyReferencesDir = path.join(legacyWorkflowsDir, 'references');
      if (await fileExists(legacyReferencesDir)) {
        for (const refFile of KNOWN_LEGACY_WORKFLOW_REFERENCES) {
          const refPath = path.join(legacyReferencesDir, refFile);
          if (await fileExists(refPath)) {
            await removeFile(refPath);
          }
        }
      }
      await removeEmptyDirBottomUp(legacyWorkflowsDir);
    }

    // Ownership-aware cleanup of legacy v1 .agent rules
    const legacyRulesDir = path.join(projectDir, '.agent', 'rules');
    if (await fileExists(legacyRulesDir)) {
      for (const ruleFile of KNOWN_LEGACY_RULE_FILES) {
        const rulePath = path.join(legacyRulesDir, ruleFile);
        if (await fileExists(rulePath)) {
          await removeFile(rulePath);
        }
      }
      await removeEmptyDirBottomUp(legacyRulesDir);
    }

    // Only remove .agent/ if it has become completely empty
    const legacyAgentDir = path.join(projectDir, '.agent');
    if (await fileExists(legacyAgentDir)) {
      await removeEmptyDirBottomUp(legacyAgentDir);
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
