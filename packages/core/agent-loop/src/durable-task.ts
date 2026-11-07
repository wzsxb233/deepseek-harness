/**
 * Session-backed lifecycle for one model-requested tool task.
 *
 * The task records execution intent before any policy or tool body can run and
 * accepts exactly one terminal result. A process loss between those commits is
 * intentionally left as an unanswered `tool/call`; Session recovery converts
 * it into the existing unknown-outcome result instead of guessing whether an
 * external effect completed.
 *
 * @module dsh-agent-loop/durable-task
 */

import { createToolResultMessage, type ToolCallBlock } from '@deepseek-ai/dsh-llm'
import type { Session, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ToolExecutionResult, ToolReplayPolicy } from '@deepseek-ai/dsh-tools'

/** Lifecycle states for one durable tool task. */
export type DurableToolTaskStatus = 'pending' | 'intent-recorded' | 'settled'

/**
 * Owns the durable intent and terminal receipt for one tool call.
 *
 * The class deliberately does not retry an interrupted task. The call/result
 * pair is the authoritative evidence used by Session recovery, and retry
 * policy belongs to the tool's semantics and the next model step.
 */
export class DurableToolTask {
  private state: DurableToolTaskStatus = 'pending'
  private callSeq: SessionSeq | undefined
  private bodyStartSequence: SessionSeq | undefined
  private bodyStartedAt: number | undefined

  /**
   * @param session - Session that owns the call/result pair.
   * @param turn - turn containing the model step.
   * @param step - model step containing the call.
   * @param block - model-produced call identity and raw arguments.
   * @param replayPolicy - recovery policy for an interrupted call.
   */
  constructor(
    private readonly session: Session,
    private readonly turn: number,
    private readonly step: number,
    private readonly block: ToolCallBlock,
    readonly replayPolicy: ToolReplayPolicy = 'unsafe',
  ) {}

  /** Current lifecycle state. */
  get status(): DurableToolTaskStatus { return this.state }

  /** Sequence of the committed execution intent, once recorded. */
  get intentSeq(): SessionSeq | undefined { return this.callSeq }

  /** Sequence of the committed body-start marker, once recorded. */
  get bodyStartSeq(): SessionSeq | undefined { return this.bodyStartSequence }

  /**
   * Mark the point at which the registry is about to invoke the tool body.
   * The marker is committed before the body runs, so recovery can tell a call
   * that never started (policy, approval, a crash during policy) from one whose
   * body may already have produced an external effect.
   * @returns the sequence of the committed body-start marker.
   */
  markBodyStarted(): SessionSeq {
    if (this.state !== 'intent-recorded' || this.bodyStartedAt !== undefined) {
      throw new Error(`durable tool task "${this.block.id}" body cannot start from ${this.state}`)
    }
    const event = this.session.append('tool/body-start', {
      turn: this.turn,
      step: this.step,
      callId: this.block.id,
    })
    this.bodyStartSequence = event.seq
    this.bodyStartedAt = performance.now()
    return event.seq
  }

  /** Commit the execution intent before any tool policy or body runs. */
  recordIntent(): SessionSeq {
    if (this.state !== 'pending') {
      throw new Error(`durable tool task "${this.block.id}" intent is already ${this.state}`)
    }
    const event = this.session.append('tool/call', {
      turn: this.turn,
      step: this.step,
      callId: this.block.id,
      name: this.block.name,
      arguments: this.block.arguments,
      // Declares that intent and body start are separate records, so recovery
      // may classify an intent without a body-start as provably not run.
      bodyStartTracked: true,
    })
    this.callSeq = event.seq
    this.state = 'intent-recorded'
    return event.seq
  }

  /** Commit the single model-facing terminal receipt for this task. */
  settle(result: ToolExecutionResult): void {
    if (this.state !== 'intent-recorded' || this.callSeq === undefined) {
      throw new Error(`durable tool task "${this.block.id}" cannot settle from ${this.state}`)
    }
    const message = createToolResultMessage({
      callId: this.block.id,
      content: result.content,
      isError: result.isError,
    })
    this.session.append('tool/result', {
      turn: this.turn,
      step: this.step,
      message,
      ...result.error?.info ? { error: result.error.info } : {},
      // The tool's private presentation payload is part of the durable receipt.
      ...result.meta !== undefined ? { meta: result.meta } : {},
      // Calls denied or skipped before the body has no execution duration.
      ...this.bodyStartedAt === undefined ? {} : { durationMs: Math.max(0, performance.now() - this.bodyStartedAt) },
    }, { surfaceOp: 'append', sourceEventSeqs: [this.callSeq] })
    this.state = 'settled'
  }
}
