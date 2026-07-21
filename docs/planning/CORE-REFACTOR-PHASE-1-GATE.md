# 核心重构第一阶段完成门槛

> 状态：已确认的阶段门槛草案
> 日期：2026-07-20
> 目标：把优化结果收敛为可独立交接的最小充分契约，并为宿主接入提供真实、只读的可行性报告。

## 阶段边界

本阶段实现一个 canonical core interface：

```text
用户请求
  -> 结构化任务路由
  -> 相关 .align/ 证据
  -> Alignment Brief schema
  -> Execution Brief + 可选 Trace Appendix
```

包含：

- 五类任务族：`change`、`inspect`、`design`、`produce`、`operate`。
- 两层路由：模型选择语义模块，机器层校验 schema、权限、安全和最终 route/action。
- Full/Degraded 能力分层，默认不发起后台额外模型调用。
- 只解析 `.align/` 的相关证据；源码和其他文档按任务需要读取。
- 自包含 Markdown Brief、可选 handoff 文件和敏感信息脱敏。
- 只读宿主/项目可行性探测；阻塞时不得写入配置。

不包含：

- 自动修改或弱化项目规则。
- 默认 hook 接线、wrapper/proxy 或完整会话持久化适配。
- 删除旧入口、删除旧文件或迁移已安装用户。
- 正式模型效果 benchmark；真实使用对比在本阶段门槛通过后进行。

## 完成指标

### P1-01：唯一核心 interface

- 所有显式入口和兼容别名都调用同一个核心实现。
- route/action、任务模块选择和降级逻辑不得在 Adapter 中重复实现。
- 通过 interface 的集成测试能覆盖显式入口和至少一个宿主投影。

### P1-02：结构化任务路由

- 输出包含一个 `primary`、最多两个 `secondary`、模块依据、置信度和 `missing`。
- 五个任务族各有至少两个固定 fixture；未知任务进入最小契约。
- 缺失字段、未知模块、超过模块上限或非法 schema 必须 fail closed。

### P1-03：Brief 质量门

- 可执行 Brief 必须包含：目标、相关上下文、对象/范围、交付物、约束、验收和必要执行方式。
- 简单任务的 Execution Brief 不得超过 40 个非空 Markdown 行；复杂任务不得超过 100 行。Trace Appendix 不计入该限制。
- Brief 不得含未解析占位符、隐藏上下文引用、内部关键词命中日志或秘密值。
- 在移除原会话和 `.align/` 后，独立 Agent 仍能仅凭 Brief 理解任务和验收。

### P1-04：上下文证据门

- 核心优化阶段只读取 `.align/`；不得整库扫描或整体拼接分类文件。
- 每条采用的证据必须有 source/ref、适用字段和新鲜度状态。
- 默认最多注入 8 条证据、6000 个字符；超过预算、来源冲突或状态过期必须降级或澄清。
- 用户目标/方向优先；项目硬规则、安全和权限冲突不得静默覆盖。

### P1-05：Full/Degraded 失败关闭

- 模型不可用、超时、格式错误或语义冲突时，结果明确标记 `degraded`。
- 低风险任务可生成最小契约；高风险、方向不明或授权不足必须 `clarify`/`block`。
- 任何失败路径都不得隐式调用第二个模型或继续执行高风险操作。

### P1-06：交接与隐私

- Markdown Brief 是唯一用户可见主产物；Trace 为可选附录。
- 可选 handoff 文件带 schema 版本和摘要哈希，且不依赖当前会话状态。
- 自动检查拒绝 token、密码、`.env` 值和不必要的个人数据；只允许引用变量名、类型或受控位置。

### P1-07：宿主可行性探测

- 只读探测至少报告：宿主/版本、配置位置、prompt ingress、机械阻断、completion/session 能力、权限/策略冲突、依赖和降级路径。
- 探测结果区分 `supported`、`available`、`blocked`、`unknown`，不得仅按宿主名称宣称能力。
- 模拟接线失败时，配置文件、项目规则和已有 hook 的字节级 diff 必须为零。

### P1-08：工程验证

- 新增单元/集成/失败关闭测试覆盖 P1-01 至 P1-07。
- `core/host/pipeline` 的 build 与 test 通过。
- `bash -n build/build.sh`、相关 shell/PowerShell 语法检查通过。
- 连续两次 build 产物无额外 diff；所有 `dist/` 变更来自 build。
- 交付前运行 `.align/check-commands.txt` 中与本阶段相关的命令，并报告未运行项。

## 阶段出口

只有 P1-01 至 P1-08 全部满足，才能进入第二阶段（安装事务、hook/session adapter 和迁移清理）。通过后再由用户在真实项目中比较首次成功率、返工次数和使用成本；这些结果不回填为本阶段的既有证据。
