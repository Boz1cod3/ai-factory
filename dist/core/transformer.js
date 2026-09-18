import { DefaultTransformer } from './transformers/default.js';
import { KiloCodeTransformer } from './transformers/kilocode.js';
import { AntigravityTransformer } from './transformers/antigravity.js';
import { CodexTransformer } from './transformers/codex.js';
import { QwenTransformer } from './transformers/qwen.js';
export const WORKFLOW_SKILLS = new Set([
    'aif',
    'aif-commit',
    'aif-explore',
    'aif-fix',
    'aif-implement',
    'aif-improve',
    'aif-plan',
    'aif-rules-check',
    'aif-verify',
    'aif-warmup',
]);
export function sanitizeName(name) {
    return name.replace(/\./g, '-');
}
export function extractFrontmatterName(content) {
    const match = content.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
}
export function replaceFrontmatterName(content, newName) {
    return content.replace(/^name:\s*.+$/m, `name: ${newName}`);
}
export function simplifyFrontmatter(content) {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch)
        return content;
    const frontmatter = fmMatch[1];
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!descMatch)
        return content;
    const newFrontmatter = `---\ndescription: ${descMatch[1].trim()}\n---`;
    return content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
}
export function removeFrontmatter(content) {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}
const INVOCATION_PATTERN = /(^|[^A-Za-z0-9_.~\/}-])\/(aif(?:-[a-z0-9-]+)?)/g;
export function rewriteInvocationPrefix(content, mapInvocation) {
    return content.replace(INVOCATION_PATTERN, (_match, prefix, invocation) => `${prefix}${mapInvocation(invocation)}`);
}
const DEFAULT_TRANSFORMER_IDENTITY = 'default';
const registry = {
    codex: {
        create: () => new CodexTransformer(),
        identity: 'codex',
    },
    'codex-app': {
        create: () => new CodexTransformer('Codex app'),
        identity: 'codex',
    },
    kilocode: {
        create: () => new KiloCodeTransformer(),
        identity: 'kilocode',
    },
    qwen: {
        create: () => new QwenTransformer(),
        identity: 'qwen',
    },
    antigravity: {
        create: () => new AntigravityTransformer(),
        identity: 'default',
    },
};
export function getTransformer(agentId) {
    const registration = registry[agentId];
    return registration ? registration.create() : new DefaultTransformer();
}
export function getTransformerIdentity(agentId) {
    return registry[agentId]?.identity ?? DEFAULT_TRANSFORMER_IDENTITY;
}
function normalizeSkillsDir(skillsDir) {
    return skillsDir.replaceAll('\\', '/').replace(/\/+$/, '');
}
export function assertCompatibleSkillTargets(targets) {
    const targetsByDir = new Map();
    for (const target of targets) {
        const normalizedDir = normalizeSkillsDir(target.skillsDir);
        targetsByDir.set(normalizedDir, [...(targetsByDir.get(normalizedDir) ?? []), target]);
    }
    for (const [skillsDir, groupedTargets] of targetsByDir) {
        const identities = new Map();
        for (const target of groupedTargets) {
            const identity = getTransformerIdentity(target.id);
            identities.set(identity, [...(identities.get(identity) ?? []), target.id]);
        }
        if (identities.size <= 1) {
            continue;
        }
        const runtimeIds = groupedTargets.map(target => target.id).join(', ');
        const transformerSummary = [...identities.entries()]
            .map(([identity, ids]) => `${identity}: ${ids.join(', ')}`)
            .join('; ');
        throw new Error(`Incompatible agent skill targets: ${runtimeIds} all write to "${skillsDir}" ` +
            `but use different skill transformers (${transformerSummary}). ` +
            'Select only one of these agents for this project or configure separate skills directories.');
    }
}
export function getAgentOnboarding(agentId) {
    const transformer = getTransformer(agentId);
    return {
        welcomeMessage: transformer.getWelcomeMessage(),
        invocationHint: transformer.getInvocationHint?.() ?? null,
    };
}
export async function cleanupAgentSetup(agentId, projectDir, skillsDir) {
    const transformer = getTransformer(agentId);
    await transformer.cleanup?.(projectDir, skillsDir);
}
//# sourceMappingURL=transformer.js.map