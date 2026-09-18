import { rewriteInvocationPrefix } from '../transformer.js';
function toQwenInvocation(content) {
    return rewriteInvocationPrefix(content, invocation => `/skills ${invocation}`);
}
export class QwenTransformer {
    transform(skillName, content) {
        return {
            targetDir: skillName,
            targetName: 'SKILL.md',
            content: toQwenInvocation(content),
            flat: false,
        };
    }
    getWelcomeMessage() {
        return [
            '1. Open Qwen Code in this directory',
            '2. MCP servers configured in .qwen/settings.json (if selected)',
            '3. Run /skills aif to analyze project and generate project-relevant skills',
        ];
    }
    getInvocationHint() {
        return 'Qwen Code: /skills aif-plan, /skills aif-commit';
    }
}
//# sourceMappingURL=qwen.js.map