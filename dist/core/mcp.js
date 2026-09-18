import path from 'path';
import { readJsonFile, writeJsonFile, getMcpDir, ensureDir, fileExists, readTextFile, writeTextFile } from '../utils/fs.js';
import { getAgentConfig } from './agents.js';
import { removeCodexMcpServersToml, upsertCodexMcpServersToml } from './mcp-toml.js';
const KNOWN_MCP_TEMPLATE_KEYS = new Set(['command', 'args', 'env']);
export function validateMcpTemplate(template, key) {
    if (typeof template !== 'object' || template === null || Array.isArray(template)) {
        throw new Error(`MCP server "${key}": template must be an object`);
    }
    const t = template;
    const unknownKeys = Object.keys(t).filter(k => !KNOWN_MCP_TEMPLATE_KEYS.has(k));
    if (unknownKeys.length > 0) {
        throw new Error(`MCP server "${key}": template has unknown keys: ${unknownKeys.join(', ')}. Allowed keys: command, args, env`);
    }
    if (!t.command || typeof t.command !== 'string') {
        throw new Error(`MCP server "${key}": template must have a non-empty "command" string`);
    }
    if (t.args !== undefined && (!Array.isArray(t.args) || t.args.some(a => typeof a !== 'string'))) {
        throw new Error(`MCP server "${key}": template "args" must be an array of strings`);
    }
    if (t.env !== undefined && (typeof t.env !== 'object' ||
        t.env === null ||
        Array.isArray(t.env) ||
        Object.values(t.env).some(v => typeof v !== 'string'))) {
        throw new Error(`MCP server "${key}": template "env" must be a record of strings`);
    }
}
function toOpenCodeFormat(config) {
    const command = [config.command, ...(config.args || [])];
    const result = { type: 'local', command };
    if (config.env) {
        result.environment = config.env;
    }
    return result;
}
function normalizeVsCodeEnvValue(value) {
    const envRefMatch = value.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
    if (!envRefMatch) {
        return value;
    }
    return `\${env:${envRefMatch[1]}}`;
}
function toVsCodeFormat(config) {
    const result = { type: 'stdio', command: config.command };
    if (config.args && config.args.length > 0) {
        result.args = [...config.args];
    }
    if (config.env && Object.keys(config.env).length > 0) {
        result.env = Object.fromEntries(Object.entries(config.env).map(([key, value]) => [key, normalizeVsCodeEnvValue(value)]));
    }
    return result;
}
const MCP_SERVERS = [
    {
        key: 'github',
        templateFile: 'github.json',
        instruction: 'GitHub MCP: Set GITHUB_TOKEN environment variable with your GitHub personal access token',
    },
    {
        key: 'filesystem',
        templateFile: 'filesystem.json',
        instruction: 'Filesystem MCP: No additional configuration needed. Server provides file access tools.',
    },
    {
        key: 'postgres',
        templateFile: 'postgres.json',
        instruction: 'Postgres MCP: Set DATABASE_URL environment variable with your PostgreSQL connection string',
    },
    {
        key: 'chromeDevtools',
        templateFile: 'chrome-devtools.json',
        instruction: 'Chrome Devtools MCP: No additional configuration needed. Server provides your coding agent control and inspect a live Chrome browser.',
    },
    {
        key: 'playwright',
        templateFile: 'playwright.json',
        instruction: 'Playwright MCP: No additional configuration needed. Server provides browser automation via accessibility tree for web testing and interaction.',
    },
];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function ensureNestedRecord(object, key) {
    const value = object[key];
    if (isRecord(value)) {
        return value;
    }
    const next = {};
    object[key] = next;
    return next;
}
async function loadSettings(settingsPath) {
    if (!(await fileExists(settingsPath))) {
        return {};
    }
    const parsed = await readJsonFile(settingsPath);
    return isRecord(parsed) ? parsed : {};
}
function resolveMcpSettingsFormat(agentId) {
    if (agentId === 'codex-app') {
        return 'codex-toml';
    }
    if (agentId === 'opencode') {
        return 'opencode';
    }
    if (agentId === 'copilot') {
        return 'vscode';
    }
    return 'standard';
}
function getContainerKey(format) {
    if (format === 'codex-toml') {
        throw new Error('Codex TOML MCP settings do not use a JSON container key');
    }
    if (format === 'opencode') {
        return 'mcp';
    }
    if (format === 'vscode') {
        return 'servers';
    }
    return 'mcpServers';
}
function applyServerConfig(settings, format, key, template) {
    if (format === 'codex-toml') {
        throw new Error('Codex TOML MCP settings must be written through the TOML settings editor');
    }
    if (format === 'opencode') {
        ensureNestedRecord(settings, 'mcp')[key] = toOpenCodeFormat(template);
        return;
    }
    if (format === 'vscode') {
        ensureNestedRecord(settings, 'servers')[key] = toVsCodeFormat(template);
        return;
    }
    ensureNestedRecord(settings, 'mcpServers')[key] = template;
}
async function writeCodexTomlMcpSettings(settingsPath, servers) {
    try {
        const currentSettings = await readTextFile(settingsPath);
        await writeTextFile(settingsPath, upsertCodexMcpServersToml(currentSettings ?? '', servers));
    }
    catch (error) {
        const keys = servers.map(server => server.key).join(', ');
        throw new Error(`Failed to write Codex MCP TOML settings at ${settingsPath} for MCP server key(s) ${keys}: ${error.message}`);
    }
}
async function removeCodexTomlMcpSettings(settingsPath, keys) {
    try {
        const currentSettings = await readTextFile(settingsPath);
        if (currentSettings === null) {
            return;
        }
        const nextSettings = removeCodexMcpServersToml(currentSettings, keys);
        if (nextSettings !== currentSettings) {
            await writeTextFile(settingsPath, nextSettings);
        }
    }
    catch (error) {
        throw new Error(`Failed to remove Codex MCP TOML settings at ${settingsPath} for MCP server key(s) ${keys.join(', ')}: ${error.message}`);
    }
}
export async function configureMcp(projectDir, options, agentId = 'claude') {
    const agent = getAgentConfig(agentId);
    if (!agent.supportsMcp || !agent.settingsFile) {
        return [];
    }
    const format = resolveMcpSettingsFormat(agentId);
    const configuredServers = [];
    const settingsPath = path.join(projectDir, agent.settingsFile);
    const settingsDir = path.dirname(settingsPath);
    await ensureDir(settingsDir);
    const mcpTemplatesDir = path.join(getMcpDir(), 'templates');
    const selectedServers = [];
    for (const server of MCP_SERVERS) {
        if (!options[server.key]) {
            continue;
        }
        const template = await readJsonFile(path.join(mcpTemplatesDir, server.templateFile));
        if (!template) {
            continue;
        }
        selectedServers.push({ key: server.key, template });
        configuredServers.push(server.key);
    }
    if (configuredServers.length === 0) {
        return configuredServers;
    }
    if (format === 'codex-toml') {
        await writeCodexTomlMcpSettings(settingsPath, selectedServers);
    }
    else {
        const settings = await loadSettings(settingsPath);
        for (const server of selectedServers) {
            applyServerConfig(settings, format, server.key, server.template);
        }
        await writeJsonFile(settingsPath, settings);
    }
    return configuredServers;
}
export function getMcpInstructions(servers) {
    const selected = new Set(servers);
    return MCP_SERVERS
        .filter(server => selected.has(server.key))
        .map(server => server.instruction);
}
export async function configureExtensionMcpServers(projectDir, agentId, servers) {
    const agent = getAgentConfig(agentId);
    if (!agent.supportsMcp || !agent.settingsFile) {
        return [];
    }
    const format = resolveMcpSettingsFormat(agentId);
    const settingsPath = path.join(projectDir, agent.settingsFile);
    await ensureDir(path.dirname(settingsPath));
    const configured = [];
    if (format === 'codex-toml') {
        await writeCodexTomlMcpSettings(settingsPath, servers);
        return servers.map(server => server.key);
    }
    const settings = await loadSettings(settingsPath);
    for (const { key, template } of servers) {
        applyServerConfig(settings, format, key, template);
        configured.push(key);
    }
    if (configured.length > 0) {
        await writeJsonFile(settingsPath, settings);
    }
    return configured;
}
export async function removeExtensionMcpServers(projectDir, agentId, keys) {
    const agent = getAgentConfig(agentId);
    if (!agent.supportsMcp || !agent.settingsFile) {
        return;
    }
    const format = resolveMcpSettingsFormat(agentId);
    const settingsPath = path.join(projectDir, agent.settingsFile);
    if (format === 'codex-toml') {
        await removeCodexTomlMcpSettings(settingsPath, keys);
        return;
    }
    const settings = await loadSettings(settingsPath);
    const containerKey = getContainerKey(format);
    const container = settings[containerKey];
    if (!isRecord(container))
        return;
    let changed = false;
    for (const key of keys) {
        if (key in container) {
            delete container[key];
            changed = true;
        }
    }
    if (changed) {
        await writeJsonFile(settingsPath, settings);
    }
}
//# sourceMappingURL=mcp.js.map