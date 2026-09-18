import { rewriteInvocationPrefix } from '../transformer.js';
function toCodexInvocation(content) {
    return rewriteInvocationPrefix(content, invocation => `$${invocation}`);
}
export class CodexTransformer {
    runtimeName;
    constructor(runtimeName = 'Codex CLI') {
        this.runtimeName = runtimeName;
    }
    transform(skillName, content) {
        return {
            targetDir: skillName,
            targetName: 'SKILL.md',
            content: toCodexInvocation(content),
            flat: false,
        };
    }
    getWelcomeMessage() {
        return [
            `1. Open ${this.runtimeName} in this directory`,
            '2. Run $aif to analyze project and generate project-relevant skills',
        ];
    }
    getInvocationHint() {
        return `${this.runtimeName}: $aif-plan, $aif-commit`;
    }
}
//# sourceMappingURL=codex.js.map