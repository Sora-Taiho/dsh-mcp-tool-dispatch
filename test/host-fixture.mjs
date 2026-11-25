import assert from 'node:assert/strict';

export const name = 'dispatch-host-fixture'
export const inject = ['tools', 'llm']
const tool = 'mcp__demo__credit_limit'
export function apply(ctx) {
  let steps = 0
  ctx.tools.register({
    name: tool, description: 'Look up the credit limit for a test customer',
    parameters: { type: 'object', properties: { id: {type:'string', description:'X'.repeat(6400)} }, required: ['id'] },
    output: { schema:{type:'string'}, render:(_args,result)=>[{type:'text',text:result}] },
    async execute(args, exec) {
      assert.ok(exec.parent, 'fixture must run as a DSH nested call')
      return 'LIMIT-123:'+args.id
    },
  })
  ctx.tools.guard(exec => {
    if (exec.name === tool && exec.arguments?.id === 'DENIED') return 'fixture host refusal'
    return undefined
  })
  ctx.on('llm/stream', async function* (request) {
    const visible = request.tools.map(t=>t.name)
    if (process.env.DSH_DISPATCH_SMOKE_MODE === 'direct') {
      assert.ok(visible.includes(tool))
      assert.ok(!visible.includes('tool_search') && !visible.includes('execute_tool'))
      yield {type:'block-start',index:0,blockType:'text'}
      yield {type:'text-delta',index:0,text:'DSH_DIRECT_SMOKE_PASS'}
      yield {type:'block-end',index:0,block:{type:'text',text:'DSH_DIRECT_SMOKE_PASS'}}
      yield {type:'finish',reason:{kind:'stop'}}
      return
    }
    assert.ok(visible.includes('tool_search') && visible.includes('execute_tool'), `missing dispatcher tools: ${visible}`)
    assert.ok(!visible.includes(tool), 'large MCP definition should be folded in the request')
    const messages=JSON.stringify(request.messages)
    const step=++steps
    let call
    if (step === 1) {
      assert.match(messages, /schema_deferred/)
      assert.match(messages, /mcp__demo__credit_limit/)
      assert.doesNotMatch(messages, /X{200}/)
      call={name:'tool_search', args:{query:'select:'+tool}}
    } else if (step === 2) {
      assert.match(messages, /X{200}/)
      call={name:'execute_tool', args:{name:tool, arguments:{id:'DENIED'}}}
    } else if (step === 3) {
      assert.match(messages, /fixture host refusal/)
      assert.doesNotMatch(messages, /LIMIT-123:DENIED/)
      call={name:'execute_tool', args:{name:tool, arguments:{id:'FIXTURE'}}}
    } else {
      assert.equal(step,4)
      assert.match(messages, /LIMIT-123:FIXTURE/)
      yield {type:'block-start',index:0,blockType:'text'}
      yield {type:'text-delta',index:0,text:'DSH_DISPATCH_SMOKE_PASS'}
      yield {type:'block-end',index:0,block:{type:'text',text:'DSH_DISPATCH_SMOKE_PASS'}}
      yield {type:'finish',reason:{kind:'stop'}}
      return
    }
    const id=`fixture_${step}`
    const args=JSON.stringify(call.args)
    yield {type:'block-start',index:0,blockType:'tool-call'}
    yield {type:'tool-call-delta',index:0,id,name:call.name,argumentsDelta:args}
    yield {type:'block-end',index:0,block:{type:'tool-call',id,name:call.name,arguments:args}}
    yield {type:'finish',reason:{kind:'tool-calls'}}
  }, {global:true})
}
