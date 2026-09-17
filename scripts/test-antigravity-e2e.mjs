import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

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
  const subagentsDir = path.join(TEST_DIR, '.agents', 'subagents');
  assert(fs.existsSync(subagentsDir), '.agents/subagents/ must exist');
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
    assert(fs.existsSync(subagentPath), `Subagent ${subagent} must be installed in .agents/subagents/`);
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
  assert.strictEqual(agAgent.agentsDir, '.agents/subagents');
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

  console.log('\n✅ ALL ANTIGRAVITY 2.0 CHECKS PASSED SUCCESSFULLY!\n');
} finally {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}
