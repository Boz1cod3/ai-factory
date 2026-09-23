import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { installSkills, buildManagedSkillsState } from '../dist/core/installer.js';
import { AntigravityTransformer } from '../dist/core/transformers/antigravity.js';

const ROOT_DIR = path.resolve('.');
const TEST_DIR = path.join(ROOT_DIR, 'temp-test-ag');

function safeRmSync(dir) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      // Ignore temporary file-lock cleanup errors on Windows
    }
  }
}

const CUSTOM_WORKFLOW_REL = path.join('.agent', 'workflows', 'user-custom-workflow.md');
const CUSTOM_RULE_REL = path.join('.agent', 'rules', 'user-custom-rule.md');
const CUSTOM_SETTINGS_REL = path.join('.agent', 'settings.json');
const CUSTOM_SUBAGENT_REL = path.join('.agents', 'subagents', 'user-custom-agent.md');

const CUSTOM_WORKFLOW_CONTENT = '# User Custom Workflow\nDo not delete\n';
const CUSTOM_RULE_CONTENT = '# User Custom Rule\nDo not delete\n';
const CUSTOM_SETTINGS_CONTENT = '{\n  "customUserSetting": true\n}\n';
const CUSTOM_SUBAGENT_CONTENT = '# User Custom Agent\nDo not delete\n';

function setupCustomUserFiles(baseDir) {
  const workflowPath = path.join(baseDir, CUSTOM_WORKFLOW_REL);
  const rulePath = path.join(baseDir, CUSTOM_RULE_REL);
  const settingsPath = path.join(baseDir, CUSTOM_SETTINGS_REL);
  const subagentPath = path.join(baseDir, CUSTOM_SUBAGENT_REL);

  fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
  fs.mkdirSync(path.dirname(rulePath), { recursive: true });
  fs.mkdirSync(path.dirname(subagentPath), { recursive: true });

  fs.writeFileSync(workflowPath, CUSTOM_WORKFLOW_CONTENT);
  fs.writeFileSync(rulePath, CUSTOM_RULE_CONTENT);
  fs.writeFileSync(settingsPath, CUSTOM_SETTINGS_CONTENT);
  fs.writeFileSync(subagentPath, CUSTOM_SUBAGENT_CONTENT);
}

function assertCustomUserFilesPreserved(baseDir, contextLabel = '') {
  const workflowPath = path.join(baseDir, CUSTOM_WORKFLOW_REL);
  const rulePath = path.join(baseDir, CUSTOM_RULE_REL);
  const settingsPath = path.join(baseDir, CUSTOM_SETTINGS_REL);
  const subagentPath = path.join(baseDir, CUSTOM_SUBAGENT_REL);

  assert(fs.existsSync(workflowPath), `${contextLabel}: .agent/workflows/user-custom-workflow.md must be preserved`);
  assert.strictEqual(fs.readFileSync(workflowPath, 'utf8'), CUSTOM_WORKFLOW_CONTENT, `${contextLabel}: user-custom-workflow.md content mismatch`);

  assert(fs.existsSync(rulePath), `${contextLabel}: .agent/rules/user-custom-rule.md must be preserved`);
  assert.strictEqual(fs.readFileSync(rulePath, 'utf8'), CUSTOM_RULE_CONTENT, `${contextLabel}: user-custom-rule.md content mismatch`);

  assert(fs.existsSync(settingsPath), `${contextLabel}: .agent/settings.json must be preserved`);
  assert.strictEqual(fs.readFileSync(settingsPath, 'utf8'), CUSTOM_SETTINGS_CONTENT, `${contextLabel}: .agent/settings.json content mismatch`);

  assert(fs.existsSync(subagentPath), `${contextLabel}: .agents/subagents/user-custom-agent.md must be preserved`);
  assert.strictEqual(fs.readFileSync(subagentPath, 'utf8'), CUSTOM_SUBAGENT_CONTENT, `${contextLabel}: .agents/subagents/user-custom-agent.md content mismatch`);
}

console.log('--- Running Antigravity 2.0 End-to-End Test ---');

