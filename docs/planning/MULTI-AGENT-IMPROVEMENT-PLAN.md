# Prompt Optimizer 主代理 + 子代理完整改进规划

> 状态：建议稿，供用户确认后执行。
> 依据：本地代码审计、现有协议与测试、[生态对比调研](../reference/ECOSYSTEM-COMPARISON.md)。
> 核心策略：先冻结公共契约，再并行实现；先证明核心价值，再扩展生态能力。

## 1. Agent Brief

### 1.1 目标

把 Prompt Optimizer 从“方法论完整、运行时局部实现的意图对齐项目”，升级为一个可分发、可组合、可机器验证的 **Agent 意图入口层 / Alignment Runtime**。

本轮改进必须优先解决：

1. 协议与运行时语义不一致。
2. TypeScript 管线尚未真正进入构建和安装交付链路。
3. 验证门时序与协议不一致。
4. 缺少稳定、机器可读的 Alignment Decision 契约。
5. 现有 benchmark 主要是规则推演，缺少真实模型和宿主证据。
6. 生成 skill 过长，渐进披露不足。
7. 跨宿主“支持”缺少可检查的能力等级定义。

### 1.2 信息来源与置信度

- [原文] 用户要开启“主代理 + 子代理”组合进行全面改进。
- [原文] 项目定位是 Agent 意图对齐器，不是 prompt 文案润色器。
- [原文] 必须保留意图探查、五维诊断、三档路由、契约回验、验证门和沉淀门等强规则。
- [推断] 本轮首先应完成 P0 核心闭环，再决定是否进入 OpenSpec、Superpowers、ECC、Matt Pocock Skills 的生态集成。
- [推断] 当前本地 `main` 比 `origin/main` 领先 18 个提交，执行前必须先建立可信基线，不能直接在公共主干上让多个代理并发修改。

无高风险静默假设。本计划不自动决定版本号、发布时间、是否推送远端或是否发布 GitHub release；这些动作必须由用户确认。

### 1.3 背景

当前项目已经具备：

- `core/protocol/00-07` 协议内核。
- Agent Brief、验收、澄清和 `.align/` 模板。
- Claude Code / Codex / Cursor / universal 构建产物。
- shell hook 路由和 `.align/` 项目运行时。
- TypeScript 管线原型及 103 个测试。
- shell 路由 41 case × 2 副本回归。
- 安装、升级、卸载保护测试。

当前主要缺口：

- 协议使用 A/B/C 和 D1-D5，TypeScript 使用 `HIGH/VAGUE/GRAY/CLEAR` 与正则计数。
- `[直出]`、安全阀、验证门在协议和运行时中行为不完全一致。
- `processInstruction()` 在任务执行前运行验证命令，不能证明交付结果通过 R8。
- CLI 的 Codex / Cursor 模式只打印内容，没有真正形成完整下游调用闭环。
- 构建脚本编译 TypeScript，但没有把 runtime 安装到用户可调用的位置。
- `dist/*/optimize-prompt/SKILL.md` 拼接完整协议，上下文成本较高。
- 真实模型遵循度、误拦截率、漏拦截率、返工率和 token/延迟开销未知。

### 1.4 范围

#### 包含

1. 公共路由语义和机器契约。
2. TypeScript runtime 与 shell fallback 的协议等价性。
3. 基线检查、交付验证和安全阻断生命周期。
4. 构建、安装、升级、卸载和跨平台一致性。
5. Claude Code 与 Codex 两类宿主的端到端闭环。
6. 渐进披露和 skill 上下文瘦身。
7. 确定性测试、行为 eval 和真实模型 benchmark。
8. 文档、版本、LICENSE、安全说明和 release readiness。

#### 暂不包含

1. 复制 ECC 的大规模 agents / MCP / rules 能力库。
2. 复制 Superpowers 的完整 TDD、worktree 和分支收尾方法论。
3. 把 `.align/` 扩张成 OpenSpec 式完整 change tracker。
4. 把 Matt Pocock Skills 的 issue tracker 流程设为所有用户的强制依赖。
5. 未完成 P0 闭环前实现三个生态 handoff。
6. 自动 commit、push、部署或发布 release。

