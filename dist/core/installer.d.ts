import type { AgentFileSource, AgentInstallation, ExtensionRecord, ManagedArtifactState, ManagedSkillState } from './config.js';
import { type ExtensionManifest, type ExtensionAgentFile } from './extensions.js';
import { type SkillRenderContext } from './skill-targets.js';
export type SkillUpdateStatus = 'changed' | 'unchanged' | 'skipped' | 'removed';
export interface SkillUpdateEntry {
    skill: string;
    status: SkillUpdateStatus;
    reason: string;
}
export interface UpdateSkillsResult {
    installedSkills: string[];
    entries: SkillUpdateEntry[];
}
export interface SubagentUpdateEntry {
    subagent: string;
    status: SkillUpdateStatus;
    reason: string;
}
export interface UpdateSubagentsResult {
    installedAgentFiles: string[];
    agentFileSources: Record<string, AgentFileSource>;
    entries: SubagentUpdateEntry[];
}
export interface ConfigFileUpdateEntry {
    configFile: string;
    status: SkillUpdateStatus;
    reason: string;
}
export interface UpdateConfigFilesResult {
    configFiles: string[];
    installedConfigFiles: string[];
    entries: ConfigFileUpdateEntry[];
}
export interface UpdateSkillsOptions {
    renderContext?: SkillRenderContext;
    excludeSkills?: string[];
    force?: boolean;
    installNewSkills?: string[];
}
export interface InstallOptions {
    renderContext?: SkillRenderContext;
    projectDir: string;
    skillsDir: string;
    skills: string[];
    agentId: string;
}
export interface InstallSubagentsOptions {
    projectDir: string;
    agentId?: string;
    agentsDir?: string;
    subagentsDir?: string;
}
export interface InstallConfigFilesOptions {
    projectDir: string;
    agentId: string;
    configFiles: string[];
    installedConfigFiles?: string[];
    managedConfigFiles?: Record<string, ManagedArtifactState>;
}
interface ResolvedAgentFilePaths {
    sourceFile: string;
    targetFile: string;
    sourceRelPath: string;
    targetRelPath: string;
}
interface ResolvedConfigFilePaths {
    sourceFile: string;
    targetFile: string;
    relPath: string;
}
export declare function resolveInstalledAgentFileTargetPath(projectDir: string, agentsDir: string, relPath: string): string;
export declare function resolveManagedConfigFilePaths(projectDir: string, agentId: string, relPath: string): ResolvedConfigFilePaths;
export declare function resolveManagedSubagentPaths(projectDir: string, agentId: string, agentsDir: string, relPath: string): ResolvedAgentFilePaths;
export declare function buildManagedSkillsState(projectDir: string, agentInstallation: AgentInstallation, baseSkills: string[], context?: SkillRenderContext, registeredExtensions?: readonly ExtensionRecord[]): Promise<Record<string, ManagedSkillState>>;
export declare function getAvailableSubagents(agentId?: string): Promise<string[]>;
export declare function buildBundledAgentFileSources(relPaths: string[]): Record<string, AgentFileSource>;
export declare function buildExtensionAgentFileSources(manifest: ExtensionManifest): Map<string, Record<string, AgentFileSource>>;
export declare function buildManagedAgentFilesState(projectDir: string, agentInstallation: AgentInstallation, installedAgentFiles: string[], options?: {
    preserveExistingOnMissingSource?: boolean;
    warn?: (message: string) => void;
}): Promise<Record<string, ManagedArtifactState>>;
export declare function buildManagedConfigFilesState(projectDir: string, agentInstallation: AgentInstallation, installedConfigFiles: string[]): Promise<Record<string, ManagedArtifactState>>;
export declare function buildManagedSubagentsState(projectDir: string, agentInstallation: AgentInstallation, installedSubagents: string[]): Promise<Record<string, ManagedArtifactState>>;
export declare function rebuildManagedAgentFilesForAgents(projectDir: string, agents: AgentInstallation[], options?: {
    preserveExistingOnMissingSource?: boolean;
    warn?: (message: string) => void;
}): Promise<void>;
export declare function renderSkillFiles(sourceSkillDir: string, skillName: string, agentId: string, context: SkillRenderContext): Promise<Map<string, Buffer>>;
export declare function installSkills(options: InstallOptions): Promise<string[]>;
export declare function installSubagents(options: InstallSubagentsOptions): Promise<string[]>;
export declare function installConfigFiles(options: InstallConfigFilesOptions): Promise<string[]>;
export declare function partitionSkills(skills: string[]): {
    base: string[];
    custom: string[];
};
export declare function getAvailableSkills(): Promise<string[]>;
export declare function installExtensionSkills(projectDir: string, agentInstallation: AgentInstallation, extensionDir: string, skillPaths: string[], nameOverrides?: Record<string, string>, context?: SkillRenderContext): Promise<string[]>;
export declare function removeOwnedSkills(projectDir: string, agent: AgentInstallation, survivors: readonly AgentInstallation[]): Promise<string[]>;
export declare function removeExtensionSkills(projectDir: string, agentInstallation: AgentInstallation, skillPaths: string[]): Promise<string[]>;
export declare function updateSkills(agentInstallation: AgentInstallation, projectDir: string, options?: UpdateSkillsOptions): Promise<UpdateSkillsResult>;
export declare function updateSubagents(agentInstallation: AgentInstallation, projectDir: string, options?: UpdateSkillsOptions): Promise<UpdateSubagentsResult>;
export declare function updateConfigFiles(agentInstallation: AgentInstallation, projectDir: string, options?: UpdateSkillsOptions): Promise<UpdateConfigFilesResult>;
export declare class AgentFileInstallError extends Error {
    installedTargets: string[];
    constructor(message: string, installedTargets: string[]);
}
export declare function installExtensionAgentFiles(projectDir: string, agentInstallation: AgentInstallation, extensionDir: string, agentFiles: ExtensionAgentFile[]): Promise<string[]>;
export declare function removeExtensionAgentFiles(projectDir: string, agentInstallation: AgentInstallation, targets: string[]): Promise<string[]>;
export {};
//# sourceMappingURL=installer.d.ts.map