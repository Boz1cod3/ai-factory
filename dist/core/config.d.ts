import { type InstalledExtensionManifest } from './extensions.js';
export interface McpConfig {
    github: boolean;
    filesystem: boolean;
    postgres: boolean;
    chromeDevtools: boolean;
    playwright: boolean;
}
export interface ManagedArtifactState {
    sourceHash: string;
    installedHash: string;
}
export interface ManagedSkillState extends ManagedArtifactState {
    renderContextHash?: string;
    rawInstalledHash?: string;
}
export interface AgentFileSource {
    kind: 'bundled' | 'extension';
    sourcePath: string;
    extensionName?: string;
}
export interface AgentInstallation {
    id: string;
    skillsDir: string;
    installedSkills: string[];
    managedSkills?: Record<string, ManagedSkillState>;
    agentsDir?: string;
    installedAgentFiles?: string[];
    agentFileSources?: Record<string, AgentFileSource>;
    managedAgentFiles?: Record<string, ManagedArtifactState>;
    configFiles?: string[];
    installedConfigFiles?: string[];
    managedConfigFiles?: Record<string, ManagedArtifactState>;
    mcp: McpConfig;
}
export interface ExtensionRecord {
    name: string;
    source: string;
    version: string;
    replacedSkills?: string[];
}
export interface AiFactoryConfig {
    version: string;
    agents: AgentInstallation[];
    extensions?: ExtensionRecord[];
}
interface SaveConfigOptions {
    hydrateAgentFileSources?: boolean;
    installedExtensions?: InstalledExtensionManifest[];
}
export declare function loadConfig(projectDir: string): Promise<AiFactoryConfig | null>;
export declare function hydrateAgentFileSources(projectDir: string, config: AiFactoryConfig, options?: {
    installedExtensions?: InstalledExtensionManifest[];
}): Promise<void>;
export declare function saveConfig(projectDir: string, config: AiFactoryConfig, options?: SaveConfigOptions): Promise<void>;
export declare function configExists(projectDir: string): Promise<boolean>;
export declare function getCurrentVersion(): string;
export {};
//# sourceMappingURL=config.d.ts.map