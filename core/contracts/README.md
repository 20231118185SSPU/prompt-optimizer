# Alignment Contract v1

本目录冻结 Prompt Optimizer 的公共机器契约。`core/contracts/` 是契约 SSOT；runtime、shell fallback、adapter 和展示层只能消费，不得改写 route 或 reason 语义。

## 契约族

- `alignment-decision.schema.json`：入站分析结束后的 Alignment Decision。
- `ecosystem-handoff.schema.json`：可选下游生态 handoff envelope；不扩展或改写 Alignment Decision v1。
- `decision-policy.json`：硬门槛数值、route 组合优先级和展示注解配对规则的唯一机器定义。
- `decision-policy.schema.json`：policy 条件表达式的封闭语法；未知操作符必须 fail closed。
- `reason-registry.json`：reason code 的唯一含义、优先级、适用阶段和允许 route。
- `lifecycle.md`：baseline、执行回执、completion verify 与 precipitation 的状态边界。
- `context-taxonomy.md`：项目 facts、glossary、rules、lessons、decisions、state 和 evidence 的职责。

Alignment Decision 只包含 lifecycle plan，禁止包含 baseline 或 completion 的通过/失败结果。Acceptance criteria 是执行前计划；completion evidence 是收到 execution receipt 后的结果，两者必须使用不同类型。

## 最小稳定投影

兼容 consumer 至少读取：

```json
{
  "schemaVersion": "1.0.0",
  "route": "clarify",
  "reasons": ["intent.ambiguous_goal"],
  "next": { "action": "ask" }
}
```

未知 major、route、next action 或 reason code 必须 fail closed，禁止默认 `pass`。未来 minor 可以增加可选字段，但旧 schema 不自动接受新字段；扩展元数据必须进入后续冻结的扩展容器，禁止污染核心对象。

## Route 契约

| Route | 进入条件 | 退出条件 | Next action | 展示档位 |
| --- | --- | --- | --- | --- |
| `pass` | 低风险；用户输入自身完整；observed total ≥8；D5>0；假设≤2 | baseline 通过 | `execute` | A |
| `enrich` | 缺口可由可信项目上下文补齐，或完整请求为 6–7 分并需确定性补强；补齐后满足全部硬门槛 | baseline 通过 | `execute` | B |
| `clarify` | 契约信息缺失；含高风险但信息不足的场景 | 用户回答后重新分析 | `ask`，恰好一个问题和推荐答案 | C |
| `block` | 信息已足够，但授权、政策或 baseline 条件禁止执行 | 确认或条件变化后重新分析，或终止 | `wait_confirmation` / `stop` | C |

只有 `pass` 和 `enrich` 可以产生 execution handoff。`[直出]` 只映射到 `presentation.mode=direct_output` 和 `override.explicit_direct_output`，禁止产生 bypass route。

### B 档展示投影

宿主把 `enrich` 投影给用户时，必须先展示最多 3 行补全回执，再继续执行：

- 每个补全项包含稳定 ID、实际补全内容和 `SourceRef` 来源。
- 最后一行提供 `撤销补全 <ID>` 口令；撤销后重新进入 `analyze -> decide`，禁止沿用旧补全。
- 已产生改动时只先报告影响，未经用户确认不得自动回滚。
- `[直出]` 不得隐藏补全回执，因为它只改变 presentation 偏好，不取消用户对执行契约补全的知情权。

补全回执属于 HostProjection 展示数据，由 Alignment Decision 中带精确 `SourceRef` 的 `receipt-context-*` / `receipt-acceptance` claims 确定性生成，不增加第二套路由语义。用户原文已经声明的验收不算补全项，也不得错误归因给项目上下文。

## 可选生态 handoff

`alignment.ecosystem-handoff` 是 Alignment Decision 之后的独立 envelope。当前只冻结 `matt-pocock-skills`：

