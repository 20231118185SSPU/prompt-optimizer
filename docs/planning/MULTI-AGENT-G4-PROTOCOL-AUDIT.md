# G4 协议内容审计

> 范围：`core/protocol/00-positioning.md` 至 `07-precipitation.md`、常驻 optimize-prompt 入口和生成 references。
> 目标：审计 duplication、no-op、sediment、sprawl，并记录处置，不在 G4 顺手改写协议语义。

## 结论

| 类型 | 发现 | 处置 |
| --- | --- | --- |
| Duplication | 旧生成 skill 把 00-07 全量嵌入 Claude、Codex 和 Cursor 常驻入口 | 已移除；常驻入口只保留路由与硬门，完整规则按 branch 生成一次 |
| Duplication | 常驻入口仍摘要保留 route、`D5=0`、总分 `<6`、`[假设]>2`、`[直出]` 和验证门 | 保留。这些是选择 branch 前必须可见的安全索引，不创建独立规则编号；权威语义仍在 protocol reference |
| No-op | 简单 `pass` 曾被迫加载对当前任务无作用的转换、验证和沉淀全文 | 已消除；入口明确禁止简单任务加载完整协议和全部模板 |
| Sediment | `ALIGN-CONTEXT.md` 仍把 legacy context 描述为手工维护事实源 | 已改为只读兼容投影；facts/glossary/state 是分类 SSOT |
| Sprawl | 8 个协议文件散布在一个 60KB 常驻产物中，无法按意图选择 | 已拆为 intent、routing、contract、verification、precipitation 五个 branch，每个包含 `When to read` 和 required outcome |

## SSOT 映射

- 定位、意图探查、诊断：`protocol-intent.md`，源文件 00-02 各出现一次。
- 路由：`protocol-routing.md`，源文件 03 出现一次。
- 转换与契约回验：`protocol-contract.md`，源文件 04-05 各出现一次。
- 生命周期验证：`protocol-verification.md`，源文件 06 出现一次。
- 沉淀：`protocol-precipitation.md`，源文件 07 出现一次。

`tests/verify-context-economy.sh` 自动验证源文件唯一映射、四类分发目录的 branch 完整性、常驻入口预算和 hard gate 指针。

## 范围决策

- Claude Code、Codex 和 Cursor 是常驻入口，必须满足相对基线至少下降 50%。
- `dist/universal/SYSTEM-PROMPT.md` 是无文件加载能力宿主使用的 L0 单文件复制产物，不是 resident skill；为保持可复制兼容性继续自包含完整协议，并由生成标记和 G4 测试固定该豁免。
