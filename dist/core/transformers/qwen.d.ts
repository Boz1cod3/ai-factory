import type { AgentTransformer, TransformResult } from '../transformer.js';
export declare class QwenTransformer implements AgentTransformer {
    transform(skillName: string, content: string): TransformResult;
    getWelcomeMessage(): string[];
    getInvocationHint(): string;
}
//# sourceMappingURL=qwen.d.ts.map