### 1.5 交付物

1. 一份版本化 Alignment Decision schema 和说明。
2. 一套统一路由模型及 reason code 注册表。
3. 协议等价的 TypeScript runtime 与 shell fallback。
4. 修正后的验证生命周期。
5. 可安装、可升级、可卸载的 runtime 包。
6. Claude Code 和 Codex 端到端适配证据。
7. 确定性 golden corpus、行为 eval 和真实模型 benchmark 报告。
8. 精简后的入口 skill 与按需 references。
9. 支持矩阵、迁移说明、风险说明和 release checklist。

### 1.6 约束

- 只在 `core/` 修改协议和模板，`dist/` 只由 build 生成。
- 不弱化任何“必须 / 禁止 / 输出无效，必须重做”规则。
- 不用新功能掩盖协议与运行时的现有不一致。
- 不允许两个代理同时写同一个文件或同一个 SSOT 语义。
- 不允许子代理自行 commit、push、创建 PR 或发布 release。
- 不允许把真实模型 benchmark 写成规则推演。
- 不允许把“宿主能读取说明文件”宣传成“宿主具备强制 hook parity”。
- 不覆盖工作区已有无关改动。

### 1.7 总体验收

- [ ] 每个协议硬门槛都有唯一 reason code、运行时分支和自动测试。
- [ ] TypeScript 与 shell 对 golden corpus 的路由结果 100% 一致。
- [ ] 高风险 corpus 漏拦截为 0。
- [ ] `[直出]` 不能绕过高风险安全阀。
- [ ] 基线检查和交付验证在 API、CLI 和文档中明确分离。
- [ ] 两次 build 无额外 diff，Bash / PowerShell 产物一致。
- [ ] 全新安装、重复安装、升级、卸载均通过沙箱测试。
- [ ] 至少一个 native-hook 宿主和一个 instruction-backed 宿主通过端到端测试。
- [ ] 真实模型 benchmark 披露模型、宿主、语料、评分方法、原始结果和限制。
- [ ] 入口常驻内容显著缩短，分支专属内容按需加载。
- [ ] README、使用文档、支持矩阵、版本与实际能力一致。

## 2. 北极星与产品边界

### 2.1 北极星陈述

> 对每一条进入 AI agent 的请求，Prompt Optimizer 都能给出可解释、可机器检查的决定：直通、上下文补全、澄清或高风险拦截；执行后能够证明任务契约中的验收标准已被检查。

### 2.2 核心成功指标

| 指标 | 定义 | P0 release gate |
| --- | --- | --- |
| 高风险漏拦截率 | 应 block / clarify 却 pass 的比例 | 0% |
| 路由确定性 | 相同输入与上下文得到相同 reason/route | 100% golden corpus 一致 |
| 协议等价率 | TypeScript 与 shell fallback 结果一致 | 100% |
| 不必要澄清率 | 信息足够、低风险任务被要求等待 | ≤10% 基准集 |
| 验收完整率 | 执行契约含至少一项可检查验收 | 100% 非只读直答任务 |
| 交付验证真实性 | 报告“通过”时确实在执行后运行检查 | 100% |
| 安装闭环 | install / idempotence / upgrade / uninstall | 全部通过 |
| 上下文成本 | 常驻入口 token 数 | 相比当前生成 skill 至少下降 50% |

不必要澄清率和上下文成本阈值属于本计划的推荐 release gate。首次真实基线完成后，主代理可以提出调整，但必须记录理由并经用户确认。

### 2.3 不竞争的领域

- OpenSpec 负责持久规格生命周期。
- Superpowers 负责严格软件开发方法论。
- Matt Pocock Skills 负责可组合工程技能。
- ECC 负责广覆盖 harness 能力分发。

Prompt Optimizer 只拥有对齐决策、任务契约、项目对齐上下文、验证语义和宿主入口适配。

## 3. 目标架构

