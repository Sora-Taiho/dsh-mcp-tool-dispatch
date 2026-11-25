import type { ToolSchema } from '@deepseek-ai/dsh-llm';
export declare const preflightInputLimit = 500;
export type PreflightCandidate = {
    name: string;
    description: string;
} & ({
    arguments_schema: ToolSchema['parameters'];
} | {
    schema_deferred: true;
});
export declare function findPreflightCandidates(query: string, resident: readonly ToolSchema[], external: () => ToolSchema[]): PreflightCandidate[];
