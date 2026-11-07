---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-07-tool-body-start

English | [中文](2026-11-07-tool-body-start.zh.md)

## Summary

Durable tool execution records the execution intent (`tool/call`) before any
policy runs, which means a crash during policy used to look identical to a crash
inside the tool body. This change adds a second durable marker,
`tool/body-start`, appended immediately before the body is dispatched, so
recovery can tell the two apart.

The marker is log-only: it creates no surface node and no model-visible message.
`tool/call` gains an optional `bodyStartTracked: true` flag that declares the
journal separates intent from body start; recovery only applies the new
classification to a log that sets it.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-07-tool-body-start
baseline: false
changes:
  - root: "event:tool/body-start"
    previous: null
    after: "d3b5bb801ed7c0fa26047124f0c4fcac6c5dd73e6735253f9a6e14f0b6a6547c"
    decision: same-version
  - root: "event:tool/call"
    previous: "2026-09-11-initial"
    after: "5d5d7ec1468f8a12664ee4a770420cb46966ac6be3fc059cd8d3a0cd46810a98"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Additive and same-version. `tool/body-start` is a new log-only event type, and
`bodyStartTracked` is an optional property on `tool/call`; readers that ignore
unknown event types keep working unchanged.

Recovery stays conservative for existing sessions: a `tool/call` without
`bodyStartTracked` keeps the `TOOL_OUTCOME_UNKNOWN` classification, because a
legacy log cannot prove the body never ran. Only a tracked intent with no
matching body-start settles as `TOOL_NOT_STARTED`. No session format version
bump is required.

<a id="verification"></a>
## Verification

`pnpm typecheck` passes. Unit coverage: `dsh-session` repair/tool-call recovery
covers the three classifications (tracked and not started, tracked and started,
legacy and unmarked); `dsh-agent-loop` covers the committed marker and its
ordering. `dsh-agent-loop` scheduler-failure cases assert that a call stopped in
policy now settles as not started while a finalize failure stays unknown.

<a id="dev-note"></a>
## Dev Note

None.
