import type { AgentTransformer, TransformResult } from '../transformer.js';
export declare class KiloCodeTransformer implements AgentTransformer {
    transform(skillName: string, content: string): TransformResult;
    postInstall(projectDir: string): Promise<void>;
    cleanup(projectDir: string): Promise<void>;
    getWelcomeMessage(): string[];
    getInvocationHint(): string;
}
//# sourceMappingURL=kilocode.d.ts.map