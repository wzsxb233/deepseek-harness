---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-15-tool-duration

English | [中文](2026-10-15-tool-duration.zh.md)

## Summary

Record monotonic execution duration for completed native and PTC tool receipts when the tool body actually ran.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-15-tool-duration
baseline: false
changes:
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

This adds optional metadata only. Existing readers may omit the field, and calls denied or skipped before dispatch continue to omit it. Session message projection and model-visible content are unchanged, so the current format remains compatible without a version bump.

<a id="verification"></a>
## Verification

Focused agent-loop and tools tests cover body-start versus skipped calls, PTC receipts, nested results, and restored journal folding. Full build, type, persistence, and documentation gates are run after the generated acknowledgement is written.

<a id="dev-note"></a>
## Dev Note

None.
