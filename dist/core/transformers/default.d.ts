import type { AgentTransformer, TransformResult } from '../transformer.js';
export declare class DefaultTransformer implements AgentTransformer {
    transform(skillName: string, content: string): TransformResult;
    getWelcomeMessage(): string[];
}
//# sourceMappingURL=default.d.ts.map