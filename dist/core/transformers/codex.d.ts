import type { AgentTransformer, TransformResult } from '../transformer.js';
export declare class CodexTransformer implements AgentTransformer {
    private readonly runtimeName;
    constructor(runtimeName?: string);
    transform(skillName: string, content: string): TransformResult;
    getWelcomeMessage(): string[];
    getInvocationHint(): string;
}
//# sourceMappingURL=codex.d.ts.map