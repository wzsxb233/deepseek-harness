/**
 * Pure durable task/document graph fold.
 *
 * The graph is intentionally derived from Session events. It is therefore
 * copied by fork, survives restore, and has no second scheduler or sidecar
 * store. A task may have many checkpoints but exactly one terminal receipt;
 * documents are versioned replacements with an explicit tombstone.
 * @module @deepseek-ai/dsh-session/task-graph
 */

import type { SessionEvent } from './types.ts'

/** One folded durable task. */
export interface DurableTaskRecord {
  readonly taskId: string
  readonly kind: string
  readonly ownerTaskId?: string
  readonly replayPolicy?: 'safe' | 'unsafe'
  readonly input?: unknown
  readonly checkpoints: readonly { readonly seq: number; readonly state: unknown }[]
  readonly end?: {
    readonly seq: number
    readonly status: 'completed' | 'error' | 'aborted' | 'interrupted'
    readonly durationMs?: number
    readonly error?: { name: string; code: string; reason?: string }
  }
}

/** One folded durable document. */
export interface DurableDocumentRecord {
  readonly documentId: string
  readonly kind: string
  readonly version: number
  readonly scope: 'session' | 'task' | 'conversation'
  readonly ownerTaskId?: string
  readonly state: unknown
  readonly deleted: boolean
  readonly seq: number
}

/** Folded task/document graph with validation diagnostics. */
export interface DurableTaskGraph {
  readonly tasks: ReadonlyMap<string, DurableTaskRecord>
  readonly documents: ReadonlyMap<string, DurableDocumentRecord>
  readonly invalid: readonly string[]
}

interface PtcStartData { rootCallId: string; parentCallId: string; subCallId: string; name: string; arguments: unknown }
interface PtcSettleData extends PtcStartData {
  isError: boolean
  content: unknown
  durationMs?: number
  error?: { name: string; code: string; reason?: string }
}

/**
 * Fold task and document records from any Session snapshot.
 * @param events - committed Session events in sequence order.
 * @returns the reconstructed graph and validation diagnostics.
 */