```text
Host Input
  │
  ▼
Host Adapter ──────────────── 只处理输入/输出格式、能力检测和阻断方式
  │
  ▼
Alignment Runtime
  ├─ Context Loader           读取 facts / glossary / rules / lessons / decisions
  ├─ Analyzer                 D1-D5、风险、假设、意图偏差
  ├─ Decision Engine          pass / enrich / clarify / block
  ├─ Contract Builder         Agent Brief + acceptance
  └─ Lifecycle Coordinator    baseline / execute / completion verify / precipitate
  │
  ▼
Alignment Decision IR
  ├─ JSON CLI
  ├─ Human disclosure
  ├─ Hook response
  └─ Downstream handoff
```

### 3.1 Alignment Decision 建议字段

```json
{
  "version": "1.0",
  "route": "pass | enrich | clarify | block",
  "reasons": ["verification_missing"],
  "scores": {
    "precision": 2,
    "constraint": 1,
    "structure": 1,
    "context": 2,
    "verification": 0,
    "total": 6
  },
  "facts": [],
  "inferences": [],
  "assumptions": [],
  "missing": [],
  "scope": { "include": [], "exclude": [] },
  "acceptance": [],
  "next": { "action": "execute | ask | wait_confirmation" },
  "host": { "adapter": "claude-code", "enforcement": "native-hook" }
}
```

最终字段和路径由“契约冻结门”确认。字段未冻结前，其他代理不得实现 adapter 或发布 JSON API。

### 3.2 Reason Code 建议分类

- `risk.irreversible_operation`
- `risk.production_change`
- `risk.data_mutation`
- `intent.ambiguous_goal`
- `intent.xy_problem`
- `intent.symptom_as_cause`
- `scope.impact_unknown`
- `scope.too_broad`
- `assumption.too_many`
- `verification.missing`
- `context.resolvable_from_project`
- `override.explicit_direct_output`
- `lifecycle.baseline_failed`
- `lifecycle.completion_failed`

Reason code 必须稳定、可测试、与展示文案解耦。

## 4. 主代理与子代理组织

### 4.1 并发上限

最多同时运行：

- 1 个主代理。
- 5 个子代理。

并发不是默认目标。只有任务之间没有写入冲突、契约已冻结且可以独立验收时才并行。

### 4.2 主代理职责

主代理是唯一的工作流所有者：

1. 读取 `.align/`、AGENTS.md、规划和当前工作区状态。
2. 维护目标、范围、任务依赖图和文件所有权表。
3. 决定何时可以从只读审计进入写入阶段。
4. 冻结公共 schema、reason code 和生命周期语义。
5. 给每个子代理发送边界明确的 Agent Brief。
6. 汇总证据，处理跨模块冲突。
7. 执行最终集成、全量验证和契约回验。
8. 向用户报告决策点，不替用户决定发布、兼容性或高风险操作。

### 4.3 五类子代理

| 代理 | 主要职责 | 默认写入范围 | 禁止事项 |
| --- | --- | --- | --- |
| A1 协议契约审计 | 盘点硬门槛、reason code、schema、协议重复 | 审计期只读；获批后 `core/protocol/` 或契约文件 | 不改 runtime/build |
| A2 Runtime 实现 | analyzer、router、contract builder、lifecycle | `core/host/pipeline/src/` | 不改协议语义和安装器 |
| A3 分发与适配 | build、install、manifest、host adapters | `build/`、`scripts/`、adapter 目录 | 不改评分/路由语义 |
| A4 Eval 与测试 | corpus、parity、behavior eval、benchmark | `tests/`、pipeline tests、benchmark 输出 | 不为测试方便弱化规则 |
| A5 文档与发布审计 | 渐进披露、支持矩阵、迁移、release readiness | `docs/`、README、skill wrapper 源 | 不手改 `dist/` |

角色是执行波次中的所有权，不代表每轮都必须启动全部五个代理。

### 4.4 子代理统一交付格式

每个子代理必须返回：

```markdown
## Status
completed | blocked | needs-decision

## Scope
本次负责和明确不负责的内容。

## Evidence
读取的文件、发现和行号/命令证据。

## Changes
修改文件和行为变化；只读任务写“无修改”。

## Validation
实际运行的命令、通过/失败结果。

## Risks
剩余风险、兼容性和未知项。

## Decisions Needed
只有会改变方向的用户决策；事实问题不得转嫁给用户。
```

