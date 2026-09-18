import type { AgentInstallation } from './config.js';
import type { ExtensionRecord } from './config.js';
import { type ExtensionManifest } from './extensions.js';
export declare function stripInjection(content: string, extensionName: string, skillName: string, position: string): string;
export declare function applyInjection(skillContent: string, injectionContent: string, position: 'append' | 'prepend', extensionName: string, skillName: string): string;
export declare function applyExtensionInjections(projectDir: string, agent: AgentInstallation, registeredExtensions: ExtensionRecord[]): Promise<number>;
export declare function applySingleExtensionInjections(projectDir: string, agent: AgentInstallation, extensionDir: string, manifest: ExtensionManifest): Promise<number>;
export declare function stripAllExtensionInjections(projectDir: string, agent: AgentInstallation, extensionName: string, manifest: ExtensionManifest): Promise<void>;
export declare function stripInjectionsByExtensionName(projectDir: string, agent: AgentInstallation, extensionName: string): Promise<void>;
//# sourceMappingURL=injections.d.ts.map