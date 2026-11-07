/**
 * Deterministic journal fold for PTC sub-dispatches.
 *
 * `tool/ptc-dispatch-start` is the admission record and
 * `tool/ptc-dispatch` is the terminal receipt.  A restart can therefore
 * distinguish a call that never started from one that started and lost its
 * receipt, without guessing whether an external effect completed.  The fold
 * is deliberately pure so hosts can run it over a restored Session snapshot.
 *
 * @module @deepseek-ai/dsh-tool-executor-ptc/ptc-journal
 */

import type { SessionEvent, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { PtcDispatchEventData, PtcDispatchStartEventData } from './types.ts'

/** One admitted PTC call and its optional terminal receipt. */
export interface PtcJournalEntry {
  readonly start: SessionEvent<'tool/ptc-dispatch-start'>
  readonly settle?: SessionEvent<'tool/ptc-dispatch'>
}

/** Result of folding one PTC journal (optionally narrowed to an outer call). */
export interface PtcJournalFold {
  /** Entries in the exact start/admission order. */
  readonly entries: readonly PtcJournalEntry[]
  /** Calls that were admitted but have no terminal receipt yet. */
  readonly pending: readonly PtcJournalEntry[]
  /** Duplicate, orphaned, or divergent records make replay unsafe. */
  readonly invalid: readonly string[]
  /** True only when every record is paired and identity-consistent. */
  readonly replayable: boolean
  /** Next one-based PTC ordinal after the latest admitted call. */
  readonly nextOrdinal: number
}

function sameIdentity(start: PtcDispatchStartEventData, settle: PtcDispatchEventData): boolean {
  return start.rootCallId === settle.rootCallId
    && start.parentCallId === settle.parentCallId
    && start.subCallId === settle.subCallId
    && start.name === settle.name
    && JSON.stringify(start.arguments) === JSON.stringify(settle.arguments)
}

/**
 * Fold persisted PTC admission/receipt records and report whether replay may
 * safely reattach to the recorded call sequence.
 *
 * @param events - any Session snapshot; unrelated events are ignored.
 * @param parentCallId - optionally restrict to one outer `run_code` call.
 * @returns the ordered journal fold and replay-safety verdict.
 */
export function foldPtcDispatchJournal(
  events: readonly SessionEvent[],
  parentCallId?: ToolCallId,
): PtcJournalFold {
  const entries = new Map<string, PtcJournalEntry>()
  const invalid: string[] = []
  let nextOrdinal = 1
  for (const event of events) {
    if (event.type === 'tool/ptc-dispatch-start') {
      const start = event.data
      if (parentCallId !== undefined && start.parentCallId !== parentCallId) continue
      if (entries.has(start.subCallId)) {
        invalid.push(`duplicate PTC start for ${start.subCallId}`)
        continue
      }
      entries.set(start.subCallId, { start: event })
      const match = /:ptc:(\d+)$/u.exec(String(start.subCallId))
      if (match !== null) nextOrdinal = Math.max(nextOrdinal, Number(match[1]) + 1)
      continue
    }
    if (event.type !== 'tool/ptc-dispatch') continue
    const settle = event.data
    if (parentCallId !== undefined && settle.parentCallId !== parentCallId) continue
    const existing = entries.get(settle.subCallId)
    if (existing === undefined) {
      invalid.push(`orphaned PTC receipt for ${settle.subCallId}`)
      continue
    }
    if (existing.settle !== undefined) {
      invalid.push(`duplicate PTC receipt for ${settle.subCallId}`)
      continue
    }
    if (!sameIdentity(existing.start.data, settle)) {
      invalid.push(`divergent PTC receipt for ${settle.subCallId}`)
      continue
    }
    entries.set(settle.subCallId, { ...existing, settle: event })
  }
  const ordered = [...entries.values()].sort((a, b) => Number(a.start.seq) - Number(b.start.seq))
  const pending = ordered.filter(entry => entry.settle === undefined)
  return Object.freeze({
    entries: Object.freeze(ordered),
    pending: Object.freeze(pending),
    invalid: Object.freeze(invalid),
    replayable: invalid.length === 0 && pending.length === 0,
    nextOrdinal,
  })
}

/** Return the first persisted start sequence for a PTC call.
 * @param entry - one folded PTC journal entry.
 * @returns the Session sequence of its admission record.
 */
export function ptcStartSeq(entry: PtcJournalEntry): SessionSeq {
  return entry.start.seq
}
