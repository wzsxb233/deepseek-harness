import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { RUN_CODE_NAME } from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  return ctx
}

function register(ctx: Context, name: string, description: string, callers?: readonly ('model' | 'tools')[]) {
  ctx.tools.register({
    name, description, parameters: {},
    ...callers === undefined ? {} : { callers },
    output: { schema: { type: 'null' }, render: () => [] },
    execute: async () => null,
  })
}

describe('registry discovery', () => {
  it('splits the visible catalog by caller class', async () => {
    const ctx = await setup()
    register(ctx, 'rebuild_index', 'Recompute the search index from scratch.')
    register(ctx, 'internal_probe', 'Probe used only by composite tools.', ['tools'])

    expect(ctx.tools.schemas().map(tool => tool.name)).toContain('rebuild_index')
    expect(ctx.tools.schemas().map(tool => tool.name)).not.toContain('internal_probe')
    // A nested caller sees both admitted classes.
    expect(ctx.tools.schemasForCaller('tools').map(tool => tool.name))
      .toEqual(expect.arrayContaining(['rebuild_index', 'internal_probe']))
  })

  it('ranks the visible catalog without ever offering the program transport', async () => {
    const ctx = await setup()
    register(ctx, 'rebuild_index', 'Recompute the search index from scratch.')
    register(ctx, 'read_file', 'Read a source file from disk.')

    const ranked = ctx.tools.searchTools('rebuild index', undefined, 2).map(tool => tool.name)
    expect(ranked[0]).toBe('rebuild_index')
    expect(ctx.tools.searchTools('', undefined, 10).map(tool => tool.name)).not.toContain(RUN_CODE_NAME)
    expect(ctx.tools.searchTools('read', undefined, 0)).toEqual([])
  })
})