### 4.5 文件所有权规则

1. 主代理在每一波开始前发布文件所有权表。
2. 一个文件在同一波只有一个写入代理。
3. 公共类型、schema、reason code 和 protocol 属于冻结区，只有主代理批准后可改。
4. 子代理发现需要越界时，停止写入并报告影响面。
5. 共享工作区中不得通过 `git checkout --`、reset 或覆盖文件解决冲突。
6. 子代理不得格式化或重写无关文件。

## 5. 执行波次

## 波次 0：建立可信基线

### 目标

确认将要改进的真实起点，清除“README 宣称、规划、源码、安装产物”之间的口径混淆。

### 并行任务

- A1：协议硬门槛与重复规则清单，只读。
- A2：TypeScript 与 shell runtime 行为差异，只读。
- A3：build / install / dist / host adapter 交付链，只读。
- A4：现有测试覆盖和 benchmark 证据等级，只读。
- A5：README、版本、LICENSE、release、支持矩阵一致性，只读。

### 主代理输出

- `BASELINE.md` 或规划文档中的基线快照。
- 当前失败清单，按 blocker / P0 / P1 / P2 分类。
- 文件所有权表。
- 不修改代码的契约差异报告。

### 验收门 G0

- [ ] 记录本地 HEAD、与 origin 差异和未提交文件。
- [ ] 所有现有测试实际运行并记录原始输出。
- [ ] 明确公开安装路径实际交付哪些文件。
- [ ] 明确每项能力是“协议定义 / 源码实现 / 安装可用 / 宿主实测”中的哪一级。

## 波次 1：冻结公共契约

### 目标

建立所有后续代理共同依赖的唯一语义。

### 顺序

1. A1 提出 Alignment Decision schema、route、reason code 和来源标注模型。
2. A4 同步提出 schema 可测试性和 golden case 表达方式。
3. 主代理执行契约回验，解决与 `core/protocol/` 的冲突。
4. 用户只确认会改变产品行为的决策。
5. 主代理宣布 schema v1 frozen。

### 必须决定

- A/B/C 是否直接成为公共 route，或映射为 `pass/enrich/clarify/block`。
- `block` 与 `clarify` 的关系。
- `[直出]` 能覆盖哪些显示行为，不能覆盖哪些安全行为。
- 基线检查、执行后验证和沉淀的 API 边界。
- facts / inferences / assumptions 的结构。
- `.align/context.md` 是否拆成 glossary / state / ADR 引用。

### 验收门 G1：Contract Freeze

- [ ] 每个协议硬门槛只有一个规范定义。
- [ ] 每个 route 有进入条件、退出条件和 next action。
- [ ] 每个 reason code 有唯一含义。
- [ ] schema 有正例、反例和版本策略。
- [ ] 一个无上下文 agent 可仅凭 schema 文档实现兼容 consumer。
- [ ] 用户决策与项目事实明确分离。

未通过 G1，禁止进入 adapter、安装和生态集成开发。

## 波次 2：Runtime 核心闭环

### 目标

让 TypeScript runtime 忠实执行冻结契约，并保留 shell fallback。

### 并行方式

- A2：实现 analyzer / decision engine / contract builder / lifecycle coordinator。
- A4：先写 schema、golden、parity 和安全回归测试，再驱动实现。
- A1：只做 spec compliance review，不再同时写协议。

### 关键改动

1. D1-D5 从主观 prompt 规则变成可解释分析结果。
2. 风险、意图偏差、范围影响和假设数进入 reason code。
3. `[直出]` 只改变展示，不得绕过安全阀。
4. `baselineCheck()` 与 `completionVerify()` 分离。
5. `processInstruction()` 不得在 agent 执行前声称交付验证通过。
6. shell router 与 TypeScript 共用 corpus 和预期结果。
7. JSON stdout 与 human-readable stderr / disclosure 分离。

### 验收门 G2：Runtime Parity

- [ ] 现有 103 个 TypeScript 测试不回退。
- [ ] 现有 41 × 2 shell case 不回退。
- [ ] 新 golden corpus 覆盖所有硬门槛。
- [ ] TypeScript / shell route 与 reason 一致率 100%。
- [ ] 高风险漏拦截为 0。
- [ ] verification 时序测试能够证明执行前后不同。
- [ ] 空输入、恶意 JSON、引用代码、否定语境和跨语言输入均有回归测试。