export function foldDurableTaskGraph(
  events: readonly SessionEvent[],
): DurableTaskGraph {
  const tasks = new Map<string, {
    taskId: string
    kind: string
    ownerTaskId: string | undefined
    replayPolicy: 'safe' | 'unsafe' | undefined
    input: unknown
    checkpoints: { seq: number; state: unknown }[]
    end: DurableTaskRecord['end'] | undefined
  }>()
  const documents = new Map<string, DurableDocumentRecord>()
  const invalid: string[] = []
  for (const event of events) {
    switch (event.type) {
      case 'tool/call': {
        if (tasks.has(event.data.callId)) break
        tasks.set(event.data.callId, {
          taskId: event.data.callId,
          kind: 'tool',
          ownerTaskId: undefined,
          replayPolicy: undefined,
          input: { name: event.data.name, arguments: event.data.arguments },
          checkpoints: [], end: undefined,
        })
        break
      }
      case 'tool/result': {
        const taskId = event.data.message.source.callId
        const task = tasks.get(taskId)
        if (task === undefined) { invalid.push(`orphaned tool/result task for ${taskId}`); break }
        if (task.end !== undefined) { invalid.push(`duplicate tool/result task for ${taskId}`); break }
        const errorCode = event.data.error?.code
        task.end = {
          seq: Number(event.seq),
          status: errorCode?.startsWith('ABORTED') ? 'aborted' : event.data.message.isError ? 'error' : 'completed',
          ...event.data.durationMs === undefined ? {} : { durationMs: event.data.durationMs },
          ...event.data.error === undefined ? {} : { error: event.data.error },
        }
        break
      }
      case 'task/start': {
        const data = event.data
        if (tasks.has(data.taskId)) { invalid.push(`duplicate task/start for ${data.taskId}`); break }
        tasks.set(data.taskId, {
          taskId: data.taskId, kind: data.kind, ownerTaskId: data.ownerTaskId,
          replayPolicy: data.replayPolicy, input: data.input, checkpoints: [], end: undefined,
        })
        break
      }
      case 'task/checkpoint': {
        const task = tasks.get(event.data.taskId)
        if (task === undefined) { invalid.push(`orphaned task/checkpoint for ${event.data.taskId}`); break }
        if (task.end !== undefined) { invalid.push(`checkpoint after task/end for ${event.data.taskId}`); break }
        task.checkpoints.push({ seq: Number(event.seq), state: event.data.state })
        break
      }
      case 'task/end': {
        const task = tasks.get(event.data.taskId)
        if (task === undefined) { invalid.push(`orphaned task/end for ${event.data.taskId}`); break }
        if (task.end !== undefined) { invalid.push(`duplicate task/end for ${event.data.taskId}`); break }
        task.end = { seq: Number(event.seq), ...event.data }
        break
      }
      case 'document/create': {
        if (documents.has(event.data.documentId)) { invalid.push(`duplicate document/create for ${event.data.documentId}`); break }
        documents.set(event.data.documentId, { ...event.data, deleted: false, seq: Number(event.seq) })
        break
      }
      case 'document/update': {
        const document = documents.get(event.data.documentId)
        if (document === undefined) { invalid.push(`orphaned document/update for ${event.data.documentId}`); break }
        if (document.deleted) { invalid.push(`document/update after delete for ${event.data.documentId}`); break }
        if (event.data.version < document.version) { invalid.push(`document version regressed for ${event.data.documentId}`); break }
        documents.set(event.data.documentId, { ...document, version: event.data.version, state: event.data.state, seq: Number(event.seq) })
        break
      }
      case 'document/delete': {
        const document = documents.get(event.data.documentId)
        if (document === undefined) { invalid.push(`orphaned document/delete for ${event.data.documentId}`); break }
        if (document.deleted) { invalid.push(`duplicate document/delete for ${event.data.documentId}`); break }
        documents.set(event.data.documentId, { ...document, deleted: true, seq: Number(event.seq) })
        break
      }
      default:
        break
    }
  }
  // PTC records are owned by dsh-tools, which augments SessionEventMap from
  // another package. Fold their structural payloads in a second, dependency-
  // free pass so the session package remains below tools in the graph.
  const rawEvents = events as readonly { type: string; seq: number; data: unknown }[]
  for (const event of rawEvents) {
    if (event.type === 'tool/ptc-dispatch-start') {
      const data = event.data as PtcStartData
      if (tasks.has(data.subCallId)) continue
      tasks.set(data.subCallId, {
        taskId: data.subCallId, kind: 'ptc-tool', ownerTaskId: data.parentCallId,
        replayPolicy: undefined, input: { name: data.name, arguments: data.arguments }, checkpoints: [], end: undefined,
      })
    } else if (event.type === 'tool/ptc-dispatch') {
      const data = event.data as PtcSettleData
      const task = tasks.get(data.subCallId)
      if (task === undefined) { invalid.push(`orphaned PTC task receipt for ${data.subCallId}`); continue }
      if (task.end !== undefined) { invalid.push(`duplicate PTC task receipt for ${data.subCallId}`); continue }
      task.end = {
        seq: event.seq, status: data.isError ? 'error' : 'completed',
        ...data.durationMs === undefined ? {} : { durationMs: data.durationMs },
        ...data.error === undefined ? {} : { error: data.error },
      }
    }
  }
  // PTC start/settle pairs are also the persisted codemode journal. Expose
  // them as task-owned documents even for logs written before document events
  // existed, so restored sessions have one graph shape across versions.
  const journalGroups = new Map<string, { state: unknown[]; seq: number }>()
  for (const event of rawEvents) {
    if (event.type === 'tool/ptc-dispatch-start') {
      const data = event.data as PtcStartData
      const group = journalGroups.get(data.parentCallId) ?? { state: [], seq: event.seq }
      group.state.push({ kind: 'start', subCallId: data.subCallId, name: data.name, arguments: data.arguments })
      group.seq = event.seq
      journalGroups.set(data.parentCallId, group)
    } else if (event.type === 'tool/ptc-dispatch') {
      const data = event.data as PtcSettleData
      const group = journalGroups.get(data.parentCallId) ?? { state: [], seq: event.seq }
      group.state.push({ kind: 'settle', subCallId: data.subCallId, isError: data.isError, content: data.content })
      group.seq = event.seq
      journalGroups.set(data.parentCallId, group)
    }
  }
  for (const [parentTaskId, group] of journalGroups) {
    documents.set(`${parentTaskId}:journal`, {
      documentId: `${parentTaskId}:journal`, kind: 'ptc.journal', version: group.state.length,
      scope: 'task', ownerTaskId: parentTaskId, state: { entries: group.state }, deleted: false, seq: group.seq,
    })
  }
  return Object.freeze({
    tasks: new Map([...tasks].map(([id, task]) => [id, Object.freeze({
      taskId: task.taskId, kind: task.kind,
      ...task.ownerTaskId === undefined ? {} : { ownerTaskId: task.ownerTaskId },
      ...task.replayPolicy === undefined ? {} : { replayPolicy: task.replayPolicy },
      ...task.input === undefined ? {} : { input: task.input },
      checkpoints: Object.freeze([...task.checkpoints]),
      ...task.end === undefined ? {} : { end: task.end },
    })])),
    documents: new Map(documents),
    invalid: Object.freeze(invalid),
  })
}
