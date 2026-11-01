---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-15-tool-duration

[English](2026-10-15-tool-duration.md) | 中文

## 概述

在工具主体实际运行时，为原生和 PTC 工具收据记录单调时钟执行耗时。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

这只增加可选元数据。旧读者可以省略该字段，被拒绝或在分发前跳过的调用仍不记录耗时。Session 消息投影和模型可见内容不变，因此无需升级格式版本即可兼容。

<a id="verification"></a>
## 验证

定向 agent-loop 与 tools 测试覆盖主体启动与跳过调用、PTC 收据、嵌套结果和恢复后的日志折叠。写入生成的确认记录后再运行完整构建、类型、持久化和文档门禁。

<a id="dev-note"></a>
## 开发备注

无。
