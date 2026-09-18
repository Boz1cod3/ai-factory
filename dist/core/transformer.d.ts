export interface TransformResult {
    targetDir: string;
    targetName: string;
    content: string;
    flat: boolean;
}
export interface AgentTransformer {
    transform(skillName: string, content: string): TransformResult;
    postInstall?(projectDir: string): Promise<void>;
    getWelcomeMessage(): string[];
    getInvocationHint?(): string;
    cleanup?(projectDir: string, skillsDir: string): Promise<void>;
}
export interface AgentOnboarding {
    welcomeMessage: string[];
    invocationHint: string | null;
}
export interface SkillTargetRuntime {
    id: string;
    skillsDir: string;
    agentsDir?: string;
    configFiles?: string[];
}
export declare const WORKFLOW_SKILLS: Set<string>;
export declare function sanitizeName(name: string): string;
export declare function extractFrontmatterName(content: string): string | null;
export declare function replaceFrontmatterName(content: string, newName: string): string;
export declare function simplifyFrontmatter(content: string): string;
export declare function removeFrontmatter(content: string): string;
export declare function rewriteInvocationPrefix(content: string, mapInvocation: (invocation: string) => string): string;
export declare function getTransformer(agentId: string): AgentTransformer;
export declare function getTransformerIdentity(agentId: string): string;
export declare function assertCompatibleSkillTargets(targets: SkillTargetRuntime[]): void;
export declare function getAgentOnboarding(agentId: string): AgentOnboarding;
export declare function cleanupAgentSetup(agentId: string, projectDir: string, skillsDir: string): Promise<void>;
//# sourceMappingURL=transformer.d.ts.map