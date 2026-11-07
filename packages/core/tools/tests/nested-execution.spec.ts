import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  return ctx
}

const signal = () => new AbortController().signal

describe('nested tool execution', () => {
  it('runs a child that admits tools and returns it under a child task id', async () => {
    const ctx = await setup()
    ctx.tools.register({
      name: 'child', description: 'child', parameters: {},
      callers: ['tools'],
      output: { schema: { type: 'string' }, render: () => [] },
      execute: async () => 'child-value',
    })
    let seenTaskId: string | undefined
    ctx.tools.register({
      name: 'parent', description: 'parent', parameters: {},
      output: { schema: { type: 'boolean' }, render: () => [] },
      execute: async (_args, exec) => {
        const child = await exec.executeTool?.('child', {})
        seenTaskId = child?.taskId
        return child?.isError === false
      },
    })

    const result = await executeToolFixture(ctx, {
      callId: ToolCallId('parent-1'), name: 'parent', arguments: {}, signal: signal(),
    })
    expect(result).toMatchObject({ isError: false, value: true })
    expect(seenTaskId).toBe('parent-1:nested:1')
  })

  it('rejects a child that does not admit the tools caller', async () => {
    const ctx = await setup()
    ctx.tools.register({
      name: 'model-only', description: 'model only', parameters: {},
      callers: ['model'],
      output: { schema: { type: 'string' }, render: () => [] },
      execute: async () => 'should not run',
    })
    ctx.tools.register({
      name: 'parent', description: 'parent', parameters: {},
      output: { schema: { type: 'boolean' }, render: () => [] },
      execute: async (_args, exec) => {
        const child = await exec.executeTool?.('model-only', {})
        return child?.isError === false
      },
    })

    const result = await executeToolFixture(ctx, {
      callId: ToolCallId('parent-2'), name: 'parent', arguments: {}, signal: signal(),
    })
    expect(result).toMatchObject({ isError: false, value: false })
  })

  it('aborts a child the parent never awaited before the parent settles', async () => {
    const ctx = await setup()
    let childAborted = false
    ctx.tools.register({
      name: 'slow-child', description: 'slow', parameters: {},
      callers: ['tools'],
      output: { schema: { type: 'null' }, render: () => [] },
      execute: async (_args, exec) => {
        await new Promise<void>((resolve) => {
          if (exec.signal.aborted) { childAborted = true; resolve(); return }
          exec.signal.addEventListener('abort', () => { childAborted = true; resolve() }, { once: true })
        })
        return null
      },
    })
    ctx.tools.register({
      name: 'parent', description: 'parent', parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: async (_args, exec) => {
        // Deliberately unawaited: the parent must not settle before it drains.
        void exec.executeTool?.('slow-child', {})
        return null
      },
    })

    const result = await executeToolFixture(ctx, {
      callId: ToolCallId('parent-3'), name: 'parent', arguments: {}, signal: signal(),
    })
    expect(result.isError).toBe(false)
    expect(childAborted).toBe(true)
  })
})
