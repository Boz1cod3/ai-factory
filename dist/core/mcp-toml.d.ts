import type { McpServerConfig } from './mcp.js';
export declare function removeCodexMcpServersToml(content: string, keys: string[]): string;
export declare function upsertCodexMcpServersToml(content: string, servers: {
    key: string;
    template: McpServerConfig;
}[]): string;
//# sourceMappingURL=mcp-toml.d.ts.map