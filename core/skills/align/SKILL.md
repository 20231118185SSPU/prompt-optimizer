---
name: align
description: Unified router for the Agent Intent Alignment Protocol. Use /align to route any request through the Decision Kernel. Use /align setup for first-time host detection and hook wiring. All requests—hook-triggered or explicit—consume the same pass/enrich/clarify/block decision.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Align Router

Generated from core/. Do not edit dist/ manually.

统一入口。所有请求——hook 自动触发或用户显式调用——消费同一个 Alignment Decision Kernel。

## 入口方式

| 入口 | 触发方式 | 说明 |
| --- | --- | --- |
| hook 自动 | 仅 Claude Code 已显式 `--wire-hook` 且当前会话已运行 `/align` | 已激活会话中的持续路径 |
| 显式调用 | `/align <请求>`、`$align <请求>`、`align: <请求>` | 无 hook 时或用户主动使用 |
| setup | `/align setup`、`/align-init`（兼容） | 首次接入，探测宿主并配置 hook |

hook 自动入口和显式入口必须消费同一个 Decision Kernel，产生等价的 route/action。
默认安装、未激活的 Claude Code 会话和其他宿主保持显式调用；`/align setup` 不会启用会话。

## /align setup

首次接入入口。使用确定性 CLI 探测宿主 capability，再等待用户确认后执行安装。

### 确定性 CLI

`align-setup.sh` 提供确定性操作，skill 负责交互、推荐和解释：

| 命令 | 用途 | 输出 |
| --- | --- | --- |
| `detect-host [dir]` | 检测宿主名称、版本、配置位置、capability | JSON |
| `detect-caps [dir]` | 运行 doctor 检测 runtime/hook/context 状态 | JSON |
| `preview [dir]` | 展示将要安装/变更的文件清单 | JSON |
| `backup [dir]` | 备份现有配置（CLAUDE.md、AGENTS.md、settings.json） | JSON |
| `generate [dir]` | 生成 .align/ 目录文件 | JSON |
| `wire [dir]` | 检查 hook 接线状态 | JSON |
| `mount [dir] [file]` | 注入挂载区到 CLAUDE.md/AGENTS.md | JSON |
| `verify [dir]` | 运行 doctor 验证安装 | JSON |

### 流程

1. **探测**：运行 `align-setup.sh detect-host` 和 `align-setup.sh detect-caps`，生成 capability 报告
2. **预览**：运行 `align-setup.sh preview`，展示当前配置位置、安装前后效果差异、风险、备份和卸载范围
3. **等待用户明确选择**：安装强制 hook 或保留显式模式。**未确认不得修改任何文件**
4. **备份**：用户确认后运行 `align-setup.sh backup`
5. **生成**：运行 `align-setup.sh generate` 生成 .align/ 目录
6. **扫描**：执行 `references/scan.md` 扫描协议，填充 spec.md、facts.md、glossary.md、state.md
7. **挂载**：运行 `align-setup.sh mount` 注入挂载区到 CLAUDE.md/AGENTS.md
8. **接线**：运行安装器安装 hook（如用户选择强制模式）
9. **验证**：运行 `align-setup.sh verify` 确认接线成功

### 接线规则

- 修改用户级或项目级 hook 前，必须展示效果、路径、备份和卸载范围，并取得用户明确确认
- 安装器不得静默接线
- hook 只负责进入 router 和执行宿主 enforcement；router 拥有 route

### 与 align-init 的关系

`/align setup` 包含 `align-init` 的全部功能（扫描、文件生成、挂载、doctor）。兼容入口 `/align-init` 重定向到 `/align setup`。

## Decision Kernel

所有入口共享同一个决策内核。流程：

1. **读取项目上下文**：若 `.align/` 存在，按 `lessons.md → spec.md → facts.md / glossary.md / state.md` 读取；三个分类文件未齐全时同时读取 `context.md`，全部缺失时只读 legacy
2. **五维诊断**：精确性、约束性、结构性、上下文、验证性
3. **风险与授权检查**：高风险信号、授权、政策、baseline
4. **路由决策**：唯一 route（pass / enrich / clarify / block）+ reason + next action

### 路由行为

