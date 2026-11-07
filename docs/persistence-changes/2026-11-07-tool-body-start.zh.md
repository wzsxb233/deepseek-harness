---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-07-tool-body-start

[English](2026-11-07-tool-body-start.md) | 中文

## 概述

持久化工具执行在策略运行之前就记录执行意图（`tool/call`），因此过去「在策略阶段崩溃」与「在工具体内崩溃」在日志上无法区分。本次改动新增第二个持久标记 `tool/body-start`，在分发工具体之前立即追加，使恢复过程能够区分这两种情况。

该标记只写入日志：不产生投影节点，也不产生模型可见消息。`tool/call` 新增可选字段 `bodyStartTracked: true`，用于声明该日志区分意图与执行体启动；恢复逻辑只对设置了该字段的日志应用新的判定。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

追加式改动，同版本兼容。`tool/body-start` 是新的仅日志事件类型，`bodyStartTracked` 是 `tool/call` 上的可选属性；忽略未知事件类型的读取方保持原有行为。

对既有会话，恢复仍保持保守判定：没有 `bodyStartTracked` 的 `tool/call` 继续归为 `TOOL_OUTCOME_UNKNOWN`，因为旧日志无法证明工具体没有运行。只有带标记的意图缺少对应 body-start 时，才判定为 `TOOL_NOT_STARTED`。无需提升会话格式版本。

<a id="verification"></a>
## 验证

`pnpm typecheck` 通过。单元覆盖：`dsh-session` 的修复/工具调用恢复测试覆盖三种判定（已标记且未启动、已标记且已启动、旧日志无标记）；`dsh-agent-loop` 覆盖标记的写入及其顺序。`dsh-agent-loop` 的调度器失败用例断言：停在策略阶段的调用现在判定为未启动，而 finalize 失败仍保持未知结果。

<a id="dev-note"></a>
## 开发备注

无。
