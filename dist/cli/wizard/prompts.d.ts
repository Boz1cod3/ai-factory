export interface AgentWizardSelection {
    id: string;
    mcpGithub: boolean;
    mcpFilesystem: boolean;
    mcpPostgres: boolean;
    mcpChromeDevtools: boolean;
    mcpPlaywright: boolean;
}
export interface WizardAnswers {
    selectedSkills: string[];
    agents: AgentWizardSelection[];
}
export declare function runWizard(defaultAgentIds?: string[]): Promise<WizardAnswers>;
//# sourceMappingURL=prompts.d.ts.map