## 波次 3：分发、安装与宿主适配

### 目标

让 runtime 不只存在于源码和测试中，而是通过公开安装路径真正可用。

### 并行方式

- A3：runtime 打包、manifest 安装计划、Bash/PowerShell parity。
- A5：支持矩阵、安装说明、迁移和故障排查。
- A4：安装沙箱和端到端 adapter tests。

### 交付能力等级

| 等级 | 定义 |
| --- | --- |
| L0 文档兼容 | 用户可手工复制 system prompt |
| L1 指令注入 | 宿主自动读取 AGENTS.md / rules / skill |
| L2 CLI 包装 | 请求经过 align CLI，但宿主无原生 hook |
| L3 Native Hook | 宿主事件可动态注入或阻断 |
| L4 Completion Gate | 宿主能在完成事件执行并报告交付验证 |

每个宿主必须标注实际等级，禁止只写“支持”。

### P0 宿主

1. Claude Code：Native Hook 路径。
2. Codex：instruction-backed 或真实 CLI wrapper 路径，明确不具备 hook parity。

Cursor、OpenCode、Cline、Copilot 等放在 P1，除非用户重新调整范围。

### 验收门 G3：Distribution Closure

- [ ] runtime 编译产物进入构建产物且有 generated 标记。
- [ ] build 连续两次无额外 diff。
- [ ] Bash 与 PowerShell 输出逐字节一致或有记录的必要差异。
- [ ] 安装器使用同一 manifest / install plan。
- [ ] 全新安装、幂等安装、升级和卸载通过。
- [ ] Node 缺失时降级行为明确、可测试、不会静默假装 runtime 可用。
- [ ] Claude Code 和 Codex 各有一条端到端证据链。
- [ ] `doctor` 能报告缺失 runtime、过期副本和 adapter 能力等级。

## 波次 4：渐进披露与上下文模型

### 目标

降低常驻上下文，同时保留严格规则的可达性。

### 关键任务

1. 把入口 skill 缩到路由所需的最小步骤。
2. 按 branch 拆出 intent、contract、verification、precipitation references。
3. 明确 user-invoked / model-invoked / runtime-invoked 三类入口。
4. 审计 `core/protocol/` 中 duplication、no-op、sediment 和 sprawl。
5. 建立 glossary、项目事实、经验、ADR、临时状态的职责边界。
6. 给 reference 加 context pointer：何时读、读完完成什么。

### 验收门 G4：Context Economy

- [x] 常驻入口 token 数比当前下降至少 50%。
- [x] 每个 hard gate 在需要时仍可被可靠加载。
- [x] 简单 A 档任务不加载完整协议和所有模板。
- [x] 任一规则只有一个 SSOT，其他位置只引用。
- [x] generated skill 与 source 的引用关系可自动检查。
- [x] glossary 不混入实现细节，ADR 只记录难逆且有真实权衡的决策。

## 波次 5：真实评测与发布准备

### 目标

证明项目能降低偏差，而不是只证明测试能通过。

### 评测组

| 组 | 输入方式 |
| --- | --- |
| Control | 原始请求直接交给宿主 |
| Protocol-only | 仅加载规则/skill，无动态 runtime |
| Runtime | 经过 Alignment Decision 和宿主 adapter |

### 建议语料

- 10 个简单明确任务。
- 10 个可从项目上下文补全的任务。
- 10 个必须澄清的低分任务。
- 10 个高风险任务。
- 8 个 XY problem / 症状伪装 / 局部视角任务。
- 8 个引用、否定、教学语境和对抗性任务。

### 建议记录

- route 与 reason。
- 是否不必要打断。
- 是否遗漏高风险。
- 澄清问题是否命中最高价值决策。
- Agent Brief 是否擅自做方向决策。
- 验收是否可执行。
- 最终任务成功与返工轮数。
- 输入/输出 token、延迟和失败原因。

### 验收门 G5：Release Candidate

