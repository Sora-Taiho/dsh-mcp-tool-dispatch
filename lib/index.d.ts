import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-mcp-tool-dispatch";
export declare const inject: string[];
interface DispatchConfig {
    directReadonlyTools?: string[];
    toolDefinitionTokenThreshold?: number;
}
export declare const Config: Schema<DispatchConfig>;
export declare function apply(ctx: Context, config?: DispatchConfig): void;
export {};
