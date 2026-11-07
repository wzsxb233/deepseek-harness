import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { DurableToolTask } from '../src/durable-task.ts'

describe('DurableToolTask', () => {
  it('commits intent before the terminal receipt and rejects a second settlement', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('durable-tool-task'))
    const task = new DurableToolTask(session, 1, 2, {
      type: 'tool-call',
      id: ToolCallId('call-1'),
      name: 'write',
      arguments: '{}',
    })

    expect(task.status).toBe('pending')
    const intentSeq = task.recordIntent()
    expect(task.status).toBe('intent-recorded')
    expect(task.intentSeq).toBe(intentSeq)
    expect(session.snapshotEvents().map(event => event.type)).toEqual(['tool/call'])
    // The intent declares that intent and body start are separate records, which
    // is what lets recovery treat a missing body-start as provably not run.
    expect(session.snapshotEvents()[0]?.data).toMatchObject({ bodyStartTracked: true })

    task.settle({ content: [{ type: 'text', text: 'ok' }], isError: false, value: { ok: true } })
    expect(task.status).toBe('settled')
    expect(session.snapshotEvents().map(event => event.type)).toEqual(['tool/call', 'tool/result'])
    expect(session.snapshotEvents()[1]?.sourceEventSeqs).toEqual([intentSeq])
    expect(() => { task.settle({ content: [], isError: true, error: { message: 'late' } }) }).toThrow('cannot settle from settled')
  })

  it('refuses a terminal receipt before intent is durable', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('durable-tool-task-order'))
    const task = new DurableToolTask(session, 1, 1, {
      type: 'tool-call',
      id: ToolCallId('call-2'),
      name: 'read',
      arguments: '{}',
    })

    expect(() => { task.settle({ content: [], isError: false, value: null }) }).toThrow('cannot settle from pending')
    expect(session.snapshotEvents()).toEqual([])
  })

  it('records monotonic duration only after the body starts', () => {
    const session = Session.create(SessionId('durable-tool-task-duration'))
    const task = new DurableToolTask(session, 1, 1, {
      type: 'tool-call', id: ToolCallId('call-duration'), name: 'read', arguments: '{}',
    })
    task.recordIntent()
    task.settle({ content: [], isError: true, error: { message: 'skipped' } })
    const skipped = session.snapshotEvents()[1]
    expect(skipped?.type === 'tool/result' ? skipped.data : undefined).not.toHaveProperty('durationMs')

    const started = new DurableToolTask(session, 1, 2, {
      type: 'tool-call', id: ToolCallId('call-duration-2'), name: 'read', arguments: '{}',
    })
    started.recordIntent()
    const bodyStartSeq = started.markBodyStarted()
    started.settle({ content: [], isError: false, value: null })
    const bodyStart = session.snapshotEvents()[3]
    expect(bodyStart?.type).toBe('tool/body-start')
    expect(bodyStart?.seq).toBe(bodyStartSeq)
    expect(bodyStart?.data).toMatchObject({ turn: 1, step: 2, callId: 'call-duration-2' })
    const settled = session.snapshotEvents()[4]
    const duration = settled?.type === 'tool/result' ? settled.data.durationMs : undefined
    expect(duration).toEqual(expect.any(Number))
    expect(duration).toBeGreaterThanOrEqual(0)
  })
})
