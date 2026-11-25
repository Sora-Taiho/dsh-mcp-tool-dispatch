/** 拉丁词按非字母数字切分；CJK 走字符二元分词（无词分词器的语言的标准近似）。 */
export function tokenize(text: any): any[];
/** 工具名的可匹配变体：全名 + 去掉 mcp__<server>__ 前缀的裸名。 */
export function toolNameVariants(name: any): any[];
/**
 * 轻量词干化：只归单复数（s-stemmer，Harman 在 1991 年《How effective is suffixing?》里
 * 提倡的那条轻量路线）。**刻意不做 Porter**——Porter 会砍掉 60+ 种后缀，把
 * references→refer、declared→declar 这类也归掉，实测均名次反而更差（4.87 vs 3.67），
 * 文献也说它 "quite aggressive ... does overstemming"。
 *
 * 为什么值得做：BM25 只做词面匹配，"symbol"（查询常用单数）与 "symbols"（描述常用复数）
 * 会被当成两个词，于是最相关的工具匹配不上。两个真实 MCP 工具集实测
 * （serena 28 工具 / chrome-devtools 32 工具）：serena 核心工具进 top5 从 67% 到 78%、
 * top10 从 94% 到 100%；chrome-devtools 无变化（它的工具名就是查询词，本来就能命中）。
 * 两个数据集上误伤都没有增加——即"有时有效、从不有害"。
 *
 * 不变量：查询侧与文档侧必须用**同一个** stemmer，否则归一半反而更匹配不上。
 */
export function stemToken(token: any): any;
/** 按开关把一组 token 过词干化。开关关闭时原样返回（调用方不必分支）。 */
export function applyStem(tokens: any, enabled: any): any;
/**
 * 构建可检索目录。入参是工具 schema 列表（{ name, description, parameters }），
 * 出参是名字到条目的 Map；重复名后者覆盖（与注册表语义一致）。
 * `stem` 为 true 时名字与文档 token 都过单复数归一。
 */
export function buildCatalog(schemas: any, stem?: boolean): Map<any, any>;
/**
 * 解析查询为内部形态。空查询返回 kind: 'empty'（由调用方决定报错还是回报空）。
 * raw 保留归一化后的原文，供"整条查询恰是工具全名/裸名"的确定性置顶判定。
 */
export function parseQuery(query: any): {
    kind: string;
    raw: string;
    names?: undefined;
    requiredTokens?: undefined;
    terms?: undefined;
} | {
    kind: string;
    names: string[];
    raw: string;
    requiredTokens?: undefined;
    terms?: undefined;
} | {
    kind: string;
    requiredTokens: any[];
    terms: any[];
    raw: string;
    names?: undefined;
} | {
    kind: string;
    terms: any[];
    raw: string;
    names?: undefined;
    requiredTokens?: undefined;
};
/**
 * 在目录上执行一次检索。select 形态按请求顺序原样回报（缺失的也回报，标注 found:false）；
 * 其余形态返回按分数降序的至多 maxResults 条。
 *
 * `stem` 必须与 buildCatalog 时用同一个值：查询侧与文档侧只归一半会比不归更糟
 * （"symbols"归成 "symbol" 而查询还是 "symbols"，照样对不上）。
 */
export function searchCatalog(catalog: any, query: any, maxResults?: number, stem?: boolean): ({
    name: any;
    description: any;
    parameters: any;
    score: number;
    found: boolean;
} | {
    name: string;
    found: boolean;
})[];