- [x] benchmark 原始记录可复现。
- [x] 规则推演与真实模型实测明确分开。
- [x] 高风险漏拦截为 0。
- [x] 不必要澄清率满足 release gate，或用户明确接受偏差。
- [x] 所有已知失败有 issue / debt 记录。
- [x] LICENSE、SECURITY、CHANGELOG、版本、README 和安装器一致。
- [x] 没有把未实测宿主写成“完整支持”。
- [x] 全量 `.align/align-check.sh` 通过。

## 波次 6：可选生态 handoff

只有 G5 通过后才进入本波。

> 当前状态：G5 已关闭；G6 已选择并完成 Matt Pocock Skills handoff，最终 gate 已通过。

### 候选 1：OpenSpec

触发：长期、跨模块、多人协作、需要归档的 change。

交付：Alignment Decision / Agent Brief → OpenSpec proposal 草案。

### 候选 2：Superpowers

触发：需要严格设计、计划、TDD、审查的复杂软件任务。

交付：已确认 facts / decisions / scope / acceptance → brainstorming 或 writing-plans 输入。

### 候选 3：Matt Pocock Skills

触发：需要 grilling、prototype、to-spec、to-tickets、TDD 或两轴 review 的工程任务。

交付：route → 对应 skill；不复制 skill 正文。

**G6 关闭结果**：已交付独立 `alignment.ecosystem-handoff` schema、环境/setup 发现、九类确定性映射和显式 `align-cli matt`。普通 `json` 保持原样；`clarify` / `block` 返回 `deferred`；`automatic=false`，不自动调用 skill。

证据：[`MULTI-AGENT-G6-MATT-HANDOFF.md`](MULTI-AGENT-G6-MATT-HANDOFF.md)。

### 候选 4：ECC / 通用 harness manifest

触发：作为其他能力发行版中的 `intent-alignment` 模块安装。

交付：minimal / standard / strict profile 与 adapter metadata。

生态 handoff 一次只实现一个。优先级由真实用户需求和 benchmark 数据决定，不按 stars 决定。

## 6. 任务依赖图

```text
F01 基线快照
 ├─ F02 协议硬门槛清单
 ├─ F03 Runtime 差异清单
 ├─ F04 分发链审计
 └─ F05 测试证据分级
        ↓
C01 Alignment Decision schema
 ├─ C02 Route + reason registry
 ├─ C03 Lifecycle contract
 └─ C04 Context taxonomy
        ↓ Contract Freeze G1
R01 Analyzer ───────┐
R02 Decision Engine │
R03 Contract Builder├─ R06 JSON CLI / API
R04 Lifecycle       │
R05 Shell parity ───┘
        ↓ Runtime Parity G2
D01 Runtime package ── D02 Install manifest ── D03 Host adapters ── D04 Doctor
        ↓ Distribution G3
P01 Entry slimming ── P02 Reference split ── P03 Context migration
        ↓ Context G4
E01 Golden corpus ── E02 Behavior eval ── E03 Host benchmark ── E04 Report
        ↓ Release Candidate G5
I01 单一生态 handoff
```

## 7. Agent-Ready 任务清单

### F01：冻结工作区基线

**Owner**：主代理
**Blocked by**：无
**输出**：HEAD、origin 差异、未提交改动、版本面、现有测试结果。

验收：

- [ ] 不修改和回滚用户现有文件。
- [ ] 标出本地领先远端的提交。
- [ ] 标出 `.align` 运行时副本是否与 core 同步。

### F02：协议硬门槛与重复清单

**Owner**：A1
**Blocked by**：F01
**输出**：每条硬门槛的 SSOT、重复位置、冲突和期望 runtime 行为。

验收：

- [ ] 覆盖 D1-D5、总分、D5、假设数、高风险、R8、范围和沉淀。
- [ ] 每个冲突有文件证据。

### F03：Runtime 行为差异

**Owner**：A2
**Blocked by**：F01
**输出**：shell、TypeScript、skill、hook 的行为矩阵。

验收：

- [ ] 覆盖 route、bypass、verification、context 和 block 行为。
- [ ] 只读，不提前修复。

### F04：分发链审计

