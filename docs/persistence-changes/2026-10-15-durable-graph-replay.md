---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-15-durable-graph-replay

English | [中文](2026-10-15-durable-graph-replay.zh.md)

## Summary

Add the durable task and document graph event vocabulary, and persist codemode replay journal identity and canonical nested values for deterministic reattachment.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-15-durable-graph-replay
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
  - root: "event:tool/ptc-dispatch"
    previous: "2026-10-15-tool-duration"
    after: "828101ffa04e98004e181e19e92514844a8d69c07b55b37d5b11e633885d496a"
    decision: same-version
  - root: "event:tool/ptc-dispatch-start"
    previous: "2026-09-11-initial"
    after: "bdf2821b0b03f74187082295f815f2946074f574a6dcfaa2e941f90fcc261098"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The task and document roots are append-only log records that older readers can ignore as unknown log-only events. The codemode journal additions are optional fields; readers that do not understand them retain existing dispatch content and error fields. No model-visible message shape or Session format version changes, and same-version replay remains safe because replay requires a complete matching fingerprint and journal version.

<a id="verification"></a>
## Verification

Session graph folding, watch and close lifecycle tests, codemode replay and divergence tests, safe recovery rerun tests, the focused core test suites, generated persistence catalogs, build artifacts, aggregate type checks, lint, and documentation gates were run for this change.

<a id="dev-note"></a>
## Dev Note

None.
