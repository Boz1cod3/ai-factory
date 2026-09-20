import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { installSkills, buildManagedSkillsState } from '../dist/core/installer.js';

const ROOT_DIR = path.resolve('.');
const TEST_DIR = path.join(ROOT_DIR, 'temp-test-ag');

console.log('--- Running Antigravity 2.0 End-to-End Test ---');

try {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const cliPath = path.join(ROOT_DIR, 'dist', 'cli', 'index.js');
  const initCmd = `node "${cliPath}" init --agents antigravity --skills aif,aif-plan --mcp filesystem`;
  console.log(`Running: ${initCmd} in ${TEST_DIR}`);

  const output = execSync(initCmd, {
    cwd: TEST_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(output);

  // 1. Check Skills directory and format
  const aifSkillPath = path.join(TEST_DIR, '.agents', 'skills', 'aif', 'SKILL.md');
  const aifPlanSkillPath = path.join(TEST_DIR, '.agents', 'skills', 'aif-plan', 'SKILL.md');
  assert(fs.existsSync(aifSkillPath), '.agents/skills/aif/SKILL.md must exist');
  assert(fs.existsSync(aifPlanSkillPath), '.agents/skills/aif-plan/SKILL.md must exist');

  const aifContent = fs.readFileSync(aifSkillPath, 'utf8');
  assert(aifContent.startsWith('---\n'), 'SKILL.md must start with frontmatter');
  assert(aifContent.includes('name: aif\n'), 'SKILL.md must preserve name: frontmatter');
  assert(aifContent.includes('description:'), 'SKILL.md must preserve description: frontmatter');

  // 2. Check Rules with triggers
  const guardrailsPath = path.join(TEST_DIR, '.agents', 'rules', 'aif-guardrails.md');
  const conventionsPath = path.join(TEST_DIR, '.agents', 'rules', 'aif-conventions.md');
  assert(fs.existsSync(guardrailsPath), '.agents/rules/aif-guardrails.md must exist');
  assert(fs.existsSync(conventionsPath), '.agents/rules/aif-conventions.md must exist');

  const guardrailsContent = fs.readFileSync(guardrailsPath, 'utf8');
  assert(guardrailsContent.includes('trigger: always_on'), 'Guardrails must have trigger: always_on');
  const conventionsContent = fs.readFileSync(conventionsPath, 'utf8');
  assert(conventionsContent.includes('trigger: model_decision'), 'Conventions must have trigger: model_decision');

  // 3. Check MCP configuration
  const mcpConfigPath = path.join(TEST_DIR, '.agents', 'mcp_config.json');
  assert(fs.existsSync(mcpConfigPath), '.agents/mcp_config.json must exist');
  const mcpJson = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  assert(mcpJson.mcpServers, 'mcp_config.json must have root key mcpServers');
  assert(mcpJson.mcpServers.filesystem, 'mcp_config.json must include filesystem server');

  // 4. Check Subagents
  const subagentsDir = path.join(TEST_DIR, '.agents', 'agents');
  assert(fs.existsSync(subagentsDir), '.agents/agents/ must exist');
  const expectedSubagents = [
    'implement-coordinator.md',
    'implement-worker.md',
    'review-sidecar.md',
    'security-sidecar.md',
    'best-practices-sidecar.md',
    'rules-sidecar.md',
    'plan-coordinator.md',
    'plan-polisher.md',
    'commit-preparer.md',
    'docs-auditor.md',
  ];
  for (const subagent of expectedSubagents) {
    const subagentPath = path.join(subagentsDir, subagent);
    assert(fs.existsSync(subagentPath), `Subagent ${subagent} must be installed in .agents/agents/`);
    const content = fs.readFileSync(subagentPath, 'utf8');
    assert(content.includes('subagent: true'), `Subagent ${subagent} must declare subagent: true`);
  }

  // 5. Check .ai-factory.json state
  const configPath = path.join(TEST_DIR, '.ai-factory.json');
  assert(fs.existsSync(configPath), '.ai-factory.json must exist');
  const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const agAgent = configJson.agents.find(a => a.id === 'antigravity');
  assert(agAgent, 'Antigravity agent must be in config.agents');
  assert.strictEqual(agAgent.skillsDir, '.agents/skills');
  assert.strictEqual(agAgent.agentsDir, '.agents/agents');
  assert(agAgent.installedSkills.includes('aif'));
  assert(agAgent.installedSkills.includes('aif-plan'));
  assert.strictEqual(agAgent.installedAgentFiles.length, 10);
  assert(agAgent.managedAgentFiles['implement-coordinator.md'].sourceHash, 'managedAgentFiles must have sourceHash');
  assert(agAgent.managedAgentFiles['implement-coordinator.md'].installedHash, 'managedAgentFiles must have installedHash');

  // 6. Check that legacy .agent/workflows does NOT exist
  const legacyWorkflowDir = path.join(TEST_DIR, '.agent', 'workflows');
  assert(!fs.existsSync(legacyWorkflowDir), 'Legacy .agent/workflows/ must NOT exist');

  // 7. Test ai-factory update
  console.log('\nTesting: ai-factory update');
  const updateOutput = execSync(`node "${cliPath}" update`, {
    cwd: TEST_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(updateOutput);
  assert(updateOutput.includes('[antigravity] Status:'), 'Update output must include [antigravity] Status:');

  // 8. Test ai-factory update --force
  console.log('\nTesting: ai-factory update --force');
  const forceUpdateOutput = execSync(`node "${cliPath}" update --force`, {
    cwd: TEST_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(forceUpdateOutput);
  assert(forceUpdateOutput.includes('Force mode enabled'), 'Force update must show Force mode enabled');

  // 9. Test upgrading an existing Antigravity 1.0 project (verify legacy deinstallation and purge)
  console.log('\nTesting: ai-factory upgrade from legacy Antigravity 1.0 structure');
  const LEGACY_DIR = path.join(ROOT_DIR, 'temp-test-legacy-ag');
  try {
    if (fs.existsSync(LEGACY_DIR)) {
      fs.rmSync(LEGACY_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(LEGACY_DIR, { recursive: true });

    // Simulate Antigravity 1.0 project layout
    const legacyWorkflows = path.join(LEGACY_DIR, '.agent', 'workflows');
    const legacyRules = path.join(LEGACY_DIR, '.agent', 'rules');
    fs.mkdirSync(legacyWorkflows, { recursive: true });
    fs.mkdirSync(legacyRules, { recursive: true });

    fs.writeFileSync(path.join(legacyWorkflows, 'aif.md'), '# Legacy workflow\n');
    fs.writeFileSync(path.join(legacyWorkflows, 'aif-plan.md'), '# Legacy plan workflow\n');
    fs.writeFileSync(path.join(legacyRules, 'aif-guardrails.md'), '# Legacy rule without trigger\n');

    await installSkills({
      projectDir: LEGACY_DIR,
      agentId: 'antigravity',
      skillsDir: '.agent/skills',
      skills: ['aif', 'aif-plan'],
    });

    const legacyAgent = {
      id: 'antigravity',
      skillsDir: '.agent/skills',
      installedSkills: ['aif', 'aif-plan'],
      mcp: { github: false, filesystem: false, postgres: false, chromeDevtools: false, playwright: false },
    };
    legacyAgent.managedSkills = await buildManagedSkillsState(LEGACY_DIR, legacyAgent, legacyAgent.installedSkills);

    fs.writeFileSync(path.join(LEGACY_DIR, '.ai-factory.json'), JSON.stringify({
      version: '2.0.0',
      agents: [legacyAgent],
      extensions: [],
    }, null, 2));

    const upgradeOutput = execSync(`node "${cliPath}" upgrade`, {
      cwd: LEGACY_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(upgradeOutput);

    // Verify legacy .agent/workflows and .agent/rules are completely purged
    assert(!fs.existsSync(legacyWorkflows), 'Legacy .agent/workflows must be completely purged on upgrade');
    assert(!fs.existsSync(legacyRules), 'Legacy .agent/rules must be completely purged on upgrade');

    // Verify modern Antigravity 2.0 structure is installed
    assert(fs.existsSync(path.join(LEGACY_DIR, '.agents', 'skills', 'aif', 'SKILL.md')), 'Modern .agents/skills/aif/SKILL.md must be installed');
    assert(fs.existsSync(path.join(LEGACY_DIR, '.agents', 'agents', 'implement-coordinator.md')), 'Modern .agents/agents/ must be installed');

    // Verify .ai-factory.json migrated skillsDir
    const upgradedConfig = JSON.parse(fs.readFileSync(path.join(LEGACY_DIR, '.ai-factory.json'), 'utf8'));
    const upgradedAg = upgradedConfig.agents.find(a => a.id === 'antigravity');
    assert.strictEqual(upgradedAg.skillsDir, '.agents/skills', 'skillsDir must be migrated to .agents/skills');
    assert.strictEqual(upgradedAg.agentsDir, '.agents/agents', 'agentsDir must be .agents/agents');
    console.log('✓ Legacy Antigravity 1.0 deinstallation and v2 upgrade verified successfully!');
  } finally {
    if (fs.existsSync(LEGACY_DIR)) {
      fs.rmSync(LEGACY_DIR, { recursive: true, force: true });
    }
  }

  // 10. Test upgrading an existing Antigravity project with legacy .agents/subagents
  console.log('\nTesting: ai-factory upgrade from legacy .agents/subagents layout');
  const SUBAGENTS_MIGRATION_DIR = path.join(ROOT_DIR, 'temp-test-subagents-migration');
  try {
    if (fs.existsSync(SUBAGENTS_MIGRATION_DIR)) {
      fs.rmSync(SUBAGENTS_MIGRATION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SUBAGENTS_MIGRATION_DIR, { recursive: true });

    const oldSubagentsDir = path.join(SUBAGENTS_MIGRATION_DIR, '.agents', 'subagents');
    fs.mkdirSync(oldSubagentsDir, { recursive: true });
    fs.writeFileSync(path.join(oldSubagentsDir, 'custom-agent.md'), '---\nname: custom-agent\nsubagent: true\n---\nCustom agent\n');
    const nestedSubDir = path.join(oldSubagentsDir, 'custom-group');
    fs.mkdirSync(nestedSubDir, { recursive: true });
    fs.writeFileSync(path.join(nestedSubDir, 'nested-agent.md'), '---\nname: nested-agent\nsubagent: true\n---\nNested agent\n');

    await installSkills({
      projectDir: SUBAGENTS_MIGRATION_DIR,
      agentId: 'antigravity',
      skillsDir: '.agents/skills',
      skills: ['aif', 'aif-plan'],
    });

    const agSubagentsAgent = {
      id: 'antigravity',
      skillsDir: '.agents/skills',
      agentsDir: '.agents/subagents',
      installedSkills: ['aif', 'aif-plan'],
      installedAgentFiles: ['custom-agent.md'],
      mcp: { github: false, filesystem: false, postgres: false, chromeDevtools: false, playwright: false },
    };
    agSubagentsAgent.managedSkills = await buildManagedSkillsState(SUBAGENTS_MIGRATION_DIR, agSubagentsAgent, agSubagentsAgent.installedSkills);

    fs.writeFileSync(path.join(SUBAGENTS_MIGRATION_DIR, '.ai-factory.json'), JSON.stringify({
      version: '2.18.0',
      agents: [agSubagentsAgent],
      extensions: [],
    }, null, 2));

    const migrationUpgradeOutput = execSync(`node "${cliPath}" upgrade`, {
      cwd: SUBAGENTS_MIGRATION_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(migrationUpgradeOutput);

    // Verify .agents/subagents is removed and .agents/agents has files
    assert(!fs.existsSync(oldSubagentsDir), 'Legacy .agents/subagents must be removed after upgrade');
    const newAgentsDir = path.join(SUBAGENTS_MIGRATION_DIR, '.agents', 'agents');
    assert(fs.existsSync(newAgentsDir), '.agents/agents must exist after upgrade');
    assert(fs.existsSync(path.join(newAgentsDir, 'custom-agent.md')), 'Pre-existing custom-agent.md must be migrated to .agents/agents');
    assert(fs.existsSync(path.join(newAgentsDir, 'custom-group', 'nested-agent.md')), 'Pre-existing nested custom agent must be migrated to .agents/agents');
    assert(fs.existsSync(path.join(newAgentsDir, 'implement-coordinator.md')), 'New agents must be installed in .agents/agents');

    const migratedConfig = JSON.parse(fs.readFileSync(path.join(SUBAGENTS_MIGRATION_DIR, '.ai-factory.json'), 'utf8'));
    const migratedAg = migratedConfig.agents.find(a => a.id === 'antigravity');
    assert.strictEqual(migratedAg.agentsDir, '.agents/agents', 'agentsDir must be migrated to .agents/agents in config');
    console.log('✓ Migration from .agents/subagents to .agents/agents verified successfully!');
  } finally {
    if (fs.existsSync(SUBAGENTS_MIGRATION_DIR)) {
      fs.rmSync(SUBAGENTS_MIGRATION_DIR, { recursive: true, force: true });
    }
  }

  console.log('\n✅ ALL ANTIGRAVITY 2.0 CHECKS PASSED SUCCESSFULLY!\n');
} finally {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}
