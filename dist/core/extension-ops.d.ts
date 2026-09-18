import type { AgentFileSource, AgentInstallation, AiFactoryConfig, ExtensionRecord } from './config.js';
import { type ExtensionManifest, type ResolvedExtension } from './extensions.js';
export interface ExtensionAssetInstallResult {
    replacedSkills: string[];
    replacementOutcomes: Array<{
        baseSkillName: string;
        extensionSkillPath: string;
        status: 'installed' | 'rolled-back' | 'preserved-base';
        successCount: number;
        agentCount: number;
    }>;
    customSkillInstalls: Map<string, string[]>;
    agentFileInstalls: Map<string, string[]>;
    injectionCount: number;
    configuredMcpServers: string[];
}
export interface CommitResolvedExtensionOptions {
    config: AiFactoryConfig;
    source: string;
    resolved: ResolvedExtension;
    log?: (level: 'info' | 'warn', message: string) => void;
}
/**
 * Install base skills on all agents.
 */
export declare function installSkillsForAllAgents(projectDir: string, agents: AgentInstallation[], skills: string[]): Promise<void>;
export declare function composeInstalledExtensionSkills(projectDir: string, config: AiFactoryConfig, options?: {
    installReplacements?: boolean;
    customSkillInstalls?: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
}): Promise<number>;
/**
 * Remove extension skills from all agents. Returns per-agent removed lists.
 */
export declare function removeSkillsForAllAgents(projectDir: string, agents: AgentInstallation[], skillNames: string[]): Promise<Map<string, string[]>>;
/**
 * Install extension skills on all agents. Returns per-agent installed lists.
 */
export declare function installExtensionSkillsForAllAgents(projectDir: string, agents: AgentInstallation[], extensionDir: string, skillPaths: string[], nameOverrides?: Record<string, string>): Promise<Map<string, string[]>>;
export declare function installExtensionAgentFilesForAllAgents(projectDir: string, agents: AgentInstallation[], extensionDir: string, manifest: ExtensionManifest): Promise<Map<string, string[]>>;
export declare function collectManifestAgentFileTargets(manifest?: ExtensionManifest | null): Map<string, string[]>;
export declare function collectTrackedExtensionAgentFileTargets(agents: AgentInstallation[], extensionName: string): Map<string, string[]>;
export declare function mergeInstalledAgentFiles(agents: AgentInstallation[], agentFileInstalls: Map<string, string[]>): void;
export declare function mergeAgentFileSources(agents: AgentInstallation[], agentFileSources: Map<string, Record<string, AgentFileSource>>): void;
export declare function pruneInstalledAgentFiles(agents: AgentInstallation[], targetsByAgent: Map<string, string[]>): void;
export declare function pruneAgentFileSources(agents: AgentInstallation[], targetsByAgent: Map<string, string[]>): void;
export declare function pruneManagedAgentFiles(agents: AgentInstallation[], targetsByAgent: Map<string, string[]>): void;
export declare function removeExtensionAgentFilesForAllAgents(projectDir: string, agents: AgentInstallation[], manifest: ExtensionManifest): Promise<Map<string, string[]>>;
export declare function removeAgentFilesForAllAgentsByTargets(projectDir: string, agents: AgentInstallation[], targetsByAgent: Map<string, string[]>): Promise<Map<string, string[]>>;
export declare function getManifestRuntimeIds(manifest?: ExtensionManifest | null): string[];
export declare function assertNoConfiguredRuntimeOrphans(config: AiFactoryConfig, runtimeIds: string[], extensionName: string, action: 'remove' | 'update'): void;
export declare function assertNoAgentFileConflicts(projectDir: string, config: AiFactoryConfig, manifest: ExtensionManifest): Promise<void>;
/**
 * Collect all replaced skills from extensions, optionally excluding one extension by name.
 */
export declare function collectReplacedSkills(extensions: ExtensionRecord[], excludeName?: string): Set<string>;
/**
 * Ensure a new/updated extension does not claim a base skill already replaced by another extension.
 */
export declare function assertNoReplacementConflicts(extensions: ExtensionRecord[], manifest: ExtensionManifest, currentExtensionName?: string): void;
/**
 * Restore base skills that were previously replaced, filtering out skills still replaced by other extensions.
 */
export declare function restoreBaseSkills(projectDir: string, agents: AgentInstallation[], skillNames: string[], excludeStillReplaced: Set<string>): Promise<string[]>;
/**
 * Remove the previously installed state for an extension before reapplying its refreshed manifest.
 */
export declare function removePreviousExtensionState(projectDir: string, agents: AgentInstallation[], extensionName: string, oldRecord?: ExtensionRecord | null, oldManifest?: ExtensionManifest | null): Promise<void>;
/**
 * Strip extension injections from all agents. Uses manifest if available, falls back to name-based scan.
 */
export declare function stripInjectionsForAllAgents(projectDir: string, agents: AgentInstallation[], extensionName: string, manifest?: ExtensionManifest | null): Promise<void>;
/**
 * Remove custom (non-replacement) skills from all agents based on the manifest.
 * Returns the list of custom skill paths that were targeted for removal.
 */
export declare function removeCustomSkillsForAllAgents(projectDir: string, agents: AgentInstallation[], manifest: ExtensionManifest): Promise<Map<string, string[]>>;
/**
 * Install replacement skills, custom skills, injections, and MCP config for an extension.
 */
export declare function installExtensionAssetsForAllAgents(projectDir: string, agents: AgentInstallation[], extensionDir: string, manifest: ExtensionManifest): Promise<ExtensionAssetInstallResult>;
export declare function commitResolvedExtension(projectDir: string, options: CommitResolvedExtensionOptions): Promise<{
    manifest: ExtensionManifest;
    extensionDir: string;
    record: ExtensionRecord;
    customSkillInstalls: Map<string, string[]>;
}>;
export interface ExtensionRefreshResult {
    name: string;
    status: 'updated' | 'unchanged' | 'failed' | 'skipped';
    oldVersion: string;
    newVersion: string | null;
    failureReason?: string;
    customSkillInstalls?: Map<string, string[]>;
}
export interface ExtensionRefreshSummary {
    updated: ExtensionRefreshResult[];
    unchanged: ExtensionRefreshResult[];
    failed: ExtensionRefreshResult[];
    skipped: ExtensionRefreshResult[];
}
export declare function refreshExtensions(projectDir: string, config: AiFactoryConfig, options?: {
    targetNames?: string[];
    force?: boolean;
    log?: (level: 'info' | 'warn', message: string) => void;
}): Promise<ExtensionRefreshSummary>;
//# sourceMappingURL=extension-ops.d.ts.map