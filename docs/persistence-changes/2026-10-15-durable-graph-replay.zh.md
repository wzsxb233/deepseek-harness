---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-15-durable-graph-replay

[English](2026-10-15-durable-graph-replay.md) | 中文

## 概述

新增持久化 task/document graph 事件词汇，并为确定性 codemode 重挂载持久化重放日志标识与嵌套调用的规范值。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

task 和 document 根是仅追加日志记录，旧读取器可以忽略未知的仅日志事件。codemode 日志新增字段均为可选；不了解这些字段的读取器仍可使用原有 dispatch 内容和错误字段。模型可见消息形状与 Session 格式版本不变；只有在 fingerprint 和日志版本完整匹配时才执行同版本重放，因此保持安全。

<a id="verification"></a>
## 验证

本次更改已运行 Session graph 折叠、watch 与 close 生命周期测试、codemode 重放与分歧测试、安全恢复自动重跑测试、核心定向测试套件、生成的持久化目录、构建产物、聚合类型检查、lint 以及文档门禁。

<a id="dev-note"></a>
## 开发备注

无。