- 只有显式请求 ecosystem handoff 时才生成；普通 pipeline 和 `align-cli json` 输出保持不变。
- `pass` / `enrich` 可以映射到已命名 skill；`clarify` / `block` 必须返回 `deferred`，禁止绕过原 route。
- `automatic` 永远为 `false`；envelope 只携带 skill 名和 invocation，禁止复制 skill 正文或自动调用。
- `ready` 表示 skill 与项目 setup 均可用；`setup_required` 表示 skill 已安装但 `docs/agents/issue-tracker.md`、`triage-labels.md`、`domain.md` 未齐全；`unavailable` 表示所选 skill 未发现。
- skill 发现只检查项目或用户 skill 根目录中的 `SKILL.md`，发现到的绝对路径不得进入 handoff。

## Policy 求值

Consumer 必须先用 `decision-policy.schema.json` 验证 policy，再按 `priority` 升序求值 `routePrecedence`；第一个为真的 rule 决定 route 和允许的 next action，后续 rule 禁止覆盖。没有 rule 命中或遇到未知操作符时必须 fail closed。

条件语法：

- `all / any / not`：布尔组合；`all` 要求全部为真，`any` 要求至少一个为真。
- `reason_any`：输入 reasons 至少包含一个指定 code。
- `score_total`：比较 observed/effective total，支持 `lt / gte / between`。
- `minimum_dimension`：比较五维中的最小值，支持 `lt / gte`。
- `assumption_count`：比较 assumption 数量，支持 `gt / lte`。
- `scores_equal / safety_critical`：与指定布尔值相等。
- `always`：终止型 fail-closed fallback。

## Semantic invariants

`decision-policy.json` 是数值门槛和 route 组合优先级的规范定义。JSON Schema 负责结构，consumer 还必须按 policy 检查以下语义：

1. 每套 scores 的 `total = d1 + d2 + d3 + d4 + d5`。
2. `effective.total < 6` 时 route 必须是 `clarify`。
3. effective D5=0 且项目上下文无法补全验收时必须 `clarify`，并包含 `verification.missing`。
4. assumption claim 超过 2 条时必须 `clarify`，并包含 `assumption.too_many`。
5. reason 必须存在于 registry，适用于当前阶段，且 route 位于 `allowedRoutes`；展示型 reason 不独立决定 route。
6. reasons 按 registry `priority`、再按 code 排序；不得重复。
7. inference 的 `basedOn` 必须引用已存在 claim；claim id 必须唯一。
8. `pass` 的 observed 与 effective scores 必须相同；`enrich` 的 applied context 必须能解释分数或验收变化。
9. safety-critical 风险 reason 禁止 `pass`；信息不足时 `clarify`，授权完整后可 `enrich`。`authorization / policy / baseline` 阻断 reason 禁止任何执行 route。
10. completion 结果只允许在登记 execution receipt 后产生。

## Scores 与来源

`observed` 表示只看用户输入的 D1-D5；`effective` 表示加载可信项目上下文后的 D1-D5。这样可以解释 observed D5=0 但项目命令补全验收后 route=`enrich` 的情况。

知识声明采用双轴模型：类型为 `fact / inference / assumption`；每条声明另带 `user / project / runtime / decision / default + ref` 来源。`[原文] / [推断] / [假设]` 仅是兼容展示，不能替代结构化字段。

Registry 的 `safetyCritical=true` 表示该 reason 必须经过安全路由，不等于永久阻断。风险信号与阻断信号必须分开：`risk.*` 在契约完整且授权满足后进入 `enrich`；`authorization.*`、`policy.*` 与失败的 baseline 才产生 block。

## 版本策略

- major：删除字段、改类型、route/action 枚举变化、既有 reason 改义、兼容行为变化。
- minor：新增可选字段或新增 reason；旧 minor fixture 必须继续被当前 reader 接受。
- patch：文档或约束说明修正，不改变机器语义。
- `policyVersion` 与 schema 独立；路由阈值或优先级变化只提升 policy version。

legacy `.align/context.md` 至少兼容一个 minor，只允许在 major 移除；移除前必须有迁移工具、弃用提示和 old-only 升级回归。