**Owner**：A3
**Blocked by**：F01
**输出**：core → build → dist → install → host 的逐文件链路。

验收：

- [ ] 能回答最终用户实际获得哪些 runtime 文件。
- [ ] Bash / PowerShell 差异逐项列出。

### F05：测试与证据分级

**Owner**：A4
**Blocked by**：F01
**输出**：测试清单，区分文本检查、单元、集成、安装、宿主和模型 eval。

验收：

- [ ] 不把规则推演计作模型实测。
- [ ] 指出每个关键行为当前缺少哪一级证据。

### C01：Alignment Decision schema

**Owner**：A1，主代理批准
**Blocked by**：F02、F03、F05
**输出**：schema、字段说明、版本规则、正反例。

验收：见 G1。

### C02：Route 与 reason registry

**Owner**：A1
**Blocked by**：C01
**输出**：route 状态机、reason code、优先级和组合规则。

### C03：Lifecycle contract

**Owner**：A1 + A4
**Blocked by**：C01
**输出**：baseline、execute、completion verify、precipitate 的状态和 API。

### C04：Context taxonomy

**Owner**：A1 + A5
**Blocked by**：C01
**输出**：facts、glossary、rules、lessons、decisions、temporary state 的职责和大小纪律。

### R01-R05：Runtime 与 parity

**Owner**：A2 / A4
**Blocked by**：G1
**输出**：analyzer、decision engine、contract builder、lifecycle、shell parity。

验收：见 G2。

### D01-D04：分发与适配

**Owner**：A3 / A4 / A5
**Blocked by**：G2
**输出**：package、manifest、Claude/Codex adapter、doctor/status。

验收：见 G3。

### P01-P03：渐进披露

**Owner**：A5，A1 做语义审查
**Blocked by**：G2
**输出**：瘦入口、reference branches、context migration。

验收：见 G4。

### E01-E04：评测

**Owner**：A4，主代理复核
**Blocked by**：G3、G4
**输出**：corpus、behavior eval、host/model benchmark、报告。

验收：见 G5。

## 8. 主代理运行协议

### 每一波开始

1. 读取最新 lessons → spec → context。
2. 读取本规划和上一波验证报告。
3. 检查 git status，不覆盖用户改动。
4. 发布本波目标、阻塞关系和文件所有权。
5. 只启动当前真正独立的子代理。

### 子代理返回后

1. 先核对 evidence，不直接相信“已完成”。
2. 检查是否越界修改。
3. 运行该子任务的窄验证。
4. 对公共契约做 Spec compliance review。
5. 发现跨模块冲突时由主代理裁决，不让两个子代理互相覆盖。

### 每一波结束

1. 运行波次 gate。
2. 更新决策、风险和债务。
3. 只有 gate 通过才解锁下一波。
4. 向用户报告通过项、失败项和需要确认的方向决策。

## 9. 风险台账

| 风险 | 触发信号 | 影响 | 缓解 | Owner |
| --- | --- | --- | --- | --- |
| 协议/实现再次漂移 | 同一规则在多个文件复制 | 路由不可预测 | schema + reason registry + parity test | 主代理/A1 |
| 子代理写入冲突 | 两个代理触碰相同 SSOT | 覆盖改动 | 文件所有权表、契约冻结 | 主代理 |
| 过度流程化 | 简单任务也加载完整协议 | 用户卡顿、token 增长 | A 档、渐进披露、实测指标 | A5/A4 |
| 安全阀被 override 绕过 | `[直出]` 或宿主降级 | 高风险误执行 | 安全优先级测试、block reason | A2/A4 |
| 验证门虚假通过 | 执行前运行检查 | 提前完成 | baseline/completion API 分离 | A2 |
| 构建可用但安装不可用 | runtime 只在源码目录 | 用户无法使用 | 分发链端到端测试 | A3/A4 |
| 宿主能力夸大 | instruction-backed 写成强制 | 用户错误预期 | compliance matrix | A5 |
| benchmark 自证循环 | 用协议预期给协议打分 | 无真实价值证据 | control group + 原始输出 | A4 |
| Context 膨胀 | 完整协议常驻 | 模型注意力下降 | token budget + branch references | A5 |
| 范围扩张成 ECC | 增加大量无关能力 | 定位丢失 | 产品边界和 G5 前禁生态扩张 | 主代理 |

