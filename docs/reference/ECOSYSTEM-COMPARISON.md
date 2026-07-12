# Prompt Optimizer 与 OpenSpec、Superpowers、ECC、Matt Pocock Skills 对比调研

> 调研日期：2026-07-11
> 对比对象：`Fission-AI/OpenSpec`、`obra/superpowers`、`affaan-m/ECC`、本地 `mattpocock/skills` v1.1.0 快照
> 本项目口径：本地 `main` 的 `31eaa17`，比 `origin/main` 领先 18 个提交。公开 GitHub 仓库暂未包含这 18 个本地提交。

## 结论先行

Prompt Optimizer 不应把自己定义成 OpenSpec、Superpowers、ECC 或 Matt Pocock Skills 的替代品。

五个项目解决的是 agent 系统中的不同层级问题：

```text
ECC：为 Claude Code、Codex、Cursor 等宿主提供 skills/hooks/rules/MCP/安全能力
  └─ 用户提出请求
       ↓
     Prompt Optimizer：直通、补全、澄清还是高风险拦截？
       ↓
     根据任务选择下游工作流
       ├─ OpenSpec：把复杂变更固化为可追踪、可验证、可归档的规格工件
       ├─ Superpowers：按统一强流程执行设计、计划、TDD、审查和收尾
       └─ Matt Pocock Skills：按需组合 grilling、spec、tickets、TDD、review 等小技能
```

最适合 Prompt Optimizer 的定位是：

> **AI agent 的意图入口层（intent ingress layer）和对齐控制平面（alignment control plane）：在执行前把请求路由为直通、上下文补全、澄清或高风险拦截，并产出带验收标准的任务契约。**

这个定位与三个项目都有交集，但仍然成立：

- OpenSpec 主要管理长期存在的规格与变更工件，不处理每一条日常指令的风险比例路由。
- Superpowers 会探查意图，但它把探查嵌入一套完整且严格的软件开发方法论；Prompt Optimizer 的目标是对简单任务低摩擦、对高风险任务强拦截。
- ECC 有路由、记忆、hooks 和安全能力，但它是广覆盖的 agent harness 操作系统；Prompt Optimizer 应保持单一职责，不扩张成能力大全。
- Matt Pocock Skills 也以“agent 没做对用户真正想要的事”为出发点，但它依赖用户选择或 `ask-matt` 路由到可组合技能；Prompt Optimizer 试图让每条普通指令自动经过比例化对齐。

当前最重要的判断不是“还需要复制多少功能”，而是：

1. 保住“按风险比例决定对齐强度”这个差异点。
2. 把文本协议变成稳定、可测试、可被其他工作流消费的机器契约。
3. 用真实宿主和真实模型评测证明它确实减少返工，而不只是协议看起来完整。

## 调研口径

本报告优先使用官方仓库、官方文档、源码、release 和 GitHub API，不用二手介绍代替项目事实。Matt Pocock Skills 部分使用用户提供的本地 v1.1.0 文件快照；该目录不是独立 Git 仓库，因此不推断它与远端当前 HEAD 完全一致。

截至 2026-07-11 的 GitHub 快照：

