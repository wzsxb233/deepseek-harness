import { describe, expect, it } from 'vitest'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { foldPtcDispatchJournal, ptcStartSeq } from '@deepseek-ai/dsh-tools'

function journalSession() {
  const session = Session.create(SessionId('ptc-journal'))
  const parent = ToolCallId('run-1')
  session.append('tool/ptc-dispatch-start', {
    rootCallId: parent, parentCallId: parent, subCallId: ToolCallId('run-1:ptc:1'),
    name: 'read', arguments: { path: 'a.txt' },
  })
  session.append('tool/ptc-dispatch', {
    rootCallId: parent, parentCallId: parent, subCallId: ToolCallId('run-1:ptc:1'),
    name: 'read', arguments: { path: 'a.txt' }, isError: false,
    content: [{ type: 'text', text: 'a' }], durationMs: 3,
  })
  session.append('tool/ptc-dispatch-start', {
    rootCallId: parent, parentCallId: parent, subCallId: ToolCallId('run-1:ptc:2'),
    name: 'write', arguments: { path: 'b.txt' },
  })
  return session
}

describe('foldPtcDispatchJournal', () => {
  it('pairs receipts in admission order and reports an unfinished call', () => {
    const result = foldPtcDispatchJournal(journalSession().snapshotEvents(), ToolCallId('run-1'))
    expect(result.entries).toHaveLength(2)
    expect(result.pending.map(entry => entry.start.data.name)).toEqual(['write'])
    expect(result.replayable).toBe(false)
    expect(result.nextOrdinal).toBe(3)
    expect(ptcStartSeq(result.entries[0]!)).toBe(0)
  })

  it('rejects orphan, duplicate, and divergent receipts instead of replaying them', () => {
    const session = journalSession()
    session.append('tool/ptc-dispatch', {
      rootCallId: ToolCallId('run-1'), parentCallId: ToolCallId('run-1'), subCallId: ToolCallId('run-1:ptc:9'),
      name: 'ghost', arguments: {}, isError: true, content: [{ type: 'text', text: 'x' }],
    })
    const result = foldPtcDispatchJournal(session.snapshotEvents())
    expect(result.invalid).toEqual(['orphaned PTC receipt for run-1:ptc:9'])
    expect(result.replayable).toBe(false)
  })
})
