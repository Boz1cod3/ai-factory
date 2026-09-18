import { type AgentConfig } from './agents.js';
import { type SkillTargetRuntime } from './transformer.js';
export interface SkillRenderContext {
    readonly agent: Readonly<AgentConfig & {
        homeSkillsDir?: string;
    }>;
    readonly hash: string;
}
export interface EffectiveSkillTarget {
    readonly id: string;
    readonly previousSkillsDir: string;
    readonly skillsDir: string;
    readonly physicalPath: string;
    readonly sourcePhysicalPath: string;
    readonly reason: 'existing-agents-directory' | 'persisted' | 'default';
}
export interface SkillTargetGroup {
    readonly skillsDir: string;
    readonly physicalPath: string;
    readonly targets: readonly EffectiveSkillTarget[];
    readonly context: SkillRenderContext;
}
export declare function logSkillTarget(message: string, context: Record<string, unknown>): void;
export declare function physicalProjectPath(projectDir: string, relativePath: string, options?: {
    preserveCase?: boolean;
}): Promise<string>;
export declare function createSkillRenderContext(agentId: string, skillsDir: string, sharedCodex?: boolean): SkillRenderContext;
export declare function resolveSkillTargets(projectDir: string, runtimes: readonly SkillTargetRuntime[], options?: {
    select?: boolean;
}): Promise<readonly SkillTargetGroup[]>;
export declare function hasSurvivingConfigConsumer(projectDir: string, relativePath: string, survivors: readonly SkillTargetRuntime[]): Promise<boolean>;
//# sourceMappingURL=skill-targets.d.ts.map