try {
  safeRmSync(TEST_DIR);
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Pre-create custom user files to verify they survive ai-factory init
  setupCustomUserFiles(TEST_DIR);

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

  // 6. Check that custom user files survived init and AI Factory legacy files were NOT installed in .agent/
  assertCustomUserFilesPreserved(TEST_DIR, 'ai-factory init');
  const legacyWorkflowDir = path.join(TEST_DIR, '.agent', 'workflows');
  assert(!fs.existsSync(path.join(legacyWorkflowDir, 'aif.md')), 'Legacy aif.md must not be installed in .agent/workflows/');
  assert(!fs.existsSync(path.join(legacyWorkflowDir, 'aif-plan.md')), 'Legacy aif-plan.md must not be installed in .agent/workflows/');
  assert(!fs.existsSync(path.join(TEST_DIR, '.agent', 'rules', 'aif-guardrails.md')), 'Legacy aif-guardrails.md must not be installed in .agent/rules/');
  console.log('✓ Custom user files preserved across ai-factory init!');

  // 7. Test ai-factory update (verify custom user files survive)
  console.log('\nTesting: ai-factory update');
  const updateOutput = execSync(`node "${cliPath}" update`, {
    cwd: TEST_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(updateOutput);
  assert(updateOutput.includes('[antigravity] Status:'), 'Update output must include [antigravity] Status:');
  assertCustomUserFilesPreserved(TEST_DIR, 'ai-factory update');
  console.log('✓ Custom user files preserved across ai-factory update!');

  // 8. Test ai-factory update --force (verify custom user files survive)
  console.log('\nTesting: ai-factory update --force');
  const forceUpdateOutput = execSync(`node "${cliPath}" update --force`, {
    cwd: TEST_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(forceUpdateOutput);
  assert(forceUpdateOutput.includes('Force mode enabled'), 'Force update must show Force mode enabled');
  assertCustomUserFilesPreserved(TEST_DIR, 'ai-factory update --force');
  console.log('✓ Custom user files preserved across ai-factory update --force!');

  // 9. Test upgrading an existing Antigravity 1.0 project (verify legacy deinstallation and purge)
  console.log('\nTesting: ai-factory upgrade from legacy Antigravity 1.0 structure');
  const LEGACY_DIR = path.join(ROOT_DIR, 'temp-test-legacy-ag');
  try {
    safeRmSync(LEGACY_DIR);
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
    safeRmSync(LEGACY_DIR);
  }

  // 9b. Test upgrading Antigravity 1.0 project with user-owned files in .agent and .agents
  console.log('\nTesting: ai-factory upgrade preserving user-owned files in .agent and .agents');
  const USER_FILES_DIR = path.join(ROOT_DIR, 'temp-test-user-files-ag');
  try {
    safeRmSync(USER_FILES_DIR);
    fs.mkdirSync(USER_FILES_DIR, { recursive: true });

    // Setup custom user files in all required locations
    setupCustomUserFiles(USER_FILES_DIR);

    const legacyWorkflows = path.join(USER_FILES_DIR, '.agent', 'workflows');
    const legacyRules = path.join(USER_FILES_DIR, '.agent', 'rules');

    // Legacy AI Factory files
    fs.writeFileSync(path.join(legacyWorkflows, 'aif.md'), '# Legacy workflow\n');
    fs.writeFileSync(path.join(legacyWorkflows, 'aif-plan.md'), '# Legacy plan workflow\n');
    fs.writeFileSync(path.join(legacyWorkflows, 'commit.md'), '# Legacy workflow\n');
    fs.writeFileSync(path.join(legacyRules, 'aif-guardrails.md'), '# Legacy rule\n');
    fs.writeFileSync(path.join(legacyRules, 'aif-conventions.md'), '# Legacy rule\n');

    // Additional user-owned custom files
    fs.writeFileSync(path.join(legacyWorkflows, 'my-custom-flow.md'), '# Custom workflow\n');
    fs.writeFileSync(path.join(legacyRules, 'team.md'), '# Team rules\n');

    await installSkills({
      projectDir: USER_FILES_DIR,
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
    legacyAgent.managedSkills = await buildManagedSkillsState(USER_FILES_DIR, legacyAgent, legacyAgent.installedSkills);

    fs.writeFileSync(path.join(USER_FILES_DIR, '.ai-factory.json'), JSON.stringify({
      version: '2.0.0',
      agents: [legacyAgent],
      extensions: [],
    }, null, 2));

    execSync(`node "${cliPath}" upgrade`, {
      cwd: USER_FILES_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Verify legacy AI Factory files were deleted
    assert(!fs.existsSync(path.join(legacyWorkflows, 'aif.md')), 'Legacy aif.md must be deleted');
    assert(!fs.existsSync(path.join(legacyWorkflows, 'aif-plan.md')), 'Legacy aif-plan.md must be deleted');
    assert(!fs.existsSync(path.join(legacyWorkflows, 'commit.md')), 'Legacy commit.md must be deleted');
    assert(!fs.existsSync(path.join(legacyRules, 'aif-guardrails.md')), 'Legacy aif-guardrails.md must be deleted');
    assert(!fs.existsSync(path.join(legacyRules, 'aif-conventions.md')), 'Legacy aif-conventions.md must be deleted');

    // Verify modern Antigravity 2.0 structure installed
    assert(fs.existsSync(path.join(USER_FILES_DIR, '.agents', 'skills', 'aif', 'SKILL.md')), 'Modern aif skill must be installed');
    assert(fs.existsSync(path.join(USER_FILES_DIR, '.agents', 'agents', 'implement-coordinator.md')), 'Modern agents must be installed');
    assert(fs.existsSync(path.join(USER_FILES_DIR, '.agents', 'rules', 'aif-guardrails.md')), 'Modern rules must be installed');

    // Verify user-owned files and parent directories were preserved
    assertCustomUserFilesPreserved(USER_FILES_DIR, 'ai-factory upgrade');
    assert(fs.existsSync(path.join(legacyWorkflows, 'my-custom-flow.md')), 'User-owned my-custom-flow.md must be preserved');
    assert(fs.existsSync(path.join(legacyRules, 'team.md')), 'User-owned team.md must be preserved');
    assert(fs.existsSync(path.join(USER_FILES_DIR, '.agent')), '.agent directory must be preserved when user files exist');
    assert(fs.existsSync(path.join(USER_FILES_DIR, '.agents', 'subagents')), '.agents/subagents directory must be preserved when user files exist');

    console.log('✓ Preservation of user-owned files during Antigravity upgrade verified successfully!');
  } finally {
    safeRmSync(USER_FILES_DIR);
  }

  // 10. Test upgrading an existing Antigravity project with legacy .agents/subagents
  console.log('\nTesting: ai-factory upgrade from legacy .agents/subagents layout');
  const SUBAGENTS_MIGRATION_DIR = path.join(ROOT_DIR, 'temp-test-subagents-migration');
  try {
    safeRmSync(SUBAGENTS_MIGRATION_DIR);
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
    safeRmSync(SUBAGENTS_MIGRATION_DIR);
  }

  // 11. Test AntigravityTransformer.cleanupTargetSkills / cleanup ownership-aware behavior directly
  console.log('\nTesting: AntigravityTransformer ownership-aware cleanup');
  const CLEANUP_TEST_DIR = path.join(ROOT_DIR, 'temp-test-cleanup-ag');
  try {
    safeRmSync(CLEANUP_TEST_DIR);
    fs.mkdirSync(CLEANUP_TEST_DIR, { recursive: true });

    const transformer = new AntigravityTransformer();

    const subagentsDir = path.join(CLEANUP_TEST_DIR, '.agents', 'subagents');
    const agentsDir = path.join(CLEANUP_TEST_DIR, '.agents', 'agents');
    const legacyWorkflows = path.join(CLEANUP_TEST_DIR, '.agent', 'workflows');
    const legacyRules = path.join(CLEANUP_TEST_DIR, '.agent', 'rules');

    fs.mkdirSync(subagentsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(legacyWorkflows, { recursive: true });
    fs.mkdirSync(legacyRules, { recursive: true });

    // 1. Subagents: one migratable, one colliding
    fs.writeFileSync(path.join(subagentsDir, 'unique-agent.md'), 'unique content\n');
    fs.writeFileSync(path.join(subagentsDir, 'colliding-agent.md'), 'subagents content\n');
    fs.writeFileSync(path.join(agentsDir, 'colliding-agent.md'), 'agents content\n');

    // 2. Legacy workflows: one known, one user-owned
    fs.writeFileSync(path.join(legacyWorkflows, 'aif-plan.md'), '# Known legacy workflow\n');
    fs.writeFileSync(path.join(legacyWorkflows, 'user-flow.md'), '# User workflow\n');

    // 3. Legacy rules: one known, one user-owned
    fs.writeFileSync(path.join(legacyRules, 'aif-guardrails.md'), '# Known legacy rule\n');
    fs.writeFileSync(path.join(legacyRules, 'team-rules.md'), '# User rule\n');

    // 4. Other user-owned file in .agent/
    fs.writeFileSync(path.join(CLEANUP_TEST_DIR, '.agent', 'notes.txt'), 'User notes\n');

    // Run ownership-aware cleanup
    await transformer.cleanup(CLEANUP_TEST_DIR, '.agents/skills');

    // Assert subagents behavior
    assert(fs.existsSync(path.join(agentsDir, 'unique-agent.md')), 'Unique subagent must be migrated to .agents/agents');
    assert.strictEqual(fs.readFileSync(path.join(agentsDir, 'unique-agent.md'), 'utf8'), 'unique content\n');
    assert(!fs.existsSync(path.join(subagentsDir, 'unique-agent.md')), 'Migrated subagent must be removed from .agents/subagents');
    assert(fs.existsSync(path.join(subagentsDir, 'colliding-agent.md')), 'Colliding subagent must be preserved in .agents/subagents');
    assert.strictEqual(fs.readFileSync(path.join(subagentsDir, 'colliding-agent.md'), 'utf8'), 'subagents content\n');
    assert.strictEqual(fs.readFileSync(path.join(agentsDir, 'colliding-agent.md'), 'utf8'), 'agents content\n', 'Colliding agent in destination must not be overwritten');
    assert(fs.existsSync(subagentsDir), '.agents/subagents must not be removed while preserving colliding files');

    // Assert workflows behavior
    assert(!fs.existsSync(path.join(legacyWorkflows, 'aif-plan.md')), 'Known legacy workflow must be deleted');
    assert(fs.existsSync(path.join(legacyWorkflows, 'user-flow.md')), 'User-owned workflow must be preserved');
    assert(fs.existsSync(legacyWorkflows), '.agent/workflows must not be removed while containing user files');

    // Assert rules behavior
    assert(!fs.existsSync(path.join(legacyRules, 'aif-guardrails.md')), 'Known legacy rule must be deleted');
    assert(fs.existsSync(path.join(legacyRules, 'team-rules.md')), 'User-owned rule must be preserved');
    assert(fs.existsSync(legacyRules), '.agent/rules must not be removed while containing user files');

    // Assert .agent/ behavior
    assert(fs.existsSync(path.join(CLEANUP_TEST_DIR, '.agent', 'notes.txt')), 'User-owned .agent/notes.txt must be preserved');
    assert(fs.existsSync(path.join(CLEANUP_TEST_DIR, '.agent')), '.agent must not be removed while containing user files');

    // Now remove remaining user files and verify full cleanup when directories become completely empty
    fs.unlinkSync(path.join(subagentsDir, 'colliding-agent.md'));
    fs.unlinkSync(path.join(legacyWorkflows, 'user-flow.md'));
    fs.unlinkSync(path.join(legacyRules, 'team-rules.md'));
    fs.unlinkSync(path.join(CLEANUP_TEST_DIR, '.agent', 'notes.txt'));

    await transformer.cleanupTargetSkills(CLEANUP_TEST_DIR, '.agents/skills');

    assert(!fs.existsSync(subagentsDir), '.agents/subagents must be removed when completely empty');
    assert(!fs.existsSync(legacyWorkflows), '.agent/workflows must be removed when completely empty');
    assert(!fs.existsSync(legacyRules), '.agent/rules must be removed when completely empty');
    assert(!fs.existsSync(path.join(CLEANUP_TEST_DIR, '.agent')), '.agent must be removed when completely empty');

    console.log('✓ AntigravityTransformer ownership-aware cleanup verified successfully!');
  } finally {
    safeRmSync(CLEANUP_TEST_DIR);
  }

  console.log('\n✅ ALL ANTIGRAVITY 2.0 CHECKS PASSED SUCCESSFULLY!\n');
} finally {
  safeRmSync(TEST_DIR);
}