| 项目 | GitHub 仓库 | Stars | 最新 release | 核心自我定位 |
| --- | --- | ---: | --- | --- |
| Prompt Optimizer | [`20231118185SSPU/prompt-optimizer`](https://github.com/20231118185SSPU/prompt-optimizer) | 1 | 无 GitHub release | Agent intent alignment protocol |
| OpenSpec | [`Fission-AI/OpenSpec`](https://github.com/Fission-AI/OpenSpec) | 60,057 | v1.6.0 | Spec-driven development for AI coding assistants |
| Superpowers | [`obra/superpowers`](https://github.com/obra/superpowers) | 252,121 | v6.1.1 | Agentic skills framework and software development methodology |
| ECC | [`affaan-m/ECC`](https://github.com/affaan-m/ECC) | 228,400 | v2.0.0 | Agent harness operating system |
| Matt Pocock Skills | 本地 v1.1.0 快照；上游声明为 `mattpocock/skills` | 未重新联网统计 | v1.1.0 | Small, adaptable, composable skills for real engineering |

Stars 只反映传播和社区规模，不证明技术方案更适合本项目。对本项目真正有价值的是它们已经验证过的产品边界、工件模型、评测方法、安装体系和跨宿主适配方式。

## 五个项目的核心差异

| 维度 | Prompt Optimizer | OpenSpec | Superpowers | ECC | Matt Pocock Skills |
| --- | --- | --- | --- | --- | --- |
| 首要问题 | agent 是否理解了用户真正要什么 | 团队与 agent 如何对“要构建什么”形成持久规格 | agent 应如何按可靠的软件工程过程工作 | 如何完整配置并增强多个 agent harness | 如何用小而可组合的技能修复真实工程失败模式 |
| 所处层级 | 请求进入执行前的对齐与路由 | 规格和变更管理层 | 开发工作流与行为纪律层 | 能力分发、运行时和工具生态层 | 可组合工程技能与人工工作流层 |
| 主要输入 | 一条自然语言请求 + 项目上下文 | 一个 change / feature / requirement | 一个软件开发任务或已批准设计 | 用户选择的安装 profile、模块和工作流 | 用户选择的 skill，或由模型命中触发描述 |
| 主要输出 | 路由结果、澄清、Agent Brief、验收契约 | proposal、specs、design、tasks、archive | design、plan、代码、测试、review、分支结果 | skills、agents、hooks、rules、MCP、memory、安全和编排能力 | glossary/ADR、spec、tickets、实现、review、handoff |
| 持久化 | `.align/` 规范、上下文、经验、决策 | `openspec/changes/`、`specs/`、archive、stores | 设计/计划文档、worktree、提交记录 | manifests、profiles、session/memory、harness 配置 | `CONTEXT.md`、ADR、issue tracker、spec/tickets |
| 强制机制 | hook、规则注入、规划中的 CLI 管线 | CLI 生成命令/skills、工件依赖和 validate | skills 强制触发、hard gate、hooks、评测 | hooks、plugins、install manifests、profiles、安全扫描 | user/model invocation 边界、skill 完成条件、router flow |
| 简单任务策略 | A 档零感知直通，仍要求验证 | 可直接 explore/propose；核心仍围绕 change 工件 | 即使简单任务也必须先设计并获批 | 取决于安装 profile 和启用能力 | 可直接调用单个 skill；主流程通常从 grilling 开始 |
| 复杂任务策略 | 补全或澄清后生成任务契约 | 工件图驱动 proposal → specs/design/tasks → apply/archive | brainstorming → design → plan → TDD/执行 → review | 组合 agents/skills/hooks/orchestration | grill → prototype（可选）→ spec → tickets → implement/TDD/review |
| 适用范围 | 设计上可覆盖代码、调研、写作等 agent 任务 | 主要是 AI 辅助软件开发 | 软件开发方法论 | 软件开发、研究、内容、运营等广泛 agent 工作 | 以真实软件工程为主，另有少量生产力技能 |
| 最大优势 | 自适应严格度、意图/范围/验收三类偏差模型 | 持久、可验证、可协作的规格工件和成熟 CLI | 强行为纪律、完整开发闭环、skill 行为评测 | 广度、安装分层、跨宿主适配、社区和安全体系 | 小技能、清晰调用边界、上下文经济性和组合自由度 |
| 最大代价 | 规则与运行时仍有落差，价值证据不足 | 对短小任务可能增加工件成本 | 对简单任务也有明显流程成本 | 范围极大、上下文和配置复杂度高 | 用户认知负担较高，自动强制和统一运行时较弱 |

## Prompt Optimizer 自身的真实能力

### 已经形成的差异化能力

#### 1. 三类偏差比“写规格”更靠前

项目把失败拆成意图偏差、范围偏差和验收偏差，并用意图探查、五维诊断、三档路由、契约回验和验证门处理。这个模型回答的是“是否已经理解正确”，而不是直接进入“如何写 spec”或“如何开发”。

证据：[`core/protocol/00-positioning.md`](../../core/protocol/00-positioning.md)、[`core/protocol/05-contract-check.md`](../../core/protocol/05-contract-check.md)。

#### 2. 对齐强度与风险成正比

项目的 A/B/C 三档设计是目前最鲜明的产品主张：

- A 档：简单、明确、低风险时零感知直通。
- B 档：从项目上下文静默补全，披露关键假设后继续。
- C 档：高风险、低分或假设过多时必须停下，一次只问一个问题。

这与 Superpowers 的“所有创作/实现都必须先设计并获批”形成实质差异。Prompt Optimizer 追求的是**比例化治理**，不是统一增加流程。

证据：[`core/protocol/03-routing.md`](../../core/protocol/03-routing.md)、[Superpowers brainstorming skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)。

#### 3. Agent Brief 不是普通 prompt 模板

Agent Brief 把意图、上下文、任务对象、范围、交付物、约束、执行策略和验收组合成任务契约，并通过 `[原文]`、`[推断]`、`[假设]` 区分信息来源。相比只有 proposal 或 plan，这更强调“agent 不得把自己的补全当成用户决策”。

证据：[`core/templates/AGENT-BRIEF.md`](../../core/templates/AGENT-BRIEF.md)。

#### 4. `.align/` 是轻量项目态，而不是完整项目管理系统

`.align/` 固化项目规范、上下文、经验、决策和验证命令，并规定读取顺序与大小纪律。它适合给每次 agent 执行提供短期高价值上下文，不需要把每个任务都变成独立 change 目录。

证据：[`core/protocol/07-precipitation.md`](../../core/protocol/07-precipitation.md)。

#### 5. SSOT 和多宿主构建方向正确

`core/` 作为唯一事实来源，`build/` 生成 Claude Code、Codex、Cursor 和 universal 产物。这与 OpenSpec、ECC 的“共享源 + 薄适配器”方向一致，是可继续扩展的基础。

### 需要诚实面对的成熟度差距

#### 1. 协议已经完整，运行时还没有等价实现

协议定义了 D1-D5、总分阈值、`D5=0`、`[假设]>2` 和 A/B/C 路由；当前 TypeScript 管线主要实现风险、模糊、具体、教学四类正则信号，并输出 `HIGH/VAGUE/GRAY/CLEAR`。

这不是命名差异，而是语义差异。当前运行时还不能机械证明自己执行了完整协议。

证据：[`core/protocol/02-diagnosis.md`](../../core/protocol/02-diagnosis.md)、[`core/host/pipeline/src/classifier.ts`](../../core/host/pipeline/src/classifier.ts)、[`core/host/pipeline/src/router.ts`](../../core/host/pipeline/src/router.ts)。

#### 2. “通用 CLI 包装器”目前更接近格式化输出器

`align-cli codex`、`cursor` 和 `generic` 当前输出对齐信息与原始指令，没有实际调用下游 Codex / Cursor 进程。规则生成器也尚未通过安装流程形成完整的用户路径。

因此，本地管线可以称为“已实现并有单元测试的原型运行时”，但还不能称为“所有工具上的强制通用拦截层”。

证据：[`core/host/pipeline/src/index.ts`](../../core/host/pipeline/src/index.ts)、[`core/host/pipeline/src/rules/generate.ts`](../../core/host/pipeline/src/rules/generate.ts)。

#### 3. 验证门的时序需要修正

`processInstruction()` 在处理用户指令时立即执行 `.align/check-commands.txt`，这发生在 agent 完成任务之前。它验证的是执行前基线，不是交付前结果。协议要求的 R8 是交付前验证，两者不能混为一谈。

证据：[`core/host/pipeline/src/pipeline.ts`](../../core/host/pipeline/src/pipeline.ts)、[`core/host/pipeline/src/verifier.ts`](../../core/host/pipeline/src/verifier.ts)。

#### 4. 构建和安装尚未把 TypeScript 管线交付给用户

构建脚本会在 `core/host/pipeline/` 内运行 `npm install && npm run build`，但没有把编译产物复制进根 `dist/` 的宿主包。安装器会提示 Node.js 依赖，却只复制 `dist/{adapter}/{skill}` 与 shell hooks，没有安装 `align-cli` 管线。

结果是：源码和 103 个测试存在，本地编译也可用，但公开的一行安装路径仍主要交付旧的 skill + shell hook 链路。

证据：[`build/build.sh`](../../build/build.sh)、[`scripts/install-skill.sh`](../../scripts/install-skill.sh)。

#### 5. 公开仓库落后于本地 18 个提交

本地 `main` 比 `origin/main` 领先 18 个提交，其中包含整个通用 TypeScript 管线。外部用户看到的 GitHub README、源码和能力与本地状态不同，会直接影响比较、安装和社区反馈。

#### 6. 当前 benchmark 不是外部模型实测

现有 18 case 报告明确是协议规则推演，只能证明规则在这些 case 上没有自相矛盾，不能证明 Claude、Codex、Cursor 会稳定遵守，也不能证明真实澄清率、误拦截率或返工率下降。

证据：[`docs/planning/BENCHMARK-V3.md`](../planning/BENCHMARK-V3.md)。

#### 7. 产品发布基础仍薄弱

公开仓库当前没有 GitHub release，GitHub API 未识别到 license 文件，README 中的版本、安装器版本和 TypeScript 包版本也不是一个统一版本面。这些问题不会改变方法论价值，但会降低外部用户信任和可维护性。

## 与 Matt Pocock Skills 的关系

### 这个本地参考项目真正在做什么

用户提供的本地参考目录是 `mattpocock/skills` 的 v1.1.0 快照。它包含 17 个 engineering、5 个 productivity、4 个 misc、2 个 personal、6 个 in-progress 和 4 个 deprecated skills；其中 plugin manifest 只发布 21 个 promoted skills。

它不是单一协议或运行时，而是一组围绕真实工程失败模式设计的小技能。其 `ask-matt` 主流程是：

```text
idea
→ grill-with-docs / grill-me
→ prototype（仅当问题需要运行或视觉答案）
→ to-spec
→ to-tickets（tracer-bullet 垂直切片 + blocking edges）
→ implement
→ tdd
→ code-review（Standards + Spec 两轴）
→ commit
```

同时，它把技能分为：

- **User-invoked**：只有用户能调用，零自动上下文负担，但用户需要记住入口。
- **Model-invoked**：模型可自动调用，description 使用丰富触发语义，但每轮都产生上下文负担。
- **Router skill**：当 user-invoked skills 多到难以记忆时，用一个 `ask-matt` 显式路由器承载认知索引。

它的核心哲学不是“拥有流程”，而是把 grilling、研究、领域建模、TDD、review 等工程纪律做成可以按需组合的能力。

### 与 Prompt Optimizer 的重叠

- 都把 misalignment 视为 agent 最常见的失败源。
- 都要求事实由 agent 自己查，方向性决策必须交给用户。
- 都要求一次只问一个问题，并给推荐答案。
- 都强调先形成共享理解，再进入执行。
- 都用持久上下文减少术语漂移和重复解释。
- 都反对 agent 在没有验证时提前宣布完成。

### 本质区别

Matt Pocock Skills 的控制单位是“一个被用户或模型调用的 skill”；Prompt Optimizer 的控制单位是“进入 agent 的每条请求”。

Matt Skills 主要依靠人工选择、模型触发描述和 `ask-matt` 路由器组合流程。Prompt Optimizer 试图通过 hook / runtime 自动决定 A/B/C 档，并在用户没有显式调用 skill 时仍执行安全阀。

Matt Skills 的完整主流程仍偏向代码工程和 issue tracker；Prompt Optimizer 的 Agent Brief 和五维诊断设计上也覆盖调研、写作和通用 agent 任务。

### 最值得借鉴

1. **User-invoked / Model-invoked 的显式成本模型**
   每个自动触发 skill 都消耗上下文，每个手动 skill 都消耗用户认知。Prompt Optimizer 应对每条常驻规则问：它值得每轮加载，还是只应在 route 命中后披露？

2. **Router 是一张必须保持真实的能力地图**
   新增、删除、重命名或改变 skill 关系时，`ask-matt` 必须同步更新。Prompt Optimizer 的 route reason、模板映射和 adapter registry 也应拥有同样的机械一致性检查。

3. **Progressive disclosure 和小 skill**
   入口只保留每条路径都需要的步骤；只在某个 branch 使用的规则放到引用文件。当前生成的 `optimize-prompt/SKILL.md` 拼接完整协议，明显没有完全兑现项目自己“skill 要小”的参考原则。

4. **可检查的 completion criterion**
   每一步都应有二值完成条件，防止 agent 的注意力滑向“赶快结束”。这可用于重写意图探查、契约回验和沉淀门的运行时状态。

5. **Facts 与 Decisions 分离**
   代码、文档、日志可查的是 facts；目标、边界、权衡是用户 decisions。这个区分比笼统的“能查到就自己查”更精确，应进入 Alignment Decision IR。

6. **领域词汇与项目配置分开**
   Matt Skills 明确要求 `CONTEXT.md` 只做 glossary，不混实现细节；重大且难逆的取舍才写 ADR。Prompt Optimizer 当前 `.align/context.md` 同时承载术语、项目状态和架构决策，后续可以拆成清晰的上下文类型。

7. **Tracer-bullet tickets + blocking edges**
   长任务不要按前端/后端/测试横向切层，而要切成可独立验收的端到端行为，并显式声明阻塞关系。这适合成为 Agent Brief 之后的可选 handoff，不应塞进基础对齐协议。

8. **Standards / Spec 两轴 review**
   “代码写得好”与“实现了用户要的东西”必须分开审查。Prompt Optimizer 可以拥有 Spec/Intent compliance 轴，把代码标准轴交给下游 review 工具。

9. **Skill 文本的维护纪律**
   `writing-great-skills` 提出的 no-op、sediment、sprawl、duplication、leading word 和信息层级，适合直接用于审计 `core/protocol/`：删除不会改变模型行为的句子，避免多文件重复同一硬门槛造成漂移。

### 已经吸收但尚未做深的部分

项目现有 [`REFERENCE-DIGEST.md`](REFERENCE-DIGEST.md) 已记录 grilling、共享术语、Agent Brief 和“小而可组合”的影响，但当前实现仍有三处落差：

- `optimize-prompt` 生成 skill 拼接全部协议，体积大、按需披露不足。
- 项目有自动路由目标，但缺少像 `ask-matt` 一样可检查的统一能力图和稳定 IR。
- `.align/context.md` 混合 glossary、架构和阶段状态，不如 glossary + ADR + runtime state 的职责分离清晰。

### 不应照搬

- 不要要求用户记住 21 个 promoted skills；自动路由仍是本项目的差异点。
- 不要让所有改动都进入长 grilling 主流程；A 档必须继续低摩擦。
- 不要把 issue tracker、ticket 拆解或自动 commit 变成基础协议强制项。
- 不要把工程 skill 库整体复制进项目；应通过 handoff 组合，而不是扩大 Prompt Optimizer 的所有权边界。

## 与 OpenSpec 的关系

### OpenSpec 真正在做什么

OpenSpec 是一个规格驱动开发系统。其标准 OPSX 工作流围绕：

```text
explore → propose/new → specs/design/tasks → apply/update/verify → sync/archive
```

它的核心不是某个 prompt，而是：

- `schema.yaml` 定义工件及依赖图。
- proposal、spec、design、tasks 模板可以独立定制。
- change 有明确状态、校验和归档生命周期。
- CLI 提供稳定的 JSON 输出、diagnostic envelope 和退出码契约。
- 25+ 工具适配器从共享源生成宿主命令。
- stores beta 把规格从单仓库扩展到跨仓库共享。

来源：[OpenSpec README](https://github.com/Fission-AI/OpenSpec/blob/main/README.md)、[OPSX workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/opsx.md)、[agent contract](https://github.com/Fission-AI/OpenSpec/blob/main/docs/agent-contract.md)、[artifact graph source](https://github.com/Fission-AI/OpenSpec/tree/main/src/core/artifact-graph)。

### 与 Prompt Optimizer 的重叠

- 都反对“聊天里说过就算形成共识”。
- 都要求在编码前明确目标、范围、设计和验证。
- 都把项目上下文注入 agent 指令。
- 都希望跨多个 AI 编程工具工作。

### 本质区别

OpenSpec 的基本单位是“change 及其规格工件”；Prompt Optimizer 的基本单位是“进入 agent 的一条请求及其对齐决策”。

OpenSpec 适合需要长期追踪、多人协作或多阶段实施的变更。Prompt Optimizer 还必须处理“改一个标题”“查一个错误”“解释一段代码”这种不值得创建 change 的请求。

### 最值得借鉴

1. **机器可读的 Agent Contract**：稳定 JSON shape、诊断码、退出码，而不是让宿主解析自然语言 verdict。
2. **工件图而非固定阶段**：复杂任务可以有依赖，但允许回退和更新，不把流程做成单向瀑布。
3. **可定制 schema + 模板即时生效**：让团队扩展验收或路由工件，不必修改 TypeScript 核心。
4. **doctor / validate / status**：安装、项目态、配置和产物健康必须可检查。
5. **adapter registry**：共享语义只实现一次，宿主层只负责路径、命令格式和能力差异。

### 不应照搬

- 不要让每条普通请求都创建 proposal/spec/design/tasks。
- 不要把 `.align/` 扩张成第二套 change tracker。
- 不要让“有工件”替代意图探查；结构完整的 spec 仍可能解决错问题。

## 与 Superpowers 的关系

### Superpowers 真正在做什么

Superpowers 是一套由可组合 skills 构成的软件开发方法论。其主链路是：

```text
brainstorming → design approval → writing-plans
→ subagent-driven-development / executing-plans
→ TDD → code review → finish branch
```

它通过 skill 触发规则和 hard gate 强制行为。例如 `brainstorming` 明确规定：即使任务很简单，也不得在设计获批前执行实现。它还使用行为测试和独立 eval 仓库测试“agent 是否真的遵守 skill”，而不只检查 Markdown 是否存在。

来源：[Superpowers README](https://github.com/obra/superpowers/blob/main/README.md)、[brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)、[skills](https://github.com/obra/superpowers/tree/main/skills)、[tests](https://github.com/obra/superpowers/tree/main/tests)。

### 与 Prompt Optimizer 的重叠

- 都会在实现前追问“真正想做什么”。
- 都坚持一次只问一个问题。
- 都强调验收、验证后再宣布完成。
- 都把方法论拆为 agent 可执行的规则。

### 本质区别

Superpowers 解决的是“软件工程全过程如何可靠执行”，并选择了统一、严格的流程。Prompt Optimizer 解决的是“本次请求需要多强的治理”，并选择了 A/B/C 比例路由。

因此，Prompt Optimizer 的竞争优势不是“也有 brainstorming”，而是：

> **能够判断什么时候不该启动完整 brainstorming，什么时候必须启动，什么时候只需从项目态补全后继续。**

### 最值得借鉴

1. **skills 小型化与组合**：路由、澄清、契约生成、验证、沉淀可以拥有清晰接口，避免一个超长生成 skill 承担全部语义。
2. **行为 eval**：给真实模型施压，例如“用户催促跳过澄清”“用户说这很简单”“高风险词在引用代码中”，检查 agent 是否守门。
3. **每个流程有终止状态**：不是“尽量遵守”，而是明确下一 skill / 下一工件 / 等待用户的状态。
4. **spec compliance 与 code quality 分开评审**：先检查是否做了用户要的，再检查代码质量；这正对应意图偏差与实现质量的分离。
5. **跨宿主安装优先使用官方 plugin surface**：减少手工复制和宿主路径漂移。

### 不应照搬

- 不要复制“所有简单任务都必须先设计并获批”的硬门，它会破坏 A 档的核心价值。
- 不要复制完整 TDD、worktree、subagent、merge 流程；这些属于下游执行方法论。
- 不要让用户记住大量 skill 名称。Prompt Optimizer 应路由到下游能力，而不是暴露更多模式选择。

## 与 ECC 的关系

### ECC 真正在做什么

ECC 已从配置集合扩展成 agent harness operating system，覆盖：

- agents、skills、commands、rules、hooks 和 MCP。
- session / memory、continuous learning、security scanning、model routing 和 orchestration。
- Claude Code、Codex、Cursor、OpenCode、Copilot 等多宿主适配。
- `minimal/core/developer/security/research/full` 等 manifest-driven 安装 profile。
- hooks 可用时用事件强制，不可用时退化为 AGENTS.md、skills 和权限配置。

ECC 的架构原则与本项目 SSOT 很接近：耐久行为放共享源，宿主适配器只处理加载、事件形状、命令映射和平台限制。

来源：[ECC README](https://github.com/affaan-m/ECC/blob/main/README.md)、[cross-harness architecture](https://github.com/affaan-m/ECC/blob/main/docs/architecture/cross-harness.md)、[install profiles](https://github.com/affaan-m/ECC/blob/main/manifests/install-profiles.json)、[install components](https://github.com/affaan-m/ECC/blob/main/manifests/install-components.json)。

### 与 Prompt Optimizer 的重叠

- 都有 hooks、规则文件、skills、跨宿主适配。
- 都关注项目记忆和经验沉淀。
- 都关注高风险操作、安全与验证。
- 都尝试让同一套行为跨 Claude Code、Codex、Cursor 等宿主运行。

### 本质区别

ECC 的价值来自广度和组合：用户安装一整套 agent 能力。Prompt Optimizer 的价值必须来自一个窄而深的问题：**减少请求进入执行时的意图、范围和验收偏差**。

如果 Prompt Optimizer 也开始大量增加语言规范、review agents、MCP、内容 skills、编排器和模型路由，它会进入 ECC 的主战场，并失去自己更清晰的定位。

### 最值得借鉴

1. **manifest-driven 安装**：组件、模块、profile、宿主目标都应由清单定义，Bash/PowerShell 只执行同一安装计划。
2. **minimal / standard / strict profile**：让用户选择上下文成本和强制程度，但不需要理解内部文件。
3. **跨宿主能力矩阵**：明确 native hook、instruction-backed、CLI-backed 各自能保证什么，禁止用“支持”掩盖能力不等价。
4. **薄 adapter 原则**：协议和路由只实现一次，adapter 不复制业务规则。
5. **安全与供应链基线**：LICENSE、SECURITY.md、官方安装源、校验、最小权限、危险命令 guardrail。
6. **安装 consult / preview / reset**：先显示将安装和修改什么，再执行；卸载必须只删除自己管理的内容。

### 不应照搬

- 不要追求 agents / skills / commands 数量。
- 不要把研究、内容、媒体、MCP、模型成本等全部纳入本项目。
- 不要用“操作系统”叙事掩盖核心功能尚未闭环；先把一个入口决策做准、做稳、做可测。

## 建议形成的产品边界

### 应该拥有

1. **Alignment Decision**：一条稳定、机器可读的路由结果。
2. **Agent Brief**：经过契约回验、带来源标注和验收标准的执行契约。
3. **Project Alignment Context**：短小、可审查、能改变下次行为的项目态。
4. **Host Adapters**：只负责捕获请求、注入结果、执行阻断和报告状态。
5. **Evaluation Harness**：证明路由、澄清和验收真的改善结果。
6. **Downstream Handoffs**：把已对齐任务交给 OpenSpec、Superpowers、Matt Pocock Skills 或其他工作流。

### 不应该拥有

1. 通用项目管理系统。
2. 完整软件开发方法论和所有工程 skills。
3. 大而全的 agents / MCP / rules 配置发行版。
4. 替用户选择技术方案、产品方向或优先级的自动决策器。

## 最关键的可借鉴设计：Alignment Decision IR

建议把当前自然语言 verdict 升级为稳定中间表示（IR）：

```json
{
  "version": "1.0",
  "route": "pass | enrich | clarify | block",
  "reasons": ["verification_missing"],
  "facts": [
    { "source": "user", "value": "只修改 auth 模块" }
  ],
  "assumptions": [
    { "value": "保持 public API", "mustVerify": true }
  ],
  "missing": ["acceptance_criteria"],
  "scope": {
    "include": ["src/auth"],
    "exclude": ["database schema"]
  },
  "acceptance": ["npm test -- auth"],
  "next": {
    "action": "ask",
    "question": "本次是否允许修改登录接口返回结构？",
    "recommendedAnswer": "不允许，先保持 public API 兼容。"
  }
}
```

它可以同时解决多个问题：

- hook 不再解析中文段落来决定是否阻断。
- Claude Code、Codex、Cursor adapter 消费同一语义。
- 可以对 route、reason、missing、acceptance 做确定性测试。
- 可以把结果转成 OpenSpec proposal、Superpowers brainstorming 输入或普通 Agent Brief。
- 版本升级时可以声明兼容性，而不是依赖 prompt 文本没有变化。

## 推荐的集成关系

### 与 OpenSpec

当任务满足“长期变更、跨模块、多人协作、需要归档”时：

```text
Prompt Optimizer 对齐请求
→ 生成 Alignment Decision + Agent Brief
→ OpenSpec adapter 创建 change 和初始 proposal/specs
→ OpenSpec 管理后续工件生命周期
```

低风险单步任务仍走 A 档，不创建 OpenSpec change。

### 与 Superpowers

```text
Prompt Optimizer 判断是否需要设计/澄清
→ 把事实、假设、范围、验收交给 brainstorming
→ Superpowers 承担 design/plan/TDD/review
```

Prompt Optimizer 不复制 TDD 和 worktree；Superpowers 也不需要重新猜用户原始意图。

### 与 Matt Pocock Skills

> G6 实现边界：只有 `pass` / `enrich` 可生成 skill 建议；`clarify` / `block` 返回 `deferred`，先完成原 route 再重新分析。handoff 的 `automatic=false`，不会自动调用 grilling 或任何其他 skill。

```text
Prompt Optimizer 输出 Alignment Decision
→ pass：直接执行，不启动完整工程流
→ clarify / block：deferred，先完成原 route
→ enrich：把 glossary / ADR / 项目 facts 注入 Agent Brief
→ complex handoff：to-spec → to-tickets → implement/TDD → code-review
```

Prompt Optimizer 负责判断是否需要这些技能；Matt Skills 负责把被选中的工程纪律执行好。两者之间传递稳定契约，不复制 skill 正文。

### 与 ECC

把 Prompt Optimizer 作为 ECC 或其他 harness 的可选 `intent-alignment` 模块：

- 共享核心协议和 IR。
- 各宿主只安装适配器。
- minimal profile 只做规则注入。
- standard profile 启用动态路由。
- strict profile 启用高风险阻断与交付验证。

## 分级改进路线

### P0：先证明核心产品成立

1. **统一协议与运行时语义**
   A/B/C 与 HIGH/VAGUE/GRAY/CLEAR 只能保留一套公共模型；D1-D5、风险门、假设门和验收门必须能从运行时结果中检查。

2. **实现 Alignment Decision IR 与 JSON CLI**
   提供 `align classify --json`、`align enrich --json`、`align doctor --json`，定义版本、诊断码和退出码。

3. **修正验证生命周期**
   区分 `baseline-check` 和 `completion-check`。请求进入时只能跑基线；任务完成后才允许宣称 R8 通过。

4. **完成真正的分发闭环**
   编译产物进入 `dist/`，安装器实际安装 CLI/runtime；Bash 与 PowerShell 从同一 manifest 生成安装计划。

5. **做真实模型 benchmark**
   至少覆盖 Claude Code、Codex 和 Cursor；记录不必要澄清率、高风险漏拦率、验收缺失率、最终任务成功率、token/延迟和返工轮次。

6. **统一公开版本和仓库状态**
   推送本地 18 个提交前先完成审计；补 LICENSE、GitHub release、CHANGELOG 对应版本和安装器版本一致性。

### P1：建立可组合生态

1. OpenSpec handoff：复杂任务可生成 change 草案。
2. Superpowers handoff：对齐结果可成为 brainstorming / writing-plans 输入。
3. Matt Skills handoff：复杂工程任务可进入 grilling / spec / tickets / TDD / review 组合流。
4. invocation taxonomy：明确哪些规则常驻、哪些 route 命中后加载、哪些只能由用户显式调用。
5. manifest-driven profiles：`lite`、`standard`、`strict`。
6. adapter compliance matrix：逐宿主写清“可注入、可阻断、可回验、可沉淀”。
7. behavioral eval：测试 agent 在压力提示、上下文污染和诱导跳门下是否守约。
8. 协议渐进加载：入口只保留路由必需内容，其余协议和模板按需加载，降低上下文成本。
9. 两轴验收：Intent/Spec compliance 与实现质量分开评估，禁止代码质量掩盖目标偏差。

### P2：再做社区与增长

1. 可贡献的验收清单、风险信号和领域模板 schema。
2. 公开 benchmark 数据集和各模型结果仪表板。
3. 官方 plugin marketplace、安装 doctor 和升级通道。
4. 端到端示例：原始请求 → 对齐决策 → 下游执行 → 验收结果。
5. 中文与英文双语协议，并用同一测试语料验证语义一致性。

## 90 天建议目标

### 第 1-30 天：做准

- 确定公共路由模型和 Alignment Decision schema。
- 修正 verification 时序与 bypass 安全阀。
- 让 TypeScript runtime 与 shell router 使用同一组 golden cases。
- 发布第一份真实模型基线报告，允许结果不好，但必须可复现。

### 第 31-60 天：交付闭环

- runtime 进入 `dist/` 并被两套安装器正确安装、升级和卸载。
- 增加 `doctor/status/validate --json`。
- 发布 v3.2 GitHub release、LICENSE、迁移说明和支持矩阵。
- 提供一个 native hook 宿主和一个 instruction-backed 宿主的端到端测试。

### 第 61-90 天：验证可组合性

- 完成 OpenSpec 或 Superpowers 中至少一个官方级 handoff 原型。
- 发布 20-30 个真实任务的跨模型结果，比较“无对齐 / Prompt Optimizer / 重流程”三组。
- 根据误拦和漏拦数据调整阈值，不根据直觉继续增加规则。

## 最终判断

Prompt Optimizer 最有价值的部分不是更多模板，而是这条产品命题：

> **不同请求需要不同强度的对齐；简单任务不应被流程拖慢，高风险任务不能被模型的“先做再说”倾向绕过。**

OpenSpec 已证明规格工件和机器契约的价值；Superpowers 已证明强流程与行为 eval 的价值；ECC 已证明 manifest、profile、薄适配器和跨宿主分发的价值；Matt Pocock Skills 已证明小技能、调用边界、渐进披露和组合式工程流的价值。

Prompt Optimizer 应吸收这三类工程能力，但不要吸收它们的产品范围。最合理的演进方向是成为一个可独立使用、也能嵌入其他 agent 工作流的对齐决策层。

## 一手来源

### Prompt Optimizer

- [README](../../README.md)
- [协议内核](../../core/protocol/)
- [Agent Brief 模板](../../core/templates/AGENT-BRIEF.md)
- [通用管线源码](../../core/host/pipeline/src/)
- [v3 benchmark](../planning/BENCHMARK-V3.md)

### OpenSpec

- [官方仓库](https://github.com/Fission-AI/OpenSpec)
- [README](https://github.com/Fission-AI/OpenSpec/blob/main/README.md)
- [OPSX workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/opsx.md)
- [Agent Contract](https://github.com/Fission-AI/OpenSpec/blob/main/docs/agent-contract.md)
- [Supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
- [Artifact graph](https://github.com/Fission-AI/OpenSpec/tree/main/src/core/artifact-graph)

### Superpowers

- [官方仓库](https://github.com/obra/superpowers)
- [README](https://github.com/obra/superpowers/blob/main/README.md)
- [Using Superpowers](https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md)
- [Brainstorming skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)
- [Skills library](https://github.com/obra/superpowers/tree/main/skills)
- [Tests](https://github.com/obra/superpowers/tree/main/tests)

### ECC

- [官方仓库](https://github.com/affaan-m/ECC)
- [README](https://github.com/affaan-m/ECC/blob/main/README.md)
- [Cross-harness architecture](https://github.com/affaan-m/ECC/blob/main/docs/architecture/cross-harness.md)
- [Install profiles](https://github.com/affaan-m/ECC/blob/main/manifests/install-profiles.json)
- [Install components](https://github.com/affaan-m/ECC/blob/main/manifests/install-components.json)
- [Hooks](https://github.com/affaan-m/ECC/tree/main/hooks)
- [Rules](https://github.com/affaan-m/ECC/tree/main/rules)

### Matt Pocock Skills 本地快照

- 本地来源：用户提供的 `mattpocock/skills` v1.1.0 快照（不记录机器绝对路径）
- `README.md`：项目定位、失败模式和完整技能索引。
- `CLAUDE.md`：bucket、发布、docs 和 router 同步规则。
- `.agents/invocation.md`：User-invoked / Model-invoked 成本模型。
- `skills/engineering/ask-matt/SKILL.md`：idea → ship 主流程与技能关系图。
- `skills/productivity/grilling/SKILL.md`：一次一问、facts / decisions 分离和确认门。
- `skills/productivity/writing-great-skills/SKILL.md`：信息层级、渐进披露、no-op 和 sprawl 维护原则。
- `skills/engineering/code-review/SKILL.md`：Standards / Spec 两轴审查。
