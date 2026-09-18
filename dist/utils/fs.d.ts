export declare function getSkillsDir(): string;
export declare function getPackagePath(...segments: string[]): string;
export declare function getMcpDir(): string;
export interface CopyDirectoryOptions {
    filter?: (srcPath: string, destPath: string) => boolean;
}
export declare function copyDirectory(src: string, dest: string, options?: CopyDirectoryOptions): Promise<void>;
export declare function copyFile(src: string, dest: string): Promise<void>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function readJsonFile<T>(filePath: string): Promise<T | null>;
export declare function writeJsonFile(filePath: string, data: unknown): Promise<void>;
export declare function readTextFile(filePath: string): Promise<string | null>;
export declare function readFileBuffer(filePath: string): Promise<Buffer | null>;
export declare function listDirectories(dirPath: string): Promise<string[]>;
export declare function writeTextFile(filePath: string, content: string): Promise<void>;
export interface ListFilesOptions {
    skipDirectory?: (absPath: string, name: string) => boolean;
}
export declare function listFilesRecursive(dirPath: string, options?: ListFilesOptions): Promise<string[]>;
export declare function hashDirectory(dirPath: string, options?: ListFilesOptions): Promise<string | null>;
export declare function ensureDir(dirPath: string): Promise<void>;
export declare function removeDirectory(dirPath: string): Promise<void>;
export declare function removeFile(filePath: string): Promise<void>;
//# sourceMappingURL=fs.d.ts.map