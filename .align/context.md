<!-- Generated compatibility projection. Do not edit.
context-source-sha256:40070f2e5b1a2730beb83cf4834f1580d3050f2e4d2daf5ff4a935e9637126e9
context-content-sha256:e7604b42319c69e109c165c25cc03357f10424141f1509de1dd8ef899f0021fe
-->

# Legacy Context Projection

## Project Facts

# 项目事实

> 稳定、可复用、当前可接受为真的项目属性。每项包含可定位来源。

## Facts

- 产品定位：Prompt Optimizer 是 Agent 意图对齐器，把自然语言请求转换为可执行、可验证、可追溯的 Alignment Decision；不是 prompt 文案润色器。
  source: README.md#Prompt-Optimizer--Agent-意图对齐器
- 当前发布版本：`v3.2.0-rc.1`。
  source: README.md#项目介绍
- Skill 入口：`optimize-prompt`、`align-init`、`optimize-prompt-lite` 三个 skill。
  source: README.md#项目介绍
- Runtime：Node.js `>=18` 是可选结构化运行时；无 Node 环境保留 shell fallback。
  source: core/host/pipeline/package.json#engines; README.md#项目介绍
- 构建链：`core/` 是内容 SSOT，`build/` 生成 `dist/`，安装器从 `dist/` 分发宿主产物。
  source: README.md#工作方式
- 构建入口：Bash 使用 `build/build.sh`，Windows PowerShell 使用 `build/build.ps1`。
  source: AGENTS.md#目录职责
- 机器路由：Alignment Decision 的 route 固定为 `pass`、`enrich`、`clarify`、`block`；A/B/C 只用于展示。
  source: README.md#三档路由v3-核心设计
- 项目上下文：`.align/` 将 facts、glossary、rules、lessons、decisions 和 state 按生命周期分开。
  source: README.md#项目介绍
- 许可证：MIT。
  source: LICENSE

## Glossary

# 项目术语

> 只定义项目特有术语，不包含实现步骤、阶段状态或行为规则。

## Terms

- Prompt Optimizer：可注入项目的 Agent 意图对齐运行时，不是 prompt 文案润色器。
- 意图对齐：把用户的粗糙想法转换成 AI agent 可执行、可验证、可沉淀的任务契约。
- Agent Brief：面向 agent 的完整任务契约，包含目标、背景、范围、交付物、约束、执行策略和验收。
- 五维诊断：从精确性、约束性、结构性、上下文和验证性五个维度评估请求完整度。
- Alignment Decision：对单条请求给出的稳定、可机器检查的对齐决定；机器 route 使用 `pass`、`enrich`、`clarify`、`block`。
- 展示档位：面向用户表达对齐强度的 A/B/C 映射，不作为机器 API 的 route 值。
- Clarify：契约信息不足，无法形成可执行或可阻断决定；一次只问一个最高价值问题并给推荐答案。
- Block：契约信息完整，但授权、政策或 baseline 条件禁止执行。
- 知识声明：进入 Alignment Decision 或项目态的规范化陈述，知识类型为 `fact`、`inference` 或 `assumption`。
- 来源引用：知识声明的独立溯源轴，由来源类型和可定位 ref 组成。
- 临时状态：带更新时间和失效条件的当前阶段摘要；不同于长期事实。
- Completion Evidence：执行后证明验收项实际检查结果的证据；不同于执行前 acceptance criteria。
- 兼容投影：由分类 `.align/` SSOT 生成、供旧 consumer 读取的 `context.md`，禁止直接编辑。
- SSOT：Single Source of Truth；本项目内容以 `core/` 为唯一事实来源。
- `.align/`：项目对齐运行时目录，按生命周期保存规则、事实、术语、状态、经验和决策。

## Temporary State

# 项目临时状态

> 只保存无敏感信息的阶段摘要；状态失效后删除，禁止迁入 facts。

## Current State

- releaseStatus: `v3.2.0-rc.1` 候选版，尚未正式发布
- milestone: v3.2.0 稳定版收敛，S0-S2 已完成，等待进入 S3
- stableReleaseDebt: G5-D05 Windows 临时目录清理；G5-D11 fresh post-fix blind review
- evidenceBoundaries: G5-D01、G5-D04 只阻断对应 E5 声明；G5-D10 是发布后持续指标
- updatedAt: 2026-07-13
- invalidWhen: `README.md` 的发布状态、`docs/planning/V3.2-STABLE-IMPROVEMENT-PLAN.md` 的波次状态或 `.align/debt.md` 的稳定版债务发生变化
