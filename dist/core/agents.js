import { loadAllExtensions } from './extensions.js';
export const AGENT_IDS = {
    claude: 'claude',
    codex: 'codex',
    antigravity: 'antigravity',
};
const BUILTIN_AGENT_REGISTRY = {
    [AGENT_IDS.claude]: {
        id: AGENT_IDS.claude,
        displayName: 'Claude Code',
        configDir: '.claude',
        skillsDir: '.claude/skills',
        agentsDir: '.claude/agents',
        agentFileExtension: '.md',
        agentsSourceDir: 'subagents/claude/agents',
        settingsFile: '.mcp.json',
        supportsMcp: true,
        skillsCliAgent: 'claude-code',
        source: 'builtin',
    },
    cursor: {
        id: 'cursor',
        displayName: 'Cursor',
        configDir: '.cursor',
        skillsDir: '.cursor/skills',
        settingsFile: '.cursor/mcp.json',
        supportsMcp: true,
        skillsCliAgent: 'cursor',
        source: 'builtin',
    },
    [AGENT_IDS.codex]: {
        id: AGENT_IDS.codex,
        displayName: 'Codex CLI',
        configDir: '.codex',
        skillsDir: '.codex/skills',
        agentsDir: '.codex/agents',
        agentFileExtension: '.toml',
        agentsSourceDir: 'subagents/codex/agents',
        configFiles: ['config.toml'],
        configFilesSourceDir: 'subagents/codex',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: 'codex',
        source: 'builtin',
    },
    'codex-app': {
        id: 'codex-app',
        displayName: 'Codex app',
        configDir: '.agents',
        skillsDir: '.agents/skills',
        settingsFile: '.codex/config.toml',
        supportsMcp: true,
        skillsCliAgent: null,
        source: 'builtin',
    },
    copilot: {
        id: 'copilot',
        displayName: 'GitHub Copilot',
        configDir: '.github',
        skillsDir: '.github/skills',
        settingsFile: '.vscode/mcp.json',
        supportsMcp: true,
        skillsCliAgent: 'github-copilot',
        source: 'builtin',
    },
    gemini: {
        id: 'gemini',
        displayName: 'Gemini CLI',
        configDir: '.gemini',
        skillsDir: '.gemini/skills',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: 'gemini-cli',
        source: 'builtin',
    },
    junie: {
        id: 'junie',
        displayName: 'Junie',
        configDir: '.junie',
        skillsDir: '.junie/skills',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: 'junie',
        source: 'builtin',
    },
    qwen: {
        id: 'qwen',
        displayName: 'Qwen Code',
        configDir: '.qwen',
        skillsDir: '.qwen/skills',
        settingsFile: '.qwen/settings.json',
        supportsMcp: true,
        skillsCliAgent: null,
        source: 'builtin',
    },
    windsurf: {
        id: 'windsurf',
        displayName: 'Windsurf',
        configDir: '.windsurf',
        skillsDir: '.windsurf/skills',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: 'windsurf',
        source: 'builtin',
    },
    warp: {
        id: 'warp',
        displayName: 'Warp',
        configDir: '.warp',
        skillsDir: '.warp/skills',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: null,
        source: 'builtin',
    },
    zencoder: {
        id: 'zencoder',
        displayName: 'Zencoder',
        configDir: '.zencoder',
        skillsDir: '.zencoder/skills',
        settingsFile: null,
        supportsMcp: false,
        skillsCliAgent: 'zencoder',
        source: 'builtin',
    },
    roocode: {
        id: 'roocode',
        displayName: 'Roo Code',
        configDir: '.roo',
        skillsDir: '.roo/skills',
        settingsFile: '.roo/mcp.json',
        supportsMcp: true,
        skillsCliAgent: 'roo',
        source: 'builtin',
    },
    kilocode: {
        id: 'kilocode',
        displayName: 'Kilo Code',
        configDir: '.kilocode',
        skillsDir: '.kilocode/skills',
        settingsFile: '.kilocode/mcp.json',
        supportsMcp: true,
        skillsCliAgent: 'kilo',
        source: 'builtin',
    },
    [AGENT_IDS.antigravity]: {
        id: AGENT_IDS.antigravity,
        displayName: 'Antigravity 2.0',
        configDir: '.agents',
        skillsDir: '.agents/skills',
        agentsDir: '.agents/agents',
        agentFileExtension: '.md',
        agentsSourceDir: 'subagents/antigravity/agents',
        settingsFile: '.agents/mcp_config.json',
        supportsMcp: true,
        skillsCliAgent: 'antigravity',
        source: 'builtin',
    },
    opencode: {
        id: 'opencode',
        displayName: 'OpenCode',
        configDir: '.opencode',
        skillsDir: '.opencode/skills',
        settingsFile: 'opencode.json',
        supportsMcp: true,
        skillsCliAgent: 'opencode',
        source: 'builtin',
    },
    universal: {
        id: 'universal',
        displayName: 'Universal / Other',
        configDir: '.agents',
        skillsDir: '.agents/skills',
        settingsFile: '.mcp.json',
        supportsMcp: true,
        skillsCliAgent: null,
        source: 'builtin',
    },
};
const extensionAgentRegistry = new Map();
function getRegistryEntries() {
    return [
        ...Object.values(BUILTIN_AGENT_REGISTRY),
        ...extensionAgentRegistry.values(),
    ];
}
export function getBuiltinAgentConfigs() {
    return Object.values(BUILTIN_AGENT_REGISTRY);
}
function isValidRuntimeDefinition(definition) {
    return Boolean(definition.id &&
        definition.displayName &&
        definition.configDir &&
        definition.skillsDir);
}
function normalizeRuntimeDefinition(definition, extensionName) {
    return {
        id: definition.id,
        displayName: definition.displayName,
        configDir: definition.configDir,
        skillsDir: definition.skillsDir,
        agentsDir: definition.agentsDir,
        agentFileExtension: definition.agentFileExtension,
        settingsFile: definition.settingsFile,
        supportsMcp: definition.supportsMcp,
        skillsCliAgent: definition.skillsCliAgent,
        source: 'extension',
        extensionName,
    };
}
export function resetExtensionAgentRegistry() {
    extensionAgentRegistry.clear();
}
export function registerRuntimeDefinitions(definitions, extensionName) {
    for (const definition of definitions) {
        if (!isValidRuntimeDefinition(definition)) {
            throw new Error(`Extension "${extensionName}" defines an invalid runtime. Required fields: id, displayName, configDir, skillsDir.`);
        }
        if (definition.id in BUILTIN_AGENT_REGISTRY) {
            throw new Error(`Extension "${extensionName}" cannot redefine built-in runtime "${definition.id}".`);
        }
        // The registry is reset before each hydrate, but this still guards
        // collisions between different installed extensions and any extra
        // manifests being validated in the same hydration pass.
        const existing = extensionAgentRegistry.get(definition.id);
        if (existing && existing.extensionName !== extensionName) {
            throw new Error(`Runtime "${definition.id}" is already provided by extension "${existing.extensionName}". ` +
                `Extension "${extensionName}" cannot claim the same runtime id.`);
        }
        extensionAgentRegistry.set(definition.id, normalizeRuntimeDefinition(definition, extensionName));
    }
}
export async function hydrateProjectAgentRegistry(projectDir, options) {
    resetExtensionAgentRegistry();
    const extraNames = new Set((options?.extraManifests ?? []).map(manifest => manifest.name));
    const extensionNames = (options?.extensionNames ?? []).filter(name => !extraNames.has(name));
    if (extensionNames.length > 0) {
        const installed = await loadAllExtensions(projectDir, extensionNames);
        for (const { manifest } of installed) {
            if (manifest.agents?.length) {
                registerRuntimeDefinitions(manifest.agents, manifest.name);
            }
        }
    }
    for (const manifest of options?.extraManifests ?? []) {
        if (manifest.agents?.length) {
            registerRuntimeDefinitions(manifest.agents, manifest.name);
        }
    }
}
export function findAgentConfig(id) {
    if (id in BUILTIN_AGENT_REGISTRY) {
        return BUILTIN_AGENT_REGISTRY[id];
    }
    return extensionAgentRegistry.get(id);
}
export function getAgentConfig(id) {
    const config = findAgentConfig(id);
    if (!config) {
        throw new Error(`Unknown agent: ${id}. Available: ${getAvailableAgentIds().join(', ')}`);
    }
    return config;
}
export function getAgentChoices() {
    return getRegistryEntries().map(agent => ({
        name: `${agent.displayName} (${agent.configDir}/)`,
        value: agent.id,
    }));
}
export function getAvailableAgentIds() {
    return getRegistryEntries().map(agent => agent.id);
}
//# sourceMappingURL=agents.js.map