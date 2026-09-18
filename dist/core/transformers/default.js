export class DefaultTransformer {
    transform(skillName, content) {
        return {
            targetDir: skillName,
            targetName: 'SKILL.md',
            content,
            flat: false,
        };
    }
    getWelcomeMessage() {
        return [
            '1. Open the agent in this directory',
            '2. Run /aif to analyze project and generate project-relevant skills',
        ];
    }
}
//# sourceMappingURL=default.js.map