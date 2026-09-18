export interface McpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export declare function validateMcpTemplate(template: unknown, key: string): asserts template is McpServerConfig;
export interface McpOptions {
    github: boolean;
    filesystem: boolean;
    postgres: boolean;
    chromeDevtools: boolean;
    playwright: boolean;
}
export declare function configureMcp(projectDir: string, options: McpOptions, agentId?: string): Promise<string[]>;
export declare function getMcpInstructions(servers: string[]): string[];
export declare function configureExtensionMcpServers(projectDir: string, agentId: string, servers: {
    key: string;
    template: McpServerConfig;
}[]): Promise<string[]>;
export declare function removeExtensionMcpServers(projectDir: string, agentId: string, keys: string[]): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map