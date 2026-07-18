---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt, or wants an AI agent to understand and execute an idea accurately.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Optimize Prompt

Agent 意图入口层。先降低意图偏差、范围偏差和验收偏差，再执行；不得退化成文案润色。

> **收敛说明**：`optimize-prompt` 已收敛为 `/align` 的内部 **full alignment profile**。触发名称在兼容期内保持不变，但建议使用 `/align <请求>` 作为统一入口。本 skill 的全部行为与 `/align` 显式调用完全一致。

## 三类入口

- **user-invoked**：用户调用 `$optimize-prompt`、`/optimize-prompt`、`优化：`或要求优化 prompt。输出完整 Agent Brief。
- **model-invoked**：普通开发请求由模型执行本入口。默认静默路由，不展示完整诊断。
- **runtime-invoked**：输入已有 `alignment.decision`。验证 schema/version 后执行其 route；不得用旧 HIGH/CLEAR 标签覆盖机器决定。

## 常驻硬门

1. 机器 route 只能是 `pass`、`enrich`、`clarify`、`block`；A/B/C 只用于展示。
2. `[直出]` 只改变 presentation，禁止绕过安全、澄清、baseline、completion verification。
3. `D5=0`、有效总分 `<6`、任一维为 `0`、或 `[假设]>2`：必须 `clarify`，禁止执行。
4. `clarify` 一次只问一个最高价值问题，并给推荐答案；项目中能查到的信息自行读取。
5. `block` 仅用于契约完整但政策、授权或 baseline 禁止执行；解除后必须重新分析。
6. 可执行任务必须有可判定 acceptance。执行前只能形成 verification plan；收到 execution receipt 后才能报告 completion evidence。
7. 高风险静默假设、未验证即交付、无验收输出：本次输出无效，必须重做。

## 最小流程

1. 若项目有 `.align/`，按 `lessons.md → spec.md → facts.md / glossary.md / state.md` 读取；三个分类文件未齐全时同时读取 `context.md`，全部缺失时只读 legacy，且只取与当前请求有关的内容。
2. 判断目标、范围、约束、上下文、验收和风险，形成 route + reason。
3. `pass`：目标明确、低风险、observed 总分 ≥8；直接执行最小改动。
4. `enrich`：有效总分 ≥6 且缺口可由可信上下文确定补全；先展示最多 3 行补全回执，每项包含补全内容、来源和稳定 ID，最后给出 `撤销补全 <ID>` 口令，再直接执行。
5. `clarify` / `block`：停止写操作，输出一个问题或确认要求。
6. 执行完成后验证 acceptance；有踩坑、纠正、新约定或难逆决策时再沉淀。

## 可选生态 handoff

只有宿主显式请求 `matt-pocock-skills` handoff 时，才在 Alignment Decision 之后生成独立 envelope。普通请求和 `json` 输出保持不变。

- `pass` / `enrich`：建议一个已命名 skill 及其 invocation；只传 facts、missing、scope、acceptance，不复制 skill 正文。
- `clarify` / `block`：handoff 必须为 `deferred`，不得调用下游 skill 绕过原 route。
- `automatic` 永远为 `false`；`ready` 也只表示可由用户或宿主后续调用。
- skill 未安装返回 `unavailable`；工程 setup 三文件未齐全返回 `setup_required`，不得自动运行交互式 setup。

## 按需读取

| Reference | 何时读取 | 读完必须完成 |
| --- | --- | --- |
| `references/protocol-intent.md` | 目标含混、XY problem、症状当原因、需要 D1-D5 诊断 | 确定真实目标、缺口和置信度 |
| `references/protocol-routing.md` | route 冲突、高风险、clarify/block 边界、需要 reason code | 给出唯一 route、reason、next action |
| `references/protocol-contract.md` | user-invoked 完整优化、enrich、复杂/跨模块任务 | 形成 Agent Brief 与可判定 acceptance |
| `references/protocol-verification.md` | executable route 的 baseline；执行回执后的 completion | 区分计划与证据，报告实际结果 |
| `references/protocol-precipitation.md` | 出现踩坑、纠正、新约定、难逆决策 | 写入正确载体；无信号则不沉淀 |

模板只在需要对应交付物时读取。简单 `pass` 禁止加载完整协议和全部模板。

## 输出

- 隐式 `pass`：直接执行，不展示对齐术语。
- 隐式 `enrich`：最多 3 行补全回执后执行。回执逐项写明补全内容和来源；用户回复 `撤销补全 <ID>` 时，停止沿用该项并重新分析。若已经产生改动，先报告影响，未经确认不自动回滚。
- 整条消息仅为 `撤销补全 B<n>`（可列多个 ID）时：这是会话控制指令，不得当成新的模糊开发需求。定位当前会话最近的回执，停止沿用指定项，回到原始请求并排除该项后重新执行 `analyze -> decide`；找不到回执时只问用户粘贴回执。消息还包含其他操作时，必须按完整请求重新走安全路由，禁止把它当成撤销快捷方式。
- `clarify`：一个问题、理由、推荐答案；禁止执行。
- `block`：阻断原因、影响、解除条件；禁止执行。
- 显式优化：完整 Agent Brief，包含目标、背景、范围、交付物、约束、执行策略、验收、沉淀信号。
