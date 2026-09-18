export type AgentFileExtension = '.md' | '.toml';
export declare const AGENT_IDS: {
    readonly claude: "claude";
    readonly codex: "codex";
    readonly antigravity: "antigravity";
};
export interface AgentConfig {
    id: string;
    displayName: string;
    configDir: string;
    skillsDir: string;
    agentsDir?: string;
    agentFileExtension?: AgentFileExtension;
    settingsFile: string | null;
    supportsMcp: boolean;
    skillsCliAgent: string | null;
    source: 'builtin' | 'extension';
    extensionName?: string;
    configFiles?: string[];
    configFilesSourceDir?: string;
    agentsSourceDir?: string;
}
export interface RuntimeDefinitionInput {
    id: string;
    displayName: string;
    configDir: string;
    skillsDir: string;
    agentsDir?: string;
    agentFileExtension?: AgentFileExtension;
    settingsFile: string | null;
    supportsMcp: boolean;
    skillsCliAgent: string | null;
}
export interface RuntimeManifestInput {
    name: string;
    agents?: RuntimeDefinitionInput[];
}
export declare function getBuiltinAgentConfigs(): AgentConfig[];
export declare function resetExtensionAgentRegistry(): void;
export declare function registerRuntimeDefinitions(definitions: RuntimeDefinitionInput[], extensionName: string): void;
export declare function hydrateProjectAgentRegistry(projectDir: string, options?: {
    extensionNames?: string[];
    extraManifests?: RuntimeManifestInput[];
}): Promise<void>;
export declare function findAgentConfig(id: string): AgentConfig | undefined;
export declare function getAgentConfig(id: string): AgentConfig;
export declare function getAgentChoices(): {
    name: string;
    value: string;
}[];
export declare function getAvailableAgentIds(): string[];
//# sourceMappingURL=agents.d.ts.map