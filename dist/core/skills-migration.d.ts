import type { AgentInstallation, AiFactoryConfig } from './config.js';
import { type InstalledExtensionManifest } from './extensions.js';
import { type SkillTargetGroup } from './skill-targets.js';
interface SkillOwner {
    name: string;
    sourceDir: string;
    key: string;
    extension: boolean;
    bundledSourceDir?: string;
}
interface MigrationFile {
    path: string;
    physical: string;
    before: Buffer | null;
    after: Buffer | null;
    beforeMode: number | null;
    afterMode: number | null;
}
interface ProvenRoot {
    logical: string;
    physical: string;
}
export interface SkillMigrationPlan {
    config: AiFactoryConfig;
    configBefore: Buffer | null;
    configBeforeMode: number | null;
    groups: readonly SkillTargetGroup[];
    files: MigrationFile[];
    cleanupDirectories: string[];
    warnings: string[];
    provenRoots: ProvenRoot[];
}
export declare function collectSkillOwners(installedExtensions: readonly InstalledExtensionManifest[]): Promise<Map<string, SkillOwner>>;
export declare function preflightSkillMigration(projectDir: string, config: AiFactoryConfig, groups?: readonly SkillTargetGroup[]): Promise<SkillMigrationPlan>;
export declare function withSkillProjectLock<T>(projectDir: string, action: () => Promise<T>): Promise<T>;
export declare function recoverSkillMigration(projectDir: string): Promise<void>;
export declare function applySkillMigration(projectDir: string, plan: SkillMigrationPlan, options?: {
    onPhase?: (phase: 'prepared' | 'destination' | 'committed' | 'cleanup') => Promise<void>;
}): Promise<AiFactoryConfig>;
export declare function prepareSkillTargets(projectDir: string, config: AiFactoryConfig, groups?: readonly SkillTargetGroup[]): Promise<readonly SkillTargetGroup[]>;
export declare function captureSharedSkillRollback(projectDir: string, agents: AgentInstallation[], names: readonly string[], options?: {
    includeSingletons?: boolean;
}): Promise<() => Promise<void>>;
export {};
//# sourceMappingURL=skills-migration.d.ts.map