import type { McpServerConfig } from './mcp.js';
export type ExtensionSourceType = 'local' | 'npm' | 'github' | 'gitlab' | 'git';
export interface ParsedGitSource {
    host: string | null;
    owner: string | null;
    repo: string | null;
    ref: string | null;
    cloneUrl: string;
    isGitHub: boolean;
    isGitLab: boolean;
}
export interface ExtensionVersionMetadata {
    sourceType: ExtensionSourceType;
    latestVersion: string;
    manifest: ExtensionManifest;
    source: string;
    metadata?: {
        path?: string;
        packageName?: string;
        host?: string;
        owner?: string;
        repo?: string;
        ref?: string;
    };
}
export interface ExtensionVersionResolution {
    status: 'resolved' | 'failed';
    sourceType: ExtensionSourceType;
    source: string;
    latestVersion?: string;
    manifest?: ExtensionManifest;
    metadata?: ExtensionVersionMetadata['metadata'];
    failureReason?: string;
}
export interface NpmVersionCheckResult {
    packageName: string;
    latestVersion: string | null;
    shouldDownload: boolean;
    reason: 'force' | 'version-changed' | 'unchanged' | 'lookup-failed';
}
export interface ResolveNpmCommandOptions {
    platform?: NodeJS.Platform;
    execPath?: string;
    pathEnv?: string;
    pathDelimiter?: string;
    pathExists?: (targetPath: string) => Promise<boolean>;
}
interface ResolvedNpmCommand {
    command: string;
    argsPrefix: string[];
}
export declare function resolveNpmCommand(options?: ResolveNpmCommandOptions): Promise<ResolvedNpmCommand>;
export declare function fetchLatestNpmPackageVersion(packageName: string): Promise<string | null>;
export declare function getNpmVersionCheckResult(packageName: string, currentVersion: string, force?: boolean): Promise<NpmVersionCheckResult>;
export interface ExtensionInjection {
    target: string;
    position: 'append' | 'prepend';
    file: string;
}
export interface ExtensionCommand {
    name: string;
    description: string;
    module: string;
}
export interface ExtensionAgentDef {
    id: string;
    displayName: string;
    configDir: string;
    skillsDir: string;
    agentsDir?: string;
    agentFileExtension?: '.md' | '.toml';
    settingsFile: string | null;
    supportsMcp: boolean;
    skillsCliAgent: string | null;
}
export interface ExtensionAgentFile {
    runtime: string;
    source: string;
    target: string;
}
export interface ExtensionMcpServer {
    key: string;
    template: string | McpServerConfig;
    instruction?: string;
}
export interface ExtensionManifest {
    name: string;
    version: string;
    description?: string;
    commands?: ExtensionCommand[];
    agents?: ExtensionAgentDef[];
    agentFiles?: ExtensionAgentFile[];
    injections?: ExtensionInjection[];
    skills?: string[];
    replaces?: Record<string, string>;
    mcpServers?: ExtensionMcpServer[];
}
export interface InstalledExtensionManifest {
    dir: string;
    manifest: ExtensionManifest;
}
interface LoadExtensionManifestOptions {
    allowLegacyAgentFileTargetAliases?: boolean;
}
export declare function validateExtensionName(name: string): void;
export declare function validateSkillName(name: string): void;
export declare function getExtensionsDir(projectDir: string): string;
export declare function loadExtensionManifest(extensionDir: string, options?: LoadExtensionManifestOptions): Promise<ExtensionManifest | null>;
export declare function loadInstalledExtensionManifest(extensionDir: string): Promise<ExtensionManifest | null>;
export declare function loadAllExtensions(projectDir: string, registeredNames: string[]): Promise<InstalledExtensionManifest[]>;
export declare function classifyExtensionSource(source: string): ExtensionSourceType;
export declare function compareExtensionVersions(left: string, right: string): number;
export declare function parseGitSource(source: string): ParsedGitSource;
export interface GitHubManifestResult {
    manifest: ExtensionManifest | null;
    rateLimited: boolean;
}
export declare function fetchGitHubExtensionManifest(source: string): Promise<GitHubManifestResult>;
export declare function resolveExtensionVersion(projectDir: string, source: string): Promise<ExtensionVersionResolution>;
export interface ResolvedExtension {
    manifest: ExtensionManifest;
    sourceDir: string;
    tempDir?: string;
    cleanup: () => Promise<void>;
}
export declare function resolveExtension(projectDir: string, source: string): Promise<ResolvedExtension>;
export declare function commitExtensionInstall(projectDir: string, resolved: ResolvedExtension): Promise<void>;
export declare function removeExtensionFiles(projectDir: string, name: string): Promise<void>;
export {};
//# sourceMappingURL=extensions.d.ts.map