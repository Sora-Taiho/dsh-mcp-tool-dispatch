import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findPreflightCandidates } from '../lib/preflight.js'

const read = { name: 'read', description: 'Read a local file', parameters: {} }
const tool = {
  name: 'mcp__demo__credit_limit',
  description: '按客户号查询授信额度',
  parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
}

test('a local step does not suppress discovery of a separate MCP step', () => {
  const getTools = () => [tool]
  assert.deepEqual(findPreflightCandidates('读取本地文件', [read], getTools), [])
  assert.equal(findPreflightCandidates('读取本地文件，然后查询客户号 DEMO 的授信额度', [read], getTools)[0].name, tool.name)
})

test('oversized definitions keep an exact-name candidate within the budget', () => {
  const oversized = { ...tool, parameters: { ...tool.parameters, description: 'C'.repeat(6200) } }
  const result = findPreflightCandidates('查询客户号 DEMO 的授信额度', [read], () => [oversized])
  assert.deepEqual(result, [{ name: tool.name, description: tool.description, schema_deferred: true }])
  assert.ok(JSON.stringify(result).length < 6000)
})
