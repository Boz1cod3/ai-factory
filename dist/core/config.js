import path from 'path';
import { createRequire } from 'module';
import { readJsonFile, writeJsonFile, fileExists, getPackagePath, listFilesRecursive } from '../utils/fs.js';
import { AGENT_IDS, findAgentConfig, getAgentConfig } from './agents.js';
import { loadAllExtensions } from './extensions.js';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');
const CONFIG_FILENAME = '.ai-factory.json';
const CURRENT_VERSION = pkg.version;
function getConfigPath(projectDir) {
    return path.join(projectDir, CONFIG_FILENAME);
}
function normalizeMcp(mcp) {
    return {
        github: mcp?.github ?? false,
        filesystem: mcp?.filesystem ?? false,
        postgres: mcp?.postgres ?? false,
        chromeDevtools: mcp?.chromeDevtools ?? false,
        playwright: mcp?.playwright ?? false,
    };
}
function createAgentInstallation(agentId, legacy) {
    const agent = getAgentConfig(agentId);
    return {
        skillsDir: legacy?.skillsDir ?? agent.skillsDir,
        id: agentId,
        installedSkills: legacy?.installedSkills ?? [],
        managedSkills: {},
        agentsDir: agent.agentsDir,
        installedAgentFiles: [],
        agentFileSources: {},
        managedAgentFiles: {},
        configFiles: agent.configFiles,
        installedConfigFiles: [],
        managedConfigFiles: {},
        mcp: normalizeMcp(legacy?.mcp),
    };
}
function normalizeManagedArtifacts(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const result = {};
    for (const [artifactName, state] of Object.entries(raw)) {
        if (!artifactName || typeof state !== 'object' || !state) {
            continue;
        }
        const sourceHash = state.sourceHash;
        const installedHash = state.installedHash;
        if (typeof sourceHash === 'string'
            && sourceHash.length > 0
            && typeof installedHash === 'string'
            && installedHash.length > 0) {
            result[artifactName] = { sourceHash, installedHash };
        }
    }
    return result;
}
function normalizeManagedSkills(raw) {
    const result = normalizeManagedArtifacts(raw);
    for (const [name, state] of Object.entries(result)) {
        for (const field of ['renderContextHash', 'rawInstalledHash']) {
            const hash = raw[name]?.[field];
            if (typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))
                state[field] = hash;
        }
    }
    return result;
}
function normalizeAgentFileSources(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const result = {};
    for (const [relPath, source] of Object.entries(raw)) {
        if (!relPath || typeof source !== 'object' || !source) {
            continue;
        }
        const kind = source.kind;
        const sourcePath = source.sourcePath;
        const extensionName = source.extensionName;
        if ((kind !== 'bundled' && kind !== 'extension') || typeof sourcePath !== 'string' || sourcePath.length === 0) {
            continue;
        }
        if (kind === 'extension' && (typeof extensionName !== 'string' || extensionName.length === 0)) {
            continue;
        }
        result[relPath] = {
            kind,
            sourcePath,
            ...(kind === 'extension' ? { extensionName: extensionName } : {}),
        };
    }
    return result;
}
function buildExtensionAgentFileSourceIndex(installedExtensions) {
    const extensionSourceIndex = new Map();
    for (const { manifest } of installedExtensions) {
        for (const agentFile of manifest.agentFiles ?? []) {
            extensionSourceIndex.set(`${agentFile.runtime}::${agentFile.target}`, {
                kind: 'extension',
                sourcePath: agentFile.source,
                extensionName: manifest.name,
            });
        }
    }
    return extensionSourceIndex;
}
const bundledAgentFilesCache = new Map();
async function getBundledAgentFileTargets(agentId) {
    const cached = bundledAgentFilesCache.get(agentId);
    if (cached) {
        return cached;
    }
    const agentConfig = findAgentConfig(agentId);
    const sourceDir = agentConfig?.agentsSourceDir
        ? getPackagePath(agentConfig.agentsSourceDir)
        : null;
    if (!sourceDir) {
        const empty = new Set();
        bundledAgentFilesCache.set(agentId, empty);
        return empty;
    }
    const files = await listFilesRecursive(sourceDir);
    const targets = new Set(files.map(filePath => path.relative(sourceDir, filePath).replaceAll('\\', '/')));
    bundledAgentFilesCache.set(agentId, targets);
    return targets;
}
export async function loadConfig(projectDir) {
    const configPath = getConfigPath(projectDir);
    const raw = await readJsonFile(configPath);
    if (!raw) {
        return null;
    }
    if (Array.isArray(raw.agents)) {
        const rawExtensions = Array.isArray(raw.extensions) ? raw.extensions : [];
        const normalizedAgents = raw.agents.map(agent => {
            const legacyAgent = agent;
            const agentConfig = findAgentConfig(agent.id);
            const skillsDir = legacyAgent.skillsDir || agentConfig?.skillsDir;
            if (!skillsDir) {
                throw new Error(`Configured agent "${agent.id}" is missing "skillsDir" and no runtime definition is currently registered for it.`);
            }
            let agentsDir = legacyAgent.agentsDir
                || legacyAgent.subagentsDir
                || agentConfig?.agentsDir;
            if (agent.id === AGENT_IDS.antigravity && agentsDir === '.agents/subagents') {
                agentsDir = '.agents/agents';
            }
            const installedAgentFiles = Array.isArray(legacyAgent.installedAgentFiles)
                ? legacyAgent.installedAgentFiles
                : Array.isArray(legacyAgent.installedSubagents)
                    ? legacyAgent.installedSubagents
                    : [];
            const agentFileSources = normalizeAgentFileSources(legacyAgent.agentFileSources);
            const managedAgentFiles = normalizeManagedArtifacts(legacyAgent.managedAgentFiles ?? legacyAgent.managedSubagents);
            const filteredAgentFileSources = {};
            for (const relPath of installedAgentFiles) {
                const existingSource = agentFileSources[relPath];
                if (existingSource) {
                    filteredAgentFileSources[relPath] = existingSource;
                }
            }
            return {
                id: agent.id,
                skillsDir,
                installedSkills: Array.isArray(legacyAgent.installedSkills) ? legacyAgent.installedSkills : [],
                managedSkills: normalizeManagedSkills(legacyAgent.managedSkills),
                agentsDir,
                installedAgentFiles,
                agentFileSources: filteredAgentFileSources,
                managedAgentFiles,
                configFiles: Array.isArray(legacyAgent.configFiles) ? legacyAgent.configFiles : agentConfig?.configFiles,
                installedConfigFiles: Array.isArray(legacyAgent.installedConfigFiles) ? legacyAgent.installedConfigFiles : [],
                managedConfigFiles: normalizeManagedArtifacts(legacyAgent.managedConfigFiles),
                mcp: normalizeMcp(legacyAgent.mcp),
            };
        });
        return {
            version: raw.version ?? CURRENT_VERSION,
            agents: normalizedAgents,
            extensions: rawExtensions,
        };
    }
    if (raw.agent) {
        return {
            version: raw.version ?? CURRENT_VERSION,
            agents: [createAgentInstallation(raw.agent, raw)],
            extensions: [],
        };
    }
    return {
        version: raw.version ?? CURRENT_VERSION,
        agents: [],
        extensions: [],
    };
}
export async function hydrateAgentFileSources(projectDir, config, options = {}) {
    if (!config.agents.length) {
        return;
    }
    const extensions = config.extensions ?? [];
    const installedExtensions = options.installedExtensions
        ?? (extensions.length > 0
            ? await loadAllExtensions(projectDir, extensions.map(extension => extension.name))
            : []);
    const extensionSourceIndex = buildExtensionAgentFileSourceIndex(installedExtensions);
    for (const agent of config.agents) {
        const installedAgentFiles = agent.installedAgentFiles ?? [];
        if (installedAgentFiles.length === 0) {
            agent.agentFileSources = {};
            continue;
        }
        const installedSet = new Set(installedAgentFiles);
        const normalizedSources = normalizeAgentFileSources(agent.agentFileSources);
        const hydratedSources = {};
        for (const relPath of installedAgentFiles) {
            const existingSource = normalizedSources[relPath];
            if (existingSource) {
                hydratedSources[relPath] = existingSource;
                continue;
            }
            const extensionSource = extensionSourceIndex.get(`${agent.id}::${relPath}`);
            if (extensionSource) {
                hydratedSources[relPath] = extensionSource;
            }
        }
        const bundledTargets = await getBundledAgentFileTargets(agent.id);
        for (const relPath of installedAgentFiles) {
            if (!hydratedSources[relPath] && bundledTargets.has(relPath)) {
                hydratedSources[relPath] = {
                    kind: 'bundled',
                    sourcePath: relPath,
                };
            }
        }
        agent.agentFileSources = Object.fromEntries(Object.entries(hydratedSources).filter(([relPath]) => installedSet.has(relPath)));
    }
}
export async function saveConfig(projectDir, config, options = {}) {
    const configPath = getConfigPath(projectDir);
    if (options.hydrateAgentFileSources ?? true) {
        await hydrateAgentFileSources(projectDir, config, {
            installedExtensions: options.installedExtensions,
        });
    }
    await writeJsonFile(configPath, config);
}
export async function configExists(projectDir) {
    const configPath = getConfigPath(projectDir);
    return fileExists(configPath);
}
export function getCurrentVersion() {
    return CURRENT_VERSION;
}
//# sourceMappingURL=config.js.map