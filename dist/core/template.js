import path from 'path';
import fs from 'fs/promises';
import { getAgentConfig } from './agents.js';
export function buildTemplateVars(agent) {
    return {
        config_dir: agent.configDir,
        skills_dir: agent.skillsDir,
        home_skills_dir: `~/${['.codex/skills', '.agents/skills'].includes(agent.skillsDir)
            ? agent.skillsDir : agent.homeSkillsDir ?? getAgentConfig(agent.id).skillsDir}`,
        settings_file: agent.settingsFile ?? '',
        agent_name: agent.displayName,
        skills_cli_agent_flag: agent.skillsCliAgent ? `--agent ${agent.skillsCliAgent}` : '',
    };
}
export function processTemplate(content, vars) {
    return content.replaceAll('~/{{skills_dir}}', vars.home_skills_dir).replace(/\{\{(config_dir|skills_dir|home_skills_dir|settings_file|agent_name|skills_cli_agent_flag)\}\}/g, (_, key) => {
        return vars[key];
    });
}
export async function processSkillTemplates(skillDir, agent) {
    const vars = buildTemplateVars(agent);
    await processDirectoryTemplates(skillDir, vars);
}
async function processDirectoryTemplates(dir, vars) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await processDirectoryTemplates(fullPath, vars);
        }
        else if (entry.name.endsWith('.md')) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const processed = processTemplate(content, vars);
            if (processed !== content) {
                await fs.writeFile(fullPath, processed, 'utf-8');
            }
        }
    }
}
//# sourceMappingURL=template.js.map