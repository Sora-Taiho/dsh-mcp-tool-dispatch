import type { ToolSchema } from '@deepseek-ai/dsh-llm'
import { applyStem, buildCatalog, searchCatalog, tokenize, toolNameVariants } from './bm25.js'

export const preflightInputLimit = 500
const candidateLimit = 3
const candidateBudget = 6000
const commonTerms = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from',
  'get', 'give', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it', 'me', 'of', 'on', 'or',
  'please', 'return', 'show', 'that', 'the', 'their', 'them', 'then', 'this', 'to', 'use',
  'using', 'was', 'what', 'when', 'which', 'with', 'would', 'you',
  'calculate', 'check', 'compute', 'determine', 'find', 'list', 'lookup', 'query', 'search',
  'result', 'value', 'tool', 'function', 'unit',
  '帮我', '请问', '可以', '一下', '计算', '查找', '查询', '工具', '调用', '执行', '数值', '结果',
])
const externalIntent = /\b(?:mcp|external|remote|connector|hosted|crm|erp)\b|外部|远程|线上(?:系统|服务)|连接器|业务系统/iu
const localReads = /^(?:(?:please\s+)?(?:read|open|view|inspect|summari[sz]e|list|find|search)\s+|(?:请)?(?:帮我)?(?:读取|读一下|打开|查看|总结|列出|查找|搜索)\s*)/iu
const localWrites = /^(?:(?:please\s+)?(?:edit|write|create|modify|update|generate)\s+|(?:请)?(?:帮我)?(?:编辑|写入|新建|修改|生成)\s*)/iu
const explicitTerminal = /^(?:(?:please\s+)?(?:run|execute)\s+(?:a |the )?(?:local command|shell command|bash|python script)|(?:请)?(?:帮我)?(?:执行(?:一条)?(?:本地|终端|shell|bash)命令|运行(?:本地)?脚本))(?:\s*`[^`\r\n]+`)?$/iu
const localTarget = /^(?:(?:the\s+)?(?:(?:local|workspace)\s+)?(?:file|folder|directory|repository|workspace)|(?:本地|工作区)?(?:文件|文档|目录|仓库)|本地|工作区)$/iu
const localQualifier = /^(?:(?:the\s+)?(?:(?:local|workspace)\s+)?(?:file|folder|directory|repository)\s+|(?:the\s+)?(?:local|workspace)\s+|(?:本地|工作区)?(?:文件|文档|目录|仓库)\s*)/iu
const describedLocalSource = /^(?:the\s+)?local\s+([\w-]+(?:\s+[\w-]+){0,3})\s+from\s+(.+)$/iu
const additionalClause = /\b(?:and|or|then|also|to|after|before|while|with|plus)\b/iu
const localPath = /^(?:[.~]?\/[\p{L}\p{N}_./-]+|[\p{L}\p{N}_./-]+\.(?:md|txt|log|csv|json|ya?ml|toml|pdf|docx?|xlsx?|pptx?|png|jpe?g|ts|js|py))$/iu

export type PreflightCandidate = {
  name: string
  description: string
} & ({ arguments_schema: ToolSchema['parameters'] } | { schema_deferred: true })

function terms(text: string): string[] {
  return [...new Set(applyStem(tokenize(text), true) as string[])]
    .filter(token => !commonTerms.has(token) && !/^\d+$/u.test(token))
}

function isLocalTarget(target: string): boolean {
  if (localTarget.test(target)) return true
  const source = describedLocalSource.exec(target)
  if (source && additionalClause.test(source[1])) return false

  const reference = source?.[2] ?? target.replace(localQualifier, '')
  const path = reference.replace(/^(`|"|')(.+)\1$/u, '$2')
  return localPath.test(path)
}

function coveredByResident(query: string, resident: readonly ToolSchema[]): boolean {
  if (externalIntent.test(query)) return false
  const names = new Set(resident.map(tool => tool.name))
  if (names.has(query)) return true

  // Skip only when both the operation and its entire target describe a single local task.
  const request = query.replace(/[.!?。！？]$/u, '').trimEnd()
  if (names.has('bash') && explicitTerminal.test(request)) return true

  const read = localReads.exec(request)
  if (read && ['read', 'read_document', 'read_image', 'glob', 'grep'].some(name => names.has(name))) {
    return isLocalTarget(request.slice(read[0].length))
  }
  const write = localWrites.exec(request)
  return write !== null && ['write', 'edit'].some(name => names.has(name)) &&
    isLocalTarget(request.slice(write[0].length))
}

export function findPreflightCandidates(
  query: string,
  resident: readonly ToolSchema[],
  external: () => ToolSchema[],
): PreflightCandidate[] {
  const keywords = terms(query.slice(0, preflightInputLimit))
  if (keywords.length === 0 || (query.length <= preflightInputLimit && coveredByResident(query.trim(), resident))) return []

  const requested = new Set(keywords)
  const eligible = external().filter(tool => {
    const bareName = toolNameVariants(tool.name).at(-1) ?? tool.name
    if (terms(bareName).some(word => requested.has(word))) return true
    return terms(tool.description).filter(word => requested.has(word)).length >= 2
  })
  if (eligible.length === 0) return []

  const matches = searchCatalog(buildCatalog(eligible, true), keywords.join(' '), candidateLimit, true)
  // Reserve space for names and summaries first so a large schema cannot displace another match.
  const shortlist: Array<{ summary: PreflightCandidate, size: number, parameters: ToolSchema['parameters'] }> = []
  let remaining = candidateBudget - 2 // JSON array brackets.
  for (const match of matches) {
    const tool = eligible.find(entry => entry.name === match.name)
    if (!tool) continue
    const summary: PreflightCandidate = {
      name: tool.name,
      description: tool.description.replace(/\s+/gu, ' ').slice(0, 240),
      schema_deferred: true,
    }
    const size = JSON.stringify(summary).length
    const cost = size + (shortlist.length > 0 ? 1 : 0)
    if (cost > remaining) continue
    shortlist.push({ summary, size, parameters: tool.parameters })
    remaining -= cost
  }
  return shortlist.map(({ summary, size, parameters }) => {
    const { name, description } = summary
    const candidate = { name, description, arguments_schema: parameters }
    const extra = JSON.stringify(candidate).length - size
    if (extra > remaining) return summary
    remaining -= extra
    return candidate
  })
}