| route | 条件 | next action | 用户感知 |
| --- | --- | --- | --- |
| `pass` | 目标明确、低风险、总分 ≥8 | `execute` | 零感知，直接执行 |
| `enrich` | 总分 ≥6 且缺口可补全，或高风险但范围/恢复/授权/验收完整 | `execute`（展示补全回执后） | 最多 3 行补全回执，可撤销 |
| `clarify` | D5=0、总分 <6、任一维为 0、[假设]>2 | `ask` | 一个问题 + 推荐答案 |
| `block` | 契约完整但授权/政策/baseline 阻断 | `wait_confirmation` 或 `stop` | 阻断原因 + 解除条件 |

### clarify 多轮规则

- 每轮只问一个最高价值问题，附推荐答案
- 每次回答后更新共识快照，重新分析
- 未达到执行就绪（pass/enrich）时不得执行
- 不限制轮数，直到意图、范围、约束、授权和验收全部就绪

### 硬性红线

1. 机器 route 只能是 `pass`、`enrich`、`clarify`、`block`
2. `[直出]` 只改变 presentation，禁止绕过安全、澄清、baseline、completion verification
3. `D5=0`、有效总分 `<6`、任一维为 `0`、或 `[假设]>2`：必须 `clarify`
4. `clarify` 一次只问一个问题，并给推荐答案
5. `block` 仅用于契约完整但政策、授权或 baseline 禁止执行
6. 可执行任务必须有可判定 acceptance；执行前只能形成 verification plan；收到 execution receipt 后才能报告 completion evidence
7. 高风险静默假设、未验证即交付、无验收输出：本次输出无效，必须重做

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

- 隐式 `pass`：直接执行，不展示对齐术语
- 隐式 `enrich`：最多 3 行补全回执后执行。回执逐项写明补全内容和来源；用户回复 `撤销补全 <ID>` 时，停止沿用该项并重新分析
- `clarify`：一个问题、理由、推荐答案；禁止执行
- `block`：阻断原因、影响、解除条件；禁止执行
- 显式优化：完整 Agent Brief，包含目标、背景、范围、交付物、约束、执行策略、验收、沉淀信号

### 撤销补全控制

整条消息仅为 `撤销补全 B<n>`（可列多个 ID）时：这是会话控制指令，不得当成新的模糊开发需求。定位当前会话最近的回执，停止沿用指定项，回到原始请求并排除该项后重新执行 `analyze -> decide`；找不到回执时只问用户粘贴回执。消息还包含其他操作时，必须按完整请求重新走安全路由。

## Host Adapter 约束

Host Adapter 和子 skill 只能消费 Alignment Decision，不得重新判断或覆盖 route。`clarify` 和 `block` 不得被 Adapter 改成执行。

## 内部 Profiles

`/align` 内部包含三个 profile，对应旧 skill 的功能：

| Profile | 旧 skill | 触发方式 | 说明 |
| --- | --- | --- | --- |
| **setup** | `align-init` | `/align setup`、`/align-init`（兼容） | 首次接入，探测宿主并配置 hook |
| **full alignment** | `optimize-prompt` | `/align <请求>`（显式）、`/optimize-prompt`（兼容） | 完整 Agent Brief，适用于强模型 |
| **fallback** | `optimize-prompt-lite` | `/align <请求>`（弱模型自动降级）、`/optimize-prompt-lite`（兼容） | 简化规则，适用于弱模型 |

三个 profile 共享同一个 Decision Kernel，差异仅在输出格式和复杂度。

## 兼容入口

旧触发名称在兼容期内保留：

| 旧名称 | 映射 | 说明 |
| --- | --- | --- |
| `/align-init`、`$align-init` | `/align setup` | 项目接入 |
| `/optimize-prompt`、`$optimize-prompt`、`优化：` | `/align`（full alignment profile） | 完整 Agent Brief |
| `/optimize-prompt-lite`、`$optimize-prompt-lite` | `/align`（fallback profile） | 弱模型降级 |

兼容入口展示迁移提示：`此入口已收敛为 /align 的内部 profile，建议使用 /align <请求>。`

## References

- `references/protocol-intent.md`：意图探查协议
- `references/protocol-routing.md`：路由决策协议
- `references/protocol-contract.md`：契约构建协议
- `references/protocol-verification.md`：验证协议
- `references/protocol-precipitation.md`：沉淀协议