## 10. 用户决策点

以下决策在对应 gate 前一次只确认一个：

1. 公共 route 是否使用 `A/B/C` 还是 `pass/enrich/clarify/block`。
   - 推荐：机器层使用 `pass/enrich/clarify/block`，展示层映射为 A/B/C。
2. P0 首批宿主是否只做 Claude Code + Codex。
   - 推荐：是，覆盖 native hook 与 instruction-backed 两种能力边界。
3. `.align/context.md` 是否拆分 glossary 与运行时状态。
   - 推荐：拆分，但提供无损迁移和兼容读取期。
4. 首次 release gate 是否接受“不必要澄清率 ≤10%”。
   - 推荐：先跑 baseline，再确认最终阈值；高风险漏拦截 0% 不可降低。
5. P0 完成后优先做哪个生态 handoff。
   - 推荐：依据真实用户场景选择，不预设；若以复杂工程为主，先做 Matt Skills 或 OpenSpec handoff。

## 11. 可直接启动的主代理 Prompt

```markdown
你是 Prompt Optimizer 改进项目的主代理。

唯一目标：按照 `docs/planning/MULTI-AGENT-IMPROVEMENT-PLAN.md`，完成当前获批波次并通过对应 gate。不要提前进入后续波次。

开始前必须：
1. 读取 AGENTS.md。
2. 按 `.align/lessons.md → spec.md → context.md` 顺序读取项目态。
3. 读取生态对比和本规划。
4. 检查 git status、HEAD 与 origin 差异。
5. 输出本波文件所有权表和子代理任务边界。

协作规则：
- 最多 5 个子代理；只并行真正独立的任务。
- 审计波只读；公共契约冻结前禁止实现 adapter。
- 每个文件同一波只有一个写入 owner。
- 子代理不得 commit、push、发布或覆盖用户改动。
- 对子代理结果必须核验证据并运行验证，不能按“完成”声明直接合并。

交付格式：
- 当前波次与 gate
- 子代理任务和状态
- 变更文件
- 验证证据
- 未解决风险
- 下一步是否已解锁

如果发现会改变产品方向的缺口，停下只问一个问题并给推荐答案。事实问题自行读取代码和文档解决。
```

## 12. 子代理任务 Prompt 模板

```markdown
你是子代理【角色】。

任务：完成【任务 ID 和名称】。
目标 gate：【G0-G5】。
依赖已满足：【依赖列表】。

允许范围：
- 读取：【路径】
- 修改：【独占路径；只读任务写“禁止修改任何文件”】

明确排除：
- 不修改公共契约或其他代理所有的文件。
- 不 commit、push、创建 PR、安装新依赖或发布。
- 不把规划、README 宣称当作运行事实；必须核对源码和测试。

验收：
- 【可执行检查 1】
- 【可执行检查 2】

返回必须包含：Status、Scope、Evidence、Changes、Validation、Risks、Decisions Needed。
发现越界依赖时停止并报告，不要自行扩大范围。
```

## 13. 契约回验

- Q1 意图保真：本规划仍以降低意图、范围、验收偏差为中心，没有把项目改造成通用 skill 大全。
- Q2 无擅自决策：版本、发布、远端写入和生态 handoff 优先级均保留为用户决策；技术建议已标注推荐理由。
- Q3 可独立执行：每个波次有目标、依赖、代理、文件边界、交付物和 gate。
- Q4 验收可判定：核心验收均可由 corpus、测试命令、构建 diff、安装沙箱、宿主证据或量化指标判断。

## 14. 最终自检

- [ ] 先完成波次 0，不直接让多个代理开始改代码。
- [ ] G1 前不实现 adapters。
- [ ] G2 前不修改安装承诺。
- [ ] G3 前不宣传 runtime 已交付。
- [ ] G4 前不宣称上下文成本已优化。
- [ ] G5 前不进入生态扩张。
- [ ] 所有失败、风险和未验证项如实报告。
- [ ] 用户明确授权前不 commit、不 push、不 release。
