---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-08-pi-durable-port

[English](2026-11-08-pi-durable-port.md) | 中文

## 概述

把持久化工具执行记录移植到 master。共五项增量：`tool/body-start` 标记，用于区分执行意图与工具体真正开始运行的时刻；`tool/call` 上可选的 `bodyStartTracked` 字段，声明日志具备这种区分能力；原生回执（`tool/result`）与嵌套回执（`tool/ptc-dispatch`）上可选的 `durationMs`；以及任务图使用的持久化 `task/start` 受理记录。

五项都是追加式日志词汇，不重编号，也不改变任何既有事件的含义。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

同版本兼容。所有根与属性要么是可选的、要么是新增的，忽略未知事件类型的读取方继续工作，本次改动之前写入的日志仍可读取。

对旧日志，恢复保持保守判定：没有 `bodyStartTracked` 的 `tool/call` 继续归为 `TOOL_OUTCOME_UNKNOWN`，因为这类日志无法证明工具体没有运行。只有带标记的意图缺少对应 `tool/body-start` 时，才判定为 `TOOL_NOT_STARTED`。无需提升会话格式版本。

<a id="verification"></a>
## 验证

`pnpm typecheck` 5/5 门禁通过；`vitest` 覆盖 `dsh-session`、`dsh-agent-loop`、`dsh-tools`、`dsh-tool-executor-ptc` 与 `dsh-session-checkpoint-policy` 共 1593 项通过；会话快照已重录并校验（211 通过、2 跳过）。

<a id="dev-note"></a>
## 开发备注

无。
