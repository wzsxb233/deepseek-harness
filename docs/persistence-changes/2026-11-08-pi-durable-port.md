---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-08-pi-durable-port

English | [中文](2026-11-08-pi-durable-port.zh.md)

## Summary

Port the durable tool-execution record onto master. Five additive changes:
a `tool/body-start` marker separating execution intent from the moment the
tool body runs; an optional `bodyStartTracked` flag on `tool/call` declaring
that separation; an optional `durationMs` on both native (`tool/result`) and
nested (`tool/ptc-dispatch`) receipts; and the durable `task/start` admission
record used by the task graph.

All five are additive log vocabulary. Nothing is renumbered and no existing
event changes meaning.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-08-pi-durable-port
baseline: false
changes:
  - root: "event:document/create"
    previous: null
    after: "2279430ef63283dfe6effc74f7459e7a81819f0325a6ba91654dda79bf522e96"
    decision: same-version
  - root: "event:document/delete"
    previous: null
    after: "cfb56fc34f0f0f4471572b3f5e714fb350cca7fdcad7a9cfe7457d677c7b3c47"
    decision: same-version
  - root: "event:document/update"
    previous: null
    after: "91c39ee3a1b4b61efc59e45e19f4bdd136b0915f07aaefbb0562213d80692dc4"
    decision: same-version
  - root: "event:task/checkpoint"
    previous: null
    after: "013d9bb26f3f9c39d5cfc021ef19b63cc9ae63131ee8130ce4381127a8b40c0b"
    decision: same-version
  - root: "event:task/end"
    previous: null
    after: "4a908639ef777e07942cbda22b872f20baf4ada84dd5dcfc50ae565558df8668"
    decision: same-version
  - root: "event:task/start"
    previous: null
    after: "7c3e4c5dc29f392ce55aa69698ebd67c38f619398d8414019f0cd6dd9f097f75"
    decision: same-version
  - root: "event:tool/body-start"
    previous: null
    after: "d3b5bb801ed7c0fa26047124f0c4fcac6c5dd73e6735253f9a6e14f0b6a6547c"
    decision: same-version
  - root: "event:tool/call"
    previous: "2026-09-11-initial"
    after: "5d5d7ec1468f8a12664ee4a770420cb46966ac6be3fc059cd8d3a0cd46810a98"
    decision: same-version
  - root: "event:tool/ptc-dispatch"
    previous: "2026-10-05-ptc-operation-metadata"
    after: "fb31a9d5414414463b648aaba63b3a34aa95556d88c5dc32909dbb016498a9f8"
    decision: same-version
  - root: "event:tool/result"
    previous: "2026-09-16-session-format-v4"
    after: "65d9cca9d676613404e3aeddde75d16fedae11b4cfc5674a0d8073572c612d06"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Same-version. Every root and property is optional or new, so a reader that
ignores unknown event types continues to work, and a log written before this
change stays readable.

Recovery stays conservative for those older logs: a `tool/call` without
`bodyStartTracked` keeps the `TOOL_OUTCOME_UNKNOWN` classification, because
such a log cannot prove the body never ran. Only a tracked intent without a
matching `tool/body-start` settles as `TOOL_NOT_STARTED`. No session format
version bump is required.

<a id="verification"></a>
## Verification

`pnpm typecheck` 5/5 gates; `vitest` over `dsh-session`, `dsh-agent-loop`,
`dsh-tools`, `dsh-tool-executor-ptc` and `dsh-session-checkpoint-policy`
1593 passed; session snapshots re-recorded and verified (211 passed, 2
skipped).

<a id="dev-note"></a>
## Dev Note

None.
