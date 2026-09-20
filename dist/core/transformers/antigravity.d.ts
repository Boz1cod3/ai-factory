import type { AgentTransformer, TransformResult } from '../transformer.js';
export declare class AntigravityTransformer implements AgentTransformer {
    transform(skillName: string, content: string): TransformResult;
    postInstall(projectDir: string): Promise<void>;
    cleanup(projectDir: string, skillsDir: string): Promise<void>;
    getWelcomeMessage(): string[];
    getInvocationHint(): string;
}
//# sourceMappingURL=antigravity.d.ts.map