import path from 'path';
import fs from 'node:fs/promises';
import { existsSync, lstatSync } from 'fs';
import { createHash } from 'crypto';
import { copyDirectory, copyFile, getPackagePath, getSkillsDir, ensureDir, listDirectories, listFilesRecursive, readTextFile, readFileBuffer, writeTextFile, removeDirectory, removeFile, fileExists, hashDirectory, } from '../utils/fs.js';
import { getAgentConfig } from './agents.js';
import { getExtensionsDir, loadAllExtensions } from './extensions.js';
import { applyInjection } from './injections.js';
import { processSkillTemplates, buildTemplateVars, processTemplate } from './template.js';
import { createSkillRenderContext, logSkillTarget, physicalProjectPath } from './skill-targets.js';
import { getTransformer, extractFrontmatterName, replaceFrontmatterName } from './transformer.js';
const EXTENSION_INJECTION_BLOCK_PATTERN = /\n?<!-- aif-ext:[^:]+:[^:]+:[^:]+:start -->\n[\s\S]*?\n<!-- aif-ext:[^:]+:[^:]+:[^:]+:end -->\n?/g;
// Top-level directories inside a skill source that must never be shipped to
// the user's project: they are part of our authoring/testing workflow only.
const SKILL_INTERNAL_TOP_LEVEL_DIRS = new Set(['tests']);
function isSkillInternalChild(skillRootDir, candidate) {
    const rel = path.relative(skillRootDir, candidate);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        return false;
    }
    const [top] = rel.split(path.sep);
    return SKILL_INTERNAL_TOP_LEVEL_DIRS.has(top);
}
function skillSourceCopyFilter(skillRootDir) {
    return (srcPath) => !isSkillInternalChild(skillRootDir, srcPath);
}
function skillSourceSkipDirectory(skillRootDir) {
    return (absPath) => isSkillInternalChild(skillRootDir, absPath);
}
function assertSafeManagedRelativePath(relPath) {
    const normalized = path.posix.normalize(relPath.replaceAll('\\', '/'));
    if (normalized.startsWith('/')) {
        throw new Error(`Managed artifact path must be relative: ${relPath}`);
    }
    if (/^[A-Za-z]:(?:\/|$)/.test(normalized)) {
        throw new Error(`Managed artifact path must not use a drive-qualified path: ${relPath}`);
    }
    if (normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`Managed artifact path must not escape its base directory: ${relPath}`);
    }
}
function normalizeMarkdownForManagedHash(content) {
    return content
        .replace(/\r\n/g, '\n')
        .replace(EXTENSION_INJECTION_BLOCK_PATTERN, '')
        .trimEnd();
}
async function readManagedFileForHash(filePath) {
    if (path.extname(filePath).toLowerCase() === '.md') {
        const content = await readTextFile(filePath);
        if (!content) {
            return null;
        }
        return Buffer.from(normalizeMarkdownForManagedHash(content), 'utf-8');
    }
    return readFileBuffer(filePath);
}
async function hashManagedFiles(files, raw = false) {
    if (files.length === 0) {
        return null;
    }
    const sortedFiles = [...files].sort((a, b) => a.relPath.localeCompare(b.relPath));
    const hasher = createHash('sha256');
    for (const file of sortedFiles) {
        const content = await (raw ? readFileBuffer(file.absPath) : readManagedFileForHash(file.absPath));
        if (!content) {
            return null;
        }
        hasher.update(`path:${file.relPath}\n`);
        hasher.update(content);
        hasher.update('\n');
    }
    return hasher.digest('hex');
}
async function hashManagedDirectory(dirPath, raw = false) {
    const files = await listFilesRecursive(dirPath);
    if (files.length === 0) {
        return null;
    }
    const mapped = files.map(absPath => ({
        absPath,
        relPath: path.relative(dirPath, absPath).replaceAll('\\', '/'),
    }));
    return hashManagedFiles(mapped, raw);
}
async function hashManagedFile(filePath, relPath) {
    return hashManagedFiles([{ absPath: filePath, relPath }]);
}
function resolveSkillPaths(projectDir, skillsDir, agentId, skillName, sourceSkillDir) {
    const transformer = getTransformer(agentId);
    const agentConfig = getAgentConfig(agentId);
    const transformed = transformer.transform(skillName, '');
    const sourceRefsDir = path.join(sourceSkillDir, 'references');
    if (transformed.flat) {
        const targetSkillDir = path.join(projectDir, agentConfig.configDir, transformed.targetDir);
        return {
            sourceSkillDir,
            targetSkillDir,
            targetSkillFile: path.join(targetSkillDir, transformed.targetName),
            targetRefsDir: path.join(targetSkillDir, 'references'),
            sourceRefsDir,
            flat: true,
        };
    }
    const targetSkillDir = path.join(projectDir, skillsDir, transformed.targetDir);
    return {
        sourceSkillDir,
        targetSkillDir,
        targetSkillFile: path.join(targetSkillDir, 'SKILL.md'),
        targetRefsDir: path.join(targetSkillDir, 'references'),
        sourceRefsDir,
        flat: false,
    };
}
function ensureTargetWithinRoot(targetRoot, targetFile, options) {
    const resolvedRoot = path.resolve(targetRoot);
    const rootLabel = options?.rootLabel ?? 'Agent files directory';
    const targetLabel = options?.targetLabel ?? 'Agent file target';
    const rootDescription = options?.rootDescription ?? 'agents directory';
    // Reject a symlinked root when it already exists so managed agent files
    // cannot be redirected outside the project by replacing `.claude/agents`
    // or another runtime-local agents directory with a symlink.
    if (existsSync(resolvedRoot) && lstatSync(resolvedRoot).isSymbolicLink()) {
        throw new Error(`${rootLabel} must not be a symbolic link: ${targetRoot}`);
    }
    const resolvedTarget = path.resolve(targetFile);
    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error(`${targetLabel} escapes ${rootDescription}: ${targetFile}`);
    }
}
function resolveAgentFilePaths(projectDir, agentsDir, sourceRoot, sourceRelPath, targetRelPath = sourceRelPath) {
    const targetRoot = path.join(projectDir, agentsDir);
    const sourceFile = path.join(sourceRoot, sourceRelPath);
    const targetFile = path.join(targetRoot, targetRelPath);
    ensureTargetWithinRoot(targetRoot, targetFile);
    return {
        sourceFile,
        targetFile,
        sourceRelPath,
        targetRelPath,
    };
}
export function resolveInstalledAgentFileTargetPath(projectDir, agentsDir, relPath) {
    assertSafeManagedRelativePath(relPath);
    const targetRoot = path.join(projectDir, agentsDir);
    const targetFile = path.join(targetRoot, relPath);
    ensureTargetWithinRoot(targetRoot, targetFile);
    return targetFile;
}
export function resolveManagedConfigFilePaths(projectDir, agentId, relPath) {
    assertSafeManagedRelativePath(relPath);
    const agentConfig = getAgentConfig(agentId);
    const sourceRoot = agentConfig.configFilesSourceDir
        ? getPackagePath(agentConfig.configFilesSourceDir)
        : null;
    if (!sourceRoot) {
        throw new Error(`Agent "${agentId}" does not define managed config files.`);
    }
    const sourceFile = path.join(sourceRoot, relPath);
    const targetFile = resolveInstalledConfigFileTargetPath(projectDir, agentId, relPath);
    ensureTargetWithinRoot(sourceRoot, sourceFile, {
        rootLabel: 'Managed config source directory',
        targetLabel: 'Managed config source',
        rootDescription: 'source directory',
    });
    return {
        sourceFile,
        targetFile,
        relPath,
    };
}
function resolveInstalledConfigFileTargetPath(projectDir, agentId, relPath) {
    assertSafeManagedRelativePath(relPath);
    const agentConfig = getAgentConfig(agentId);
    const targetRoot = path.join(projectDir, agentConfig.configDir);
    const targetFile = path.join(targetRoot, relPath);
    ensureTargetWithinRoot(targetRoot, targetFile, {
        rootLabel: 'Managed config directory',
        targetLabel: 'Managed config target',
        rootDescription: 'config directory',
    });
    return targetFile;
}
function getBundledAgentFilesSourceDir(agentId) {
    const agentConfig = getAgentConfig(agentId);
    if (agentConfig.source !== 'builtin') {
        return null;
    }
    if (agentConfig.agentsSourceDir) {
        return getPackagePath(agentConfig.agentsSourceDir);
    }
    return null;
}
export function resolveManagedSubagentPaths(projectDir, agentId, agentsDir, relPath) {
    assertSafeManagedRelativePath(relPath);
    const sourceRoot = getBundledAgentFilesSourceDir(agentId);
    if (!sourceRoot) {
        throw new Error(`Agent "${agentId}" does not define bundled agent files.`);
    }
    return resolveAgentFilePaths(projectDir, agentsDir, sourceRoot, relPath);
}
async function hashInstalledSkill(paths, raw = false) {
    if (!paths.flat) {
        return hashManagedDirectory(paths.targetSkillDir, raw);
    }
    const mainFileExists = await fileExists(paths.targetSkillFile);
    if (!mainFileExists) {
        return null;
    }
    const filesToHash = [
        {
            absPath: paths.targetSkillFile,
            relPath: path.basename(paths.targetSkillFile),
        },
    ];
    const sourceRefs = await listFilesRecursive(paths.sourceRefsDir);
    for (const sourceRef of sourceRefs) {
        const relPath = path.relative(paths.sourceRefsDir, sourceRef).replaceAll('\\', '/');
        const targetRef = path.join(paths.targetRefsDir, relPath);
        filesToHash.push({
            absPath: targetRef,
            relPath: `references/${relPath}`,
        });
    }
    return hashManagedFiles(filesToHash, raw);
}
async function getManagedSkillState(projectDir, agentInstallation, skillName, context = createSkillRenderContext(agentInstallation.id, agentInstallation.skillsDir)) {
    const sourceSkillDir = path.join(getSkillsDir(), skillName);
    const sourceHash = await hashDirectory(sourceSkillDir, {
        skipDirectory: skillSourceSkipDirectory(sourceSkillDir),
    });
    if (!sourceHash) {
        return null;
    }
    const paths = resolveSkillPaths(projectDir, agentInstallation.skillsDir, agentInstallation.id, skillName, sourceSkillDir);
    const installedHash = await hashInstalledSkill(paths);
    const rawInstalledHash = await hashInstalledSkill(paths, true);
    if (!installedHash || !rawInstalledHash) {
        return null;
    }
    return {
        sourceHash,
        installedHash,
        rawInstalledHash,
        renderContextHash: context.hash,
    };
}
async function readReceiptSourceFile(projectDir, file) {
    const relative = path.relative(path.resolve(projectDir), path.resolve(file));
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Receipt source escapes project: ${file}`);
    }
    let current = path.resolve(projectDir);
    for (const part of relative.split(path.sep)) {
        current = path.join(current, part);
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink())
            throw new Error(`Linked receipt source: ${current}`);
    }
    if (!(await fs.lstat(current)).isFile())
        throw new Error(`Receipt source is not a file: ${current}`);
    return fs.readFile(current);
}
async function loadReceiptInjections(projectDir, registeredExtensions) {
    const names = registeredExtensions.map(extension => extension.name);
    const installed = await loadAllExtensions(projectDir, names);
    if (new Set(names).size !== names.length || installed.length !== names.length) {
        throw new Error('Missing or ambiguous registered extension manifest');
    }
    const injections = [];
    for (const { dir, manifest } of installed) {
        await readReceiptSourceFile(projectDir, path.join(dir, 'extension.json'));
        const record = registeredExtensions.find(extension => extension.name === manifest.name);
        if (!record || record.version !== manifest.version)
            throw new Error(`Unproven extension revision: ${manifest.name}`);
        for (const injection of manifest.injections ?? []) {
            injections.push({ ...injection, extensionName: manifest.name,
                content: (await readReceiptSourceFile(projectDir, path.join(dir, injection.file))).toString('utf8') });
        }
    }
    return injections;
}
async function inventoryReceiptFiles(directory) {
    const files = new Map();
    async function visit(current, relative) {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink())
            throw new Error(`Linked installed skill entry: ${current}`);
        if (stat.isDirectory()) {
            for (const name of await fs.readdir(current)) {
                await visit(path.join(current, name), relative ? `${relative}/${name}` : name);
            }
        }
        else if (stat.isFile() && relative) {
            files.set(relative, await fs.readFile(current));
        }
        else {
            throw new Error(`Unsupported installed skill entry: ${current}`);
        }
    }
    await visit(directory, '');
    return files;
}
async function proveManagedSkillRawHash(projectDir, agent, skillName, context, injections) {
    const sourceSkillDir = path.join(getSkillsDir(), skillName);
    if ((await fs.lstat(sourceSkillDir)).isSymbolicLink())
        throw new Error(`Linked bundled skill source: ${skillName}`);
    const expected = await renderSkillFiles(sourceSkillDir, skillName, agent.id, context);
    let content = expected.get('SKILL.md').toString('utf8');
    for (const injection of injections) {
        if (injection.target === skillName) {
            content = applyInjection(content, injection.content, injection.position, injection.extensionName, skillName);
        }
    }
    expected.set('SKILL.md', Buffer.from(content));
    const paths = resolveSkillPaths(projectDir, agent.skillsDir, agent.id, skillName, sourceSkillDir);
    let actual;
    if (paths.flat) {
        // Flat workflows share their references directory. Prove the files belonging
        // to this source only; removal leaves all references and other workflows in place.
        const mainName = path.basename(paths.targetSkillFile);
        expected.set(mainName, expected.get('SKILL.md'));
        expected.delete('SKILL.md');
        for (const relative of expected.keys()) {
            if (relative !== mainName && !relative.startsWith('references/'))
                expected.delete(relative);
        }
        actual = new Map();
        for (const relative of expected.keys()) {
            const target = relative === mainName ? paths.targetSkillFile
                : path.join(paths.targetRefsDir, relative.slice('references/'.length));
            actual.set(relative, await readReceiptSourceFile(projectDir, target));
        }
    }
    else {
        actual = await inventoryReceiptFiles(paths.targetSkillDir);
    }
    if (actual.size !== expected.size || [...expected].some(([relative, bytes]) => !actual.get(relative)?.equals(bytes))) {
        throw new Error('Installed files differ from the complete known source and injection composition');
    }
    const hash = createHash('sha256');
    for (const [relative, bytes] of [...actual].sort(([left], [right]) => left.localeCompare(right))) {
        hash.update(`path:${relative}\n`);
        hash.update(bytes);
        hash.update('\n');
    }
    return hash.digest('hex');
}
export async function buildManagedSkillsState(projectDir, agentInstallation, baseSkills, context, registeredExtensions = []) {
    const state = {};
    const renderContext = context ?? createSkillRenderContext(agentInstallation.id, agentInstallation.skillsDir);
    let injections = null;
    try {
        injections = await loadReceiptInjections(projectDir, registeredExtensions);
    }
    catch (error) {
        logSkillTarget('[FIX:155] receipt:unproven-extensions', { runtime: agentInstallation.id, reason: error.message });
    }
    for (const skillName of baseSkills) {
        const managed = await getManagedSkillState(projectDir, agentInstallation, skillName, renderContext);
        if (managed) {
            // Observed bytes support update decisions, but do not prove ownership.
            // Overlay installs can leave user files even after a successful write.
            delete managed.rawInstalledHash;
            if (injections) {
                try {
                    managed.rawInstalledHash = await proveManagedSkillRawHash(projectDir, agentInstallation, skillName, renderContext, injections);
                    logSkillTarget('[FIX:155] receipt:proven-source', { runtime: agentInstallation.id, skill: skillName });
                }
                catch (error) {
                    logSkillTarget('[FIX:155] receipt:unproven-files', { runtime: agentInstallation.id, skill: skillName, reason: error.message });
                }
            }
            state[skillName] = managed;
        }
    }
    return state;
}
export async function getAvailableSubagents(agentId = 'claude') {
    const packageSubagentsDir = getBundledAgentFilesSourceDir(agentId);
    if (!packageSubagentsDir) {
        return [];
    }
    const files = await listFilesRecursive(packageSubagentsDir);
    const relPaths = files.map(filePath => path.relative(packageSubagentsDir, filePath).replaceAll('\\', '/'));
    return relPaths;
}
export function buildBundledAgentFileSources(relPaths) {
    const result = {};
    for (const relPath of relPaths) {
        result[relPath] = {
            kind: 'bundled',
            sourcePath: relPath,
        };
    }
    return result;
}
export function buildExtensionAgentFileSources(manifest) {
    const result = new Map();
    for (const agentFile of manifest.agentFiles ?? []) {
        const existing = result.get(agentFile.runtime) ?? {};
        existing[agentFile.target] = {
            kind: 'extension',
            sourcePath: agentFile.source,
            extensionName: manifest.name,
        };
        result.set(agentFile.runtime, existing);
    }
    return result;
}
function resolveManagedAgentFilePaths(projectDir, agentInstallation, relPath, source) {
    if (!agentInstallation.agentsDir) {
        return null;
    }
    if (source.kind === 'bundled') {
        const sourceRoot = getBundledAgentFilesSourceDir(agentInstallation.id);
        if (!sourceRoot) {
            return null;
        }
        return resolveAgentFilePaths(projectDir, agentInstallation.agentsDir, sourceRoot, source.sourcePath, relPath);
    }
    if (!source.extensionName) {
        return null;
    }
    const sourceRoot = path.join(getExtensionsDir(projectDir), source.extensionName);
    return resolveAgentFilePaths(projectDir, agentInstallation.agentsDir, sourceRoot, source.sourcePath, relPath);
}
async function getManagedAgentFileResolution(projectDir, agentInstallation, relPath, source) {
    if (!source) {
        return { status: 'missing-source-metadata' };
    }
    const paths = resolveManagedAgentFilePaths(projectDir, agentInstallation, relPath, source);
    if (!paths) {
        return { status: 'missing-source-root' };
    }
    const sourceHash = await hashManagedFile(paths.sourceFile, relPath);
    if (!sourceHash) {
        return { status: 'missing-source-file' };
    }
    const installedHash = await hashManagedFile(paths.targetFile, relPath);
    if (!installedHash) {
        return { status: 'missing-installed-artifact' };
    }
    return {
        status: 'resolved',
        state: {
            sourceHash,
            installedHash,
        },
    };
}
function shouldPreserveManagedStateOnMissingSource(status) {
    return status === 'missing-source-metadata'
        || status === 'missing-source-root'
        || status === 'missing-source-file';
}
function formatManagedAgentFileResolutionWarning(relPath, status) {
    switch (status) {
        case 'missing-source-metadata':
            return `Warning: Managed agent file "${relPath}" has no source metadata - preserving previous hash state.`;
        case 'missing-source-root':
            return `Warning: Managed agent file "${relPath}" source root is unavailable - preserving previous hash state.`;
        case 'missing-source-file':
            return `Warning: Managed agent file "${relPath}" source file is unavailable - preserving previous hash state.`;
    }
}
export async function buildManagedAgentFilesState(projectDir, agentInstallation, installedAgentFiles, options = {}) {
    const state = {};
    if (!agentInstallation.agentsDir) {
        return state;
    }
    const previousManaged = agentInstallation.managedAgentFiles ?? {};
    const sources = agentInstallation.agentFileSources ?? {};
    for (const relPath of installedAgentFiles) {
        const resolution = await getManagedAgentFileResolution(projectDir, agentInstallation, relPath, sources[relPath]);
        if (resolution.status === 'resolved' && resolution.state) {
            state[relPath] = resolution.state;
            continue;
        }
        if (options.preserveExistingOnMissingSource
            && previousManaged[relPath]
            && shouldPreserveManagedStateOnMissingSource(resolution.status)) {
            state[relPath] = previousManaged[relPath];
            options.warn?.(formatManagedAgentFileResolutionWarning(relPath, resolution.status));
        }
    }
    return state;
}
async function getManagedConfigFileState(projectDir, agentInstallation, relPath) {
    const configuredFiles = agentInstallation.configFiles ?? getAgentConfig(agentInstallation.id).configFiles ?? [];
    if (!configuredFiles.includes(relPath)) {
        return null;
    }
    const paths = resolveManagedConfigFilePaths(projectDir, agentInstallation.id, relPath);
    const sourceHash = await hashManagedFile(paths.sourceFile, relPath);
    if (!sourceHash) {
        return null;
    }
    const installedHash = await hashManagedFile(paths.targetFile, relPath);
    if (!installedHash) {
        return null;
    }
    return {
        sourceHash,
        installedHash,
    };
}
export async function buildManagedConfigFilesState(projectDir, agentInstallation, installedConfigFiles) {
    const state = {};
    const configuredFiles = agentInstallation.configFiles ?? getAgentConfig(agentInstallation.id).configFiles ?? [];
    if (configuredFiles.length === 0) {
        return state;
    }
    for (const relPath of installedConfigFiles) {
        const managed = await getManagedConfigFileState(projectDir, agentInstallation, relPath);
        if (managed) {
            state[relPath] = managed;
        }
    }
    return state;
}
export async function buildManagedSubagentsState(projectDir, agentInstallation, installedSubagents) {
    return buildManagedAgentFilesState(projectDir, agentInstallation, installedSubagents);
}
export async function rebuildManagedAgentFilesForAgents(projectDir, agents, options = {}) {
    for (const agent of agents) {
        if (!agent.agentsDir) {
            continue;
        }
        agent.managedAgentFiles = await buildManagedAgentFilesState(projectDir, agent, agent.installedAgentFiles ?? [], options);
    }
}
export async function renderSkillFiles(sourceSkillDir, skillName, agentId, context) {
    const files = new Map();
    const vars = buildTemplateVars(context.agent);
    async function visit(directory, relative) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            if (!relative && SKILL_INTERNAL_TOP_LEVEL_DIRS.has(entry.name))
                continue;
            const relPath = relative ? `${relative}/${entry.name}` : entry.name;
            const source = path.join(directory, entry.name);
            if (entry.isSymbolicLink())
                throw new Error(`Linked skill source cannot be rendered safely: ${source}`);
            if (entry.isDirectory())
                await visit(source, relPath);
            else if (entry.isFile()) {
                let bytes = await fs.readFile(source);
                if (entry.name.endsWith('.md')) {
                    let content = bytes.toString('utf8');
                    if (relPath === 'SKILL.md') {
                        content = replaceFrontmatterName(content, skillName);
                        content = getTransformer(agentId).transform(skillName, content).content;
                    }
                    bytes = Buffer.from(processTemplate(content, vars));
                }
                files.set(relPath, bytes);
            }
            else
                throw new Error(`Unsupported skill source entry: ${source}`);
        }
    }
    await visit(sourceSkillDir, '');
    if (!files.has('SKILL.md'))
        throw new Error(`SKILL.md not found in ${sourceSkillDir}`);
    return files;
}
async function installSkillWithTransformer(sourceSkillDir, skillName, projectDir, skillsDir, agentId, context) {
    const agentConfig = context.agent;
    logSkillTarget('install:start', { agentId, skillsDir, skillName, renderContextHash: context.hash });
    const transformer = getTransformer(agentId);
    const skillMdPath = path.join(sourceSkillDir, 'SKILL.md');
    const content = await readTextFile(skillMdPath);
    if (!content) {
        throw new Error(`SKILL.md not found in ${sourceSkillDir}`);
    }
    // If skill is installed under a different name (e.g. replacement), rewrite frontmatter name
    const fmName = extractFrontmatterName(content);
    const adjustedContent = (fmName && fmName !== skillName) ? replaceFrontmatterName(content, skillName) : content;
    const result = transformer.transform(skillName, adjustedContent);
    const vars = buildTemplateVars(agentConfig);
    if (result.flat) {
        const targetPath = path.join(projectDir, agentConfig.configDir, result.targetDir, result.targetName);
        await writeTextFile(targetPath, processTemplate(result.content, vars));
        // Copy references directory if it exists in the source skill
        const sourceRefsDir = path.join(sourceSkillDir, 'references');
        if (await fileExists(sourceRefsDir)) {
            const targetRefsDir = path.join(projectDir, agentConfig.configDir, result.targetDir, 'references');
            await copyDirectory(sourceRefsDir, targetRefsDir);
            await processSkillTemplates(targetRefsDir, agentConfig);
        }
    }
    else {
        const targetSkillDir = path.join(projectDir, skillsDir, result.targetDir);
        await copyDirectory(sourceSkillDir, targetSkillDir, {
            filter: skillSourceCopyFilter(sourceSkillDir),
        });
        if (result.content !== content) {
            await writeTextFile(path.join(targetSkillDir, 'SKILL.md'), result.content);
        }
        else if (adjustedContent !== content) {
            await writeTextFile(path.join(targetSkillDir, 'SKILL.md'), adjustedContent);
        }
        const rendered = await renderSkillFiles(sourceSkillDir, skillName, agentId, context);
        for (const [relative, bytes] of rendered) {
            await ensureDir(path.dirname(path.join(targetSkillDir, relative)));
            await fs.writeFile(path.join(targetSkillDir, relative), bytes);
        }
    }
    logSkillTarget('install:complete', { agentId, skillsDir, skillName });
}
export async function installSkills(options) {
    const { projectDir, skillsDir, skills, agentId } = options;
    const installedSkills = [];
    const context = options.renderContext ?? createSkillRenderContext(agentId, skillsDir);
    const targetDir = path.join(projectDir, skillsDir);
    await ensureDir(targetDir);
    const packageSkillsDir = getSkillsDir();
    for (const skill of skills) {
        const sourceSkillDir = path.join(packageSkillsDir, skill);
        try {
            await installSkillWithTransformer(sourceSkillDir, skill, projectDir, skillsDir, agentId, context);
            installedSkills.push(skill);
        }
        catch (error) {
            console.warn(`Warning: Could not install skill "${skill}": ${error}`);
        }
    }
    const transformer = getTransformer(agentId);
    if (transformer.postInstall) {
        await transformer.postInstall(projectDir);
    }
    return installedSkills;
}
export async function installSubagents(options) {
    const { projectDir } = options;
    const agentId = options.agentId ?? 'claude';
    const agentsDir = options.agentsDir ?? options.subagentsDir;
    if (!agentsDir) {
        return [];
    }
    const availableSubagents = await getAvailableSubagents(agentId);
    if (availableSubagents.length === 0) {
        return [];
    }
    const targetRoot = path.join(projectDir, agentsDir);
    await ensureDir(targetRoot);
    for (const relPath of availableSubagents) {
        const paths = resolveManagedSubagentPaths(projectDir, agentId, agentsDir, relPath);
        await copyFile(paths.sourceFile, paths.targetFile);
    }
    return availableSubagents;
}
export async function installConfigFiles(options) {
    const { projectDir, agentId, configFiles } = options;
    if (configFiles.length === 0) {
        return [];
    }
    const previousInstalledSet = new Set(options.installedConfigFiles ?? []);
    const previousManaged = options.managedConfigFiles ?? {};
    const installed = [];
    for (const relPath of configFiles) {
        const paths = resolveManagedConfigFilePaths(projectDir, agentId, relPath);
        const sourceHash = await hashManagedFile(paths.sourceFile, relPath);
        const installedHash = await hashManagedFile(paths.targetFile, relPath);
        const previousState = previousManaged[relPath];
        if (!previousInstalledSet.has(relPath) && installedHash) {
            console.warn(`Warning: Existing untracked config file "${relPath}" detected — preserving it and skipping managed install.`);
            continue;
        }
        if (previousInstalledSet.has(relPath) && !previousState && installedHash) {
            console.warn(`Warning: Managed config file "${relPath}" has no saved state — preserving existing file.`);
            installed.push(relPath);
            continue;
        }
        if (previousState && installedHash && previousState.installedHash !== installedHash) {
            console.warn(`Warning: Local modifications detected in config file "${relPath}" — preserving existing file.`);
            installed.push(relPath);
            continue;
        }
        if (previousState && installedHash && previousState.installedHash === installedHash && previousState.installedHash !== previousState.sourceHash) {
            installed.push(relPath);
            continue;
        }
        if (!sourceHash && installedHash) {
            installed.push(relPath);
            continue;
        }
        await copyFile(paths.sourceFile, paths.targetFile);
        installed.push(relPath);
    }
    return installed;
}
export function partitionSkills(skills) {
    return {
        base: skills.filter(s => !s.includes('/')),
        custom: skills.filter(s => s.includes('/')),
    };
}
export async function getAvailableSkills() {
    const packageSkillsDir = getSkillsDir();
    const dirs = await listDirectories(packageSkillsDir);
    return dirs.filter(dir => !dir.startsWith('_'));
}
export async function installExtensionSkills(projectDir, agentInstallation, extensionDir, skillPaths, nameOverrides, context = createSkillRenderContext(agentInstallation.id, agentInstallation.skillsDir)) {
    const installed = [];
    for (const skillPath of skillPaths) {
        const sourceDir = path.join(extensionDir, skillPath);
        const skillName = nameOverrides?.[skillPath] ?? path.basename(skillPath);
        try {
            await installSkillWithTransformer(sourceDir, skillName, projectDir, agentInstallation.skillsDir, agentInstallation.id, context);
            installed.push(skillName);
        }
        catch (error) {
            console.warn(`Warning: Could not install extension skill "${skillName}": ${error}`);
        }
    }
    return installed;
}
async function removeSkillsByName(projectDir, agentInstallation, skillNames) {
    const agentConfig = getAgentConfig(agentInstallation.id);
    const transformer = getTransformer(agentInstallation.id);
    const removed = [];
    for (const skillName of skillNames) {
        try {
            const result = transformer.transform(skillName, '');
            if (result.flat) {
                const targetPath = path.join(projectDir, agentConfig.configDir, result.targetDir, result.targetName);
                await removeDirectory(targetPath);
            }
            else {
                const targetSkillDir = path.join(projectDir, agentInstallation.skillsDir, result.targetDir);
                await removeDirectory(targetSkillDir);
            }
            removed.push(skillName);
        }
        catch {
            // Skill may not exist, ignore
        }
    }
    return removed;
}
export async function removeOwnedSkills(projectDir, agent, survivors) {
    const target = await physicalProjectPath(projectDir, agent.skillsDir);
    const consumers = await Promise.all(survivors.map(async (survivor) => ({
        agent: survivor, target: await physicalProjectPath(projectDir, survivor.skillsDir),
    })));
    const removed = [];
    for (const name of agent.installedSkills.filter(name => !name.includes('/'))) {
        if (!name || name === '.' || name === '..' || name.includes('\\'))
            throw new Error(`Unsafe managed skill name: ${name}`);
        const needed = consumers.some(consumer => consumer.target === target && consumer.agent.installedSkills.includes(name));
        if (needed) {
            logSkillTarget('remove:retain', { runtime: agent.id, skill: name, reason: 'surviving-consumer' });
            continue;
        }
        const saved = agent.managedSkills?.[name];
        const current = await getManagedSkillState(projectDir, agent, name);
        // Update hashes normalize injections and line endings; only a saved raw
        // receipt can authorize deletion without losing those local changes.
        if (!saved || !current || saved.installedHash !== current.installedHash
            || !saved.rawInstalledHash || saved.rawInstalledHash !== current.rawInstalledHash) {
            console.warn(`[skill-targets] [FIX:155] Preserving unproven or modified skill: ${agent.skillsDir}/${name}`);
            continue;
        }
        logSkillTarget('[FIX:155] remove:verified-raw-baseline', { runtime: agent.id, skill: name });
        const transformer = getTransformer(agent.id).transform(name, '');
        if (transformer.flat) {
            await removeFile(path.join(projectDir, getAgentConfig(agent.id).configDir, transformer.targetDir, transformer.targetName));
        }
        else {
            const directory = path.join(target, transformer.targetDir);
            if (lstatSync(directory).isSymbolicLink())
                throw new Error(`Linked managed skill cannot be removed: ${directory}`);
            const files = await listFilesRecursive(directory);
            const directories = new Set([directory]);
            for (const file of files) {
                if (lstatSync(file).isSymbolicLink())
                    throw new Error(`Linked skill file cannot be removed: ${file}`);
                let parent = path.dirname(file);
                while (parent !== directory && parent.startsWith(`${directory}${path.sep}`)) {
                    directories.add(parent);
                    parent = path.dirname(parent);
                }
                await removeFile(file);
            }
            for (const parent of [...directories].sort((a, b) => b.length - a.length)) {
                await fs.rmdir(parent).catch(error => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code))
                    throw error; });
            }
        }
        removed.push(name);
        logSkillTarget('remove:complete', { runtime: agent.id, skill: name });
    }
    return removed;
}
async function removeSubagentsByName(projectDir, agentInstallation, subagentNames) {
    if (!agentInstallation.agentsDir) {
        return [];
    }
    const removed = [];
    for (const relPath of subagentNames) {
        try {
            const targetFile = resolveInstalledAgentFileTargetPath(projectDir, agentInstallation.agentsDir, relPath);
            await removeFile(targetFile);
            removed.push(relPath);
        }
        catch {
            // Subagent file may not exist, ignore
        }
    }
    return removed;
}
async function removeConfigFilesByName(projectDir, agentInstallation, configFiles) {
    const removed = [];
    for (const relPath of configFiles) {
        try {
            const targetFile = resolveInstalledConfigFileTargetPath(projectDir, agentInstallation.id, relPath);
            await removeFile(targetFile);
            removed.push(relPath);
        }
        catch {
            // Config file may not exist, ignore.
        }
    }
    return removed;
}
export async function removeExtensionSkills(projectDir, agentInstallation, skillPaths) {
    return removeSkillsByName(projectDir, agentInstallation, skillPaths.map(p => path.basename(p)));
}
export async function updateSkills(agentInstallation, projectDir, options = {}) {
    const { excludeSkills = [], force = false, installNewSkills = [] } = options;
    const availableSkills = await getAvailableSkills();
    const availableSet = new Set(availableSkills);
    const excludeSet = new Set(excludeSkills);
    const installNewSet = new Set(installNewSkills);
    const entries = [];
    const { base: previousBaseSkills, custom } = partitionSkills(agentInstallation.installedSkills);
    const previousBaseSet = new Set(previousBaseSkills);
    const previousManaged = agentInstallation.managedSkills ?? {};
    const removedSkills = previousBaseSkills.filter(s => !availableSet.has(s) && !excludeSet.has(s));
    if (removedSkills.length > 0) {
        await removeSkillsByName(projectDir, agentInstallation, removedSkills);
        for (const skill of removedSkills) {
            entries.push({
                skill,
                status: 'removed',
                reason: 'package-removed',
            });
        }
    }
    const replacedSkills = previousBaseSkills.filter(s => excludeSet.has(s));
    for (const skill of replacedSkills) {
        entries.push({
            skill,
            status: 'skipped',
            reason: 'replaced-by-extension',
        });
    }
    const newlyAvailable = availableSkills.filter(s => !previousBaseSet.has(s) && !excludeSet.has(s));
    const newSkillsToInstall = newlyAvailable.filter(s => installNewSet.has(s));
    const skippedNewSkills = newlyAvailable.filter(s => !installNewSet.has(s));
    const installedNewSkills = newSkillsToInstall.length > 0
        ? await installSkills({
            projectDir,
            skillsDir: agentInstallation.skillsDir,
            skills: newSkillsToInstall,
            agentId: agentInstallation.id,
            renderContext: options.renderContext,
        })
        : [];
    const installedNewSet = new Set(installedNewSkills);
    for (const skill of newSkillsToInstall) {
        entries.push({
            skill,
            status: installedNewSet.has(skill) ? 'changed' : 'skipped',
            reason: installedNewSet.has(skill) ? 'new-in-package' : 'install-failed',
        });
    }
    for (const skill of skippedNewSkills) {
        entries.push({
            skill,
            status: 'skipped',
            reason: 'new-skill-not-installed',
        });
    }
    const updatableBaseSkills = previousBaseSkills.filter(s => availableSet.has(s) && !excludeSet.has(s));
    const shouldInstall = new Map();
    for (const skillName of updatableBaseSkills) {
        const sourceSkillDir = path.join(getSkillsDir(), skillName);
        const sourceHash = await hashDirectory(sourceSkillDir, {
            skipDirectory: skillSourceSkipDirectory(sourceSkillDir),
        });
        const paths = resolveSkillPaths(projectDir, agentInstallation.skillsDir, agentInstallation.id, skillName, sourceSkillDir);
        const installedHash = await hashInstalledSkill(paths);
        const previousState = previousManaged[skillName];
        if (force) {
            shouldInstall.set(skillName, { install: true, reason: 'force-clean-reinstall' });
            continue;
        }
        if (!sourceHash) {
            shouldInstall.set(skillName, { install: true, reason: 'source-missing' });
            continue;
        }
        if (!previousState) {
            shouldInstall.set(skillName, { install: true, reason: 'missing-managed-state' });
            continue;
        }
        if (!installedHash) {
            shouldInstall.set(skillName, { install: true, reason: 'missing-installed-artifact' });
            continue;
        }
        if (previousState.renderContextHash !== (options.renderContext ?? createSkillRenderContext(agentInstallation.id, agentInstallation.skillsDir)).hash) {
            shouldInstall.set(skillName, { install: true, reason: 'render-context-changed' });
            continue;
        }
        if (previousState.sourceHash !== sourceHash) {
            shouldInstall.set(skillName, { install: true, reason: 'source-hash-changed' });
            continue;
        }
        if (previousState.installedHash !== installedHash) {
            console.warn(`Warning: Local modifications detected in skill "${skillName}" — will be overwritten by update.`);
            shouldInstall.set(skillName, { install: true, reason: 'installed-hash-drift' });
            continue;
        }
        shouldInstall.set(skillName, { install: false, reason: 'up-to-date' });
    }
    const skillsToInstall = updatableBaseSkills.filter(skillName => shouldInstall.get(skillName)?.install === true);
    if (force && skillsToInstall.length > 0) {
        await removeSkillsByName(projectDir, agentInstallation, skillsToInstall);
    }
    const installedBaseSkills = skillsToInstall.length > 0
        ? await installSkills({
            projectDir,
            skillsDir: agentInstallation.skillsDir,
            skills: skillsToInstall,
            agentId: agentInstallation.id,
            renderContext: options.renderContext,
        })
        : [];
    const installedSet = new Set(installedBaseSkills);
    for (const skillName of updatableBaseSkills) {
        const decision = shouldInstall.get(skillName);
        if (!decision) {
            continue;
        }
        if (decision.install) {
            entries.push({
                skill: skillName,
                status: installedSet.has(skillName) ? 'changed' : 'skipped',
                reason: installedSet.has(skillName) ? decision.reason : 'install-failed',
            });
            continue;
        }
        entries.push({
            skill: skillName,
            status: 'unchanged',
            reason: decision.reason,
        });
    }
    const retainedBaseSkills = previousBaseSkills.filter(s => (availableSet.has(s) || excludeSet.has(s)) && !removedSkills.includes(s));
    return {
        installedSkills: [...retainedBaseSkills, ...installedNewSkills, ...custom],
        entries,
    };
}
export async function updateSubagents(agentInstallation, projectDir, options = {}) {
    if (!agentInstallation.agentsDir) {
        return {
            installedAgentFiles: [],
            agentFileSources: {},
            entries: [],
        };
    }
    const { force = false } = options;
    const sourceRoot = getBundledAgentFilesSourceDir(agentInstallation.id);
    if (!sourceRoot) {
        return {
            installedAgentFiles: agentInstallation.installedAgentFiles ?? [],
            agentFileSources: { ...(agentInstallation.agentFileSources ?? {}) },
            entries: [],
        };
    }
    const availableSubagents = await getAvailableSubagents(agentInstallation.id);
    const availableSet = new Set(availableSubagents);
    const previousInstalled = agentInstallation.installedAgentFiles ?? [];
    const previousInstalledSet = new Set(previousInstalled);
    const previousSources = agentInstallation.agentFileSources ?? {};
    const previousManaged = agentInstallation.managedAgentFiles ?? {};
    const entries = [];
    const previousBundledInstalled = previousInstalled.filter(relPath => previousSources[relPath]?.kind === 'bundled' || (!previousSources[relPath] && availableSet.has(relPath)));
    const previousNonBundledInstalled = previousInstalled.filter(relPath => previousSources[relPath]?.kind !== 'bundled');
    const removedSubagents = previousBundledInstalled.filter((subagent) => !availableSet.has(subagent));
    if (removedSubagents.length > 0) {
        await removeSubagentsByName(projectDir, agentInstallation, removedSubagents);
        for (const subagent of removedSubagents) {
            entries.push({
                subagent,
                status: 'removed',
                reason: 'package-removed',
            });
        }
    }
    const shouldInstall = new Map();
    for (const relPath of availableSubagents) {
        const paths = resolveManagedSubagentPaths(projectDir, agentInstallation.id, agentInstallation.agentsDir, relPath);
        const sourceHash = await hashManagedFile(paths.sourceFile, relPath);
        const installedHash = await hashManagedFile(paths.targetFile, relPath);
        const previousState = previousManaged[relPath];
        if (force) {
            shouldInstall.set(relPath, { install: true, reason: 'force-clean-reinstall' });
            continue;
        }
        if (!previousInstalledSet.has(relPath)) {
            shouldInstall.set(relPath, { install: true, reason: 'new-in-package' });
            continue;
        }
        if (!sourceHash) {
            shouldInstall.set(relPath, { install: false, reason: 'source-missing' });
            continue;
        }
        if (!previousState) {
            shouldInstall.set(relPath, { install: true, reason: 'missing-managed-state' });
            continue;
        }
        if (!installedHash) {
            shouldInstall.set(relPath, { install: true, reason: 'missing-installed-artifact' });
            continue;
        }
        if (previousState.sourceHash !== sourceHash) {
            shouldInstall.set(relPath, { install: true, reason: 'source-hash-changed' });
            continue;
        }
        if (previousState.installedHash !== installedHash) {
            console.warn(`Warning: Local modifications detected in agent file "${relPath}" — will be overwritten by update.`);
            shouldInstall.set(relPath, { install: true, reason: 'installed-hash-drift' });
            continue;
        }
        shouldInstall.set(relPath, { install: false, reason: 'up-to-date' });
    }
    const subagentsToInstall = availableSubagents.filter(relPath => shouldInstall.get(relPath)?.install === true);
    const installedSubagents = [];
    for (const relPath of subagentsToInstall) {
        try {
            const paths = resolveManagedSubagentPaths(projectDir, agentInstallation.id, agentInstallation.agentsDir, relPath);
            await copyFile(paths.sourceFile, paths.targetFile);
            installedSubagents.push(relPath);
        }
        catch {
            // Install failure is reported through entries below.
        }
    }
    const installedSet = new Set(installedSubagents);
    for (const relPath of availableSubagents) {
        const decision = shouldInstall.get(relPath);
        if (!decision) {
            continue;
        }
        if (decision.install) {
            entries.push({
                subagent: relPath,
                status: installedSet.has(relPath) ? 'changed' : 'skipped',
                reason: installedSet.has(relPath) ? decision.reason : 'install-failed',
            });
            continue;
        }
        entries.push({
            subagent: relPath,
            status: decision.reason === 'up-to-date' ? 'unchanged' : 'skipped',
            reason: decision.reason,
        });
    }
    const syncedSubagents = availableSubagents.filter(relPath => installedSet.has(relPath) || previousInstalledSet.has(relPath));
    const syncedInstalledAgentFiles = Array.from(new Set([...previousNonBundledInstalled, ...syncedSubagents])).sort();
    const syncedAgentFileSources = {};
    for (const relPath of previousNonBundledInstalled) {
        const source = previousSources[relPath];
        if (source) {
            syncedAgentFileSources[relPath] = source;
        }
    }
    Object.assign(syncedAgentFileSources, buildBundledAgentFileSources(syncedSubagents));
    return {
        installedAgentFiles: syncedInstalledAgentFiles,
        agentFileSources: syncedAgentFileSources,
        entries,
    };
}
export async function updateConfigFiles(agentInstallation, projectDir, options = {}) {
    const configuredFiles = getAgentConfig(agentInstallation.id).configFiles ?? [];
    const { force = false } = options;
    const availableSet = new Set(configuredFiles);
    const previousInstalled = agentInstallation.installedConfigFiles ?? [];
    const previousInstalledSet = new Set(previousInstalled);
    const previousManaged = agentInstallation.managedConfigFiles ?? {};
    const entries = [];
    const removedFiles = previousInstalled.filter(file => !availableSet.has(file));
    if (removedFiles.length > 0) {
        const cleanRemovedFiles = [];
        for (const relPath of removedFiles) {
            const previousState = previousManaged[relPath];
            let installedHash = null;
            try {
                const targetFile = resolveInstalledConfigFileTargetPath(projectDir, agentInstallation.id, relPath);
                installedHash = await hashManagedFile(targetFile, relPath);
            }
            catch {
                console.warn(`Warning: Config file "${relPath}" was removed from the package, but its target path could not be verified — preserving existing file and dropping managed ownership.`);
                entries.push({
                    configFile: relPath,
                    status: 'skipped',
                    reason: 'local-modifications-preserved',
                });
                continue;
            }
            if (!installedHash) {
                entries.push({
                    configFile: relPath,
                    status: 'removed',
                    reason: 'package-removed',
                });
                continue;
            }
            if (previousState && previousState.installedHash === installedHash && previousState.sourceHash === previousState.installedHash) {
                cleanRemovedFiles.push(relPath);
                continue;
            }
            const warningSuffix = previousState
                ? 'local changes exist'
                : 'managed state is missing';
            console.warn(`Warning: Config file "${relPath}" was removed from the package, but ${warningSuffix} — preserving existing file and dropping managed ownership.`);
            entries.push({
                configFile: relPath,
                status: 'skipped',
                reason: 'local-modifications-preserved',
            });
        }
        if (cleanRemovedFiles.length > 0) {
            const removed = await removeConfigFilesByName(projectDir, agentInstallation, cleanRemovedFiles);
            const removedSet = new Set(removed);
            for (const relPath of cleanRemovedFiles) {
                entries.push({
                    configFile: relPath,
                    status: removedSet.has(relPath) ? 'removed' : 'skipped',
                    reason: removedSet.has(relPath) ? 'package-removed' : 'local-modifications-preserved',
                });
            }
        }
    }
    const shouldInstall = new Map();
    for (const relPath of configuredFiles) {
        const paths = resolveManagedConfigFilePaths(projectDir, agentInstallation.id, relPath);
        const sourceHash = await hashManagedFile(paths.sourceFile, relPath);
        const installedHash = await hashManagedFile(paths.targetFile, relPath);
        const previousState = previousManaged[relPath];
        const hasLocalCustomization = Boolean(previousState &&
            installedHash &&
            previousState.installedHash === installedHash &&
            previousState.installedHash !== previousState.sourceHash);
        if (!previousInstalledSet.has(relPath) && installedHash) {
            console.warn(`Warning: Existing untracked config file "${relPath}" detected — preserving it and skipping managed install.`);
            shouldInstall.set(relPath, { install: false, reason: 'untracked-target-exists' });
            continue;
        }
        if (previousInstalledSet.has(relPath) && !previousState && installedHash) {
            console.warn(`Warning: Managed config file "${relPath}" has no saved state — preserving existing file.`);
            shouldInstall.set(relPath, { install: false, reason: 'local-modifications-preserved' });
            continue;
        }
        if (hasLocalCustomization) {
            if (force) {
                console.warn(`Warning: Previously preserved local customization detected in config file "${relPath}" — preserving existing file. --force does not overwrite local config changes.`);
            }
            shouldInstall.set(relPath, {
                install: false,
                reason: force ? 'force-ignored-local-modifications-preserved' : 'local-modifications-preserved',
            });
            continue;
        }
        if (previousState && installedHash && previousState.installedHash !== installedHash) {
            const forceNote = force ? ' --force does not overwrite local config changes.' : '';
            console.warn(`Warning: Local modifications detected in config file "${relPath}" — preserving existing file.${forceNote}`);
            shouldInstall.set(relPath, {
                install: false,
                reason: force ? 'force-ignored-local-modifications-preserved' : 'local-modifications-preserved',
            });
            continue;
        }
        if (force) {
            shouldInstall.set(relPath, { install: true, reason: 'force-clean-reinstall' });
            continue;
        }
        if (!previousInstalledSet.has(relPath)) {
            shouldInstall.set(relPath, { install: true, reason: 'new-in-package' });
            continue;
        }
        if (!sourceHash) {
            shouldInstall.set(relPath, { install: false, reason: 'source-missing' });
            continue;
        }
        if (!previousState) {
            shouldInstall.set(relPath, { install: true, reason: 'missing-managed-state' });
            continue;
        }
        if (!installedHash) {
            shouldInstall.set(relPath, { install: true, reason: 'missing-installed-artifact' });
            continue;
        }
        if (previousState.sourceHash !== sourceHash) {
            shouldInstall.set(relPath, { install: true, reason: 'source-hash-changed' });
            continue;
        }
        shouldInstall.set(relPath, { install: false, reason: 'up-to-date' });
    }
    const filesToInstall = configuredFiles.filter(relPath => shouldInstall.get(relPath)?.install === true);
    const installedFiles = [];
    for (const relPath of filesToInstall) {
        try {
            const paths = resolveManagedConfigFilePaths(projectDir, agentInstallation.id, relPath);
            await copyFile(paths.sourceFile, paths.targetFile);
            installedFiles.push(relPath);
        }
        catch {
            // Install failure is reported through entries below.
        }
    }
    const installedSet = new Set(installedFiles);
    for (const relPath of configuredFiles) {
        const decision = shouldInstall.get(relPath);
        if (!decision) {
            continue;
        }
        if (decision.install) {
            entries.push({
                configFile: relPath,
                status: installedSet.has(relPath) ? 'changed' : 'skipped',
                reason: installedSet.has(relPath) ? decision.reason : 'install-failed',
            });
            continue;
        }
        entries.push({
            configFile: relPath,
            status: decision.reason === 'up-to-date' ? 'unchanged' : 'skipped',
            reason: decision.reason,
        });
    }
    const syncedFiles = configuredFiles.filter(relPath => {
        if (installedSet.has(relPath)) {
            return true;
        }
        const decision = shouldInstall.get(relPath);
        if (!decision || decision.install) {
            return false;
        }
        return previousInstalledSet.has(relPath);
    });
    return {
        configFiles: configuredFiles,
        installedConfigFiles: syncedFiles,
        entries,
    };
}
export class AgentFileInstallError extends Error {
    installedTargets;
    constructor(message, installedTargets) {
        super(message);
        this.name = 'AgentFileInstallError';
        this.installedTargets = installedTargets;
    }
}
export async function installExtensionAgentFiles(projectDir, agentInstallation, extensionDir, agentFiles) {
    const agentsDir = agentInstallation.agentsDir;
    if (!agentsDir || agentFiles.length === 0) {
        return [];
    }
    const installed = [];
    for (const agentFile of agentFiles) {
        if (agentFile.runtime !== agentInstallation.id) {
            continue;
        }
        try {
            const paths = resolveAgentFilePaths(projectDir, agentsDir, extensionDir, agentFile.source, agentFile.target);
            await copyFile(paths.sourceFile, paths.targetFile);
            installed.push(agentFile.target);
        }
        catch (error) {
            throw new AgentFileInstallError(`Could not install extension agent file "${agentFile.target}" for runtime "${agentInstallation.id}": ${error.message}`, installed);
        }
    }
    return installed;
}
export async function removeExtensionAgentFiles(projectDir, agentInstallation, targets) {
    const agentsDir = agentInstallation.agentsDir;
    if (!agentsDir || targets.length === 0) {
        return [];
    }
    const removed = [];
    const targetRoot = path.join(projectDir, agentsDir);
    for (const relPath of targets) {
        try {
            const targetFile = path.join(targetRoot, relPath);
            ensureTargetWithinRoot(targetRoot, targetFile);
            await removeFile(targetFile);
            removed.push(relPath);
        }
        catch {
            // File may already be absent.
        }
    }
    return removed;
}
//# sourceMappingURL=installer.js.map