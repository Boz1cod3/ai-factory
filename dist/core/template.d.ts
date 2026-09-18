import { type AgentConfig } from './agents.js';
export interface TemplateVars {
    config_dir: string;
    skills_dir: string;
    home_skills_dir: string;
    settings_file: string;
    agent_name: string;
    skills_cli_agent_flag: string;
}
export declare function buildTemplateVars(agent: AgentConfig & {
    homeSkillsDir?: string;
}): TemplateVars;
export declare function processTemplate(content: string, vars: TemplateVars): string;
export declare function processSkillTemplates(skillDir: string, agent: AgentConfig): Promise<void>;
//# sourceMappingURL=template.d.ts.map