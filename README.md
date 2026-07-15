# Prompt Optimizer / Agent 意图对齐器

> 可注入任意项目的 Agent 对齐运行时：把自然语言请求转换成可执行、可验证、可追溯的 Alignment Decision，并在执行后沉淀项目经验。

这个项目不是 prompt 文案润色器。它解决的是 AI agent 执行前的契约缺口：目标是否明确、范围是否受控、风险是否获得授权、验收是否可判定，以及完成后哪些经验值得进入项目上下文。

## 项目介绍

Prompt Optimizer v3.2.0-rc.1 由协议、机器契约、结构化 runtime、宿主 adapter 和三个 skill 组成。当前稳定版收敛计划已完成 S0-S2：冻结发布 Gate、统一 Alignment Decision 单一路由，并加固真实模型评测 runner；下一阶段是受预算约束的远程评测与 fresh evidence。

- **optimize-prompt**：意图对齐器，把模糊指令优化为可执行的 Agent Brief。v3 默认静默运行——简单任务直接执行，有缺口时静默补全，高风险且信息或授权不足时停下澄清或等待确认。
- **align-init**：项目接入器，为项目生成 `.align/` 运行时（开发规范+上下文+经验+决策），并注入挂载区到 CLAUDE.md/AGENTS.md。
- **optimize-prompt-lite**：轻量协议，面向弱指令遵循模型或不支持 hook 的宿主，无需 .align/ 运行时即可使用基础对齐。

- **Alignment Decision v1**：使用 `pass` / `enrich` / `clarify` / `block` 表达稳定路由，并携带 reason、来源、评分、下一步和生命周期计划。
- **结构化 runtime**：Node.js 路径负责分析、契约构建、路由和生命周期；无 Node 环境保留明确标注能力降级的 shell fallback。
- **项目上下文**：`.align/` 将 facts、glossary、rules、lessons、decisions 和 state 按生命周期分开，避免把临时状态误当长期事实。
- **可靠评测 runner**：真实模型评测默认失败关闭，支持 resume、单次显式重试、case/成本/超时上限、heartbeat 和 cleanup warning 隔离；测试使用 fake CLI，不会误触发付费模型。

它适合把 Codex、Claude Code、Cursor 或通用聊天模型用于持续工程工作的个人和团队，用来减少误解、范围漂移、越权执行、提前宣告完成和缺少验证的问题。

### 工作方式

```text
用户请求
  -> 五维诊断 + 风险/授权检查
  -> 加载可信项目上下文
  -> Alignment Decision（pass / enrich / clarify / block）
  -> 宿主执行或停下澄清
  -> baseline / completion verification
  -> 脱敏沉淀到 .align/
```

`core/` 是协议、模板、契约和宿主适配的唯一事实来源。`build/` 将其生成到 `dist/`，安装器再按宿主安装 skills、runtime、doctor 和 adapter；`dist/` 禁止手工编辑。

### 三档路由（v3 核心设计）

| 档位 | 机器 route | 条件 | 用户感知 |
| --- | --- | --- | --- |
| A 档直通 | `pass` | 低风险，用户输入自身完整并通过硬门槛 | 零感知，直接执行 |
| B 档静默对齐 | `enrich` | 缺口可由可信上下文补齐，或风险信息与授权完整 | 展示可撤销的补全回执后执行 |
| C 档浮出 | `clarify` / `block` | 契约信息不足，或授权、政策、baseline 阻断 | 停下，一次一问或等待确认 |

对齐的存在感与任务风险成正比，与任务频率成反比。风险信号必须经过安全路由，但不等于永久阻断；信息不足时 `clarify`，授权或政策不满足时 `block`。

### v3.2.0-rc.1 候选版能力

> 当前为候选版，尚未正式发布。稳定版收敛计划 S0-S2 已完成；G5 已按“既有独立盲评发现 + 修复后确定性回归”关闭，fresh post-fix 独立盲评和完整真实模型重复仍按证据等级管理。

- **机器契约**：冻结 Alignment Decision schema、decision policy、reason registry、lifecycle event 和 golden corpus；未知 major、route、action 或 reason 必须 fail closed。
- **安装与诊断**：PowerShell / Bash 覆盖 Codex、Claude Code、`~/.agents` 三个 skills 目录，并安装 `align-cli`、`align-doctor` 和宿主 adapter 到 `~/.prompt-optimizer/`。
- **运行时路由**：区分信息不足的 `clarify` 与授权/政策阻断的 `block`；只有 `pass` / `enrich` 可以进入 execution handoff。
- **上下文治理**：知识类型与来源引用分轴建模，legacy `context.md` 保留兼容投影，completion evidence 默认不进入仓库。
- **按需协议加载**：常驻 skill 保持精简，intent、routing、contract、verification、precipitation 正文按需加载。
- **可选生态 handoff**：显式 `align-cli matt` 生成独立 Matt Pocock Skills 建议；不会复制或自动调用 skill，也不会改变普通 `json` 输出。
- **证据与分发**：56 条确定性行为集、17 个 TypeScript suites / 275 tests、runner/scorer fake CLI 集成矩阵、构建幂等、Bash/PowerShell parity、安装/卸载沙箱和分发完整性检查均已通过。
- **能力边界**：Claude Code 为 L3 Native Hook；Codex 为 L2 CLI wrapper / instruction-backed；Cursor 和 Universal 只声明已验证到的较低等级能力。

### 支持矩阵

| 宿主/入口 | 能力等级 | 已有证据 | 支持口径 |
| --- | --- | --- | --- |
| Claude Code | L3 Native Hook | 安装/升级/卸载沙箱、hook exit code、adapter E3 | 支持 native hook；真实模型 E5 尚未完成 |
| Codex CLI | L2 CLI wrapper / instruction-backed | wrapper、doctor、安装沙箱 E3 | 支持 CLI wrapper；不宣称 hook parity |
| Cursor | L1 project rule | 生成、预算和跨平台构建 E2 | 提供规则产物；尚无真实宿主端到端证据 |
| Universal System Prompt | L0 copy-paste | 构建与内容门 E2 | 自包含复制入口；遵循度取决于目标模型 |
| 其他编辑器/聊天宿主 | L0/L1 | 无宿主专属 E4/E5 | 仅提供通用说明，不宣称完整支持 |

证据等级：E2=确定性 corpus，E3=沙箱集成，E4=真实宿主端到端，E5=真实模型对照 benchmark。当前 G5 的 tuned corpus、独立盲评修复链和 Claude 三臂 pilot 已保留；fresh post-fix 独立盲评、完整 E5 重复和真实执行返工指标仍是稳定版前债务。历史 18 case 规则推演见 [BENCHMARK-V3.md](docs/planning/BENCHMARK-V3.md)，不得当作外部模型实测。

## 快速开始

### 1. 一行安装

Windows PowerShell：

```powershell
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex
```

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash
```

安装三个 skill：`optimize-prompt`（意图对齐器）、`align-init`（项目接入器）和 `optimize-prompt-lite`（轻量协议）。默认安装到 Codex、Claude Code、`~/.agents` 三个目录。
Codex 使用 `dist/codex` 包；Claude Code 和 `~/.agents` 使用 Claude-compatible 的 `dist/claude-code` 包。

### 2. 接入项目

进入你的项目目录，运行：

```text
/align-init
```

`align-init` 会扫描项目，生成 `.align/` 运行时（开发规范+上下文+经验+决策），并注入挂载区到 CLAUDE.md。从此每条开发指令自动经过三档路由。

从零开始新项目：

```text
/align-init --new
```

安装或升级后可检查 runtime、宿主接线和项目 router 状态：

```bash
bash "$HOME/.prompt-optimizer/bin/align-doctor" --json "$PWD"
```

### 3. 正常干活

接入后直接开发即可。不需要说"优化："——对齐在后台静默发生：

- 简单指令（如"改个变量名"）→ **直接执行**，零感知
- 有缺口的指令（如"加个搜索功能"）→ **最多 3 行补全回执后直接执行**，逐项展示补全内容、来源和 `撤销补全 <ID>` 口令
- 高风险且信息不足（如只说"清空数据库"）→ **停下问一个问题**；授权缺失时等待确认；范围、恢复、授权和验收完整时展示补全回执后执行

想看完整优化结果时，显式使用：

```text
优化：帮我做一个用户登录功能
```

这会输出完整 Agent Brief 文档（v2.0 兼容行为）。

### 4. 可选 Matt Pocock Skills handoff

已安装 Matt Pocock Skills 时，可以显式请求一个独立 handoff envelope：

```bash
bash "$HOME/.prompt-optimizer/bin/align-cli" matt "只修改 parser 并运行 parser tests" --project-dir "$PWD"
```

stdout 只输出 `alignment.ecosystem-handoff` JSON，stderr 只披露 route/status。`ready` 仍需由用户或宿主后续调用；`clarify` / `block` 返回 `deferred`，不会绕过对齐门。详见 [USAGE.md](docs/usage/USAGE.md#8-可选-matt-pocock-skills-handoff)。

### 5. 其他接入方式

不支持 skills 的工具可以复制 System Prompt：

1. 打开 [SYSTEM-PROMPT.md](dist/universal/SYSTEM-PROMPT.md)
2. 复制 `## System Prompt Start` 到 `## System Prompt End` 之间的内容
3. 粘贴到目标 AI 工具的 System Prompt、Custom Instructions、项目规则或第一条消息
4. 发送你的原始指令
5. 获得可直接交给 agent 执行的优化版任务说明

也可以直接按模板手写：

从 `core/templates/` 选择最接近的模板：

- [AGENT-BRIEF.md](core/templates/AGENT-BRIEF.md)：把想法整理成完整 agent 任务简报
- [CLARIFY.md](core/templates/CLARIFY.md)：让 agent 先追问，再执行
- [INTENT-PROBE.md](core/templates/INTENT-PROBE.md)：意图探查决策树和偏差检测模板
- [PROJECT-CONTEXT.md](core/templates/PROJECT-CONTEXT.md)：沉淀项目上下文，减少每次重复解释
- [CODE.md](core/templates/CODE.md)：编程任务
- [ANALYZE.md](core/templates/ANALYZE.md)：分析 / 调研 / 对比
- [WRITE.md](core/templates/WRITE.md)：写作任务
- [META.md](core/templates/META.md)：总结 / 解释 / 教学
- [ACCEPTANCE-CHECKLIST.md](core/templates/ACCEPTANCE-CHECKLIST.md)：分类型可复制验收清单库

## 适用场景

| 你的原始想法 | 本项目输出 |
| --- | --- |
| “帮我优化这个项目” | 明确目标、范围、约束、验收标准和执行阶段的 Agent Brief |
| “帮我做个功能” | 带上下文读取、方案选择、最小变更、测试门的开发任务 |
| “我还没想清楚” | 一次只问一个关键问题的澄清访谈 |
| “以后让 AI 都按这个项目规则来” | 可持久化的项目上下文和规则文件 |
| “AI 老是理解偏” | 显性化用户意图、隐性约束、反面约束和成功标准 |

## 核心方法

本项目融合三类方法：

- **五维诊断**：精确性、约束性、结构性、上下文、验证性
- **Agent 对齐协议**：意图、背景、范围、交付物、约束、执行策略、验收、沉淀
- **自主思维循环**：感知 → 自设计 → 深度思考 → 执行 → 反思 → 沉淀

详细说明见 [core/protocol/](core/protocol/)（协议内核 00-07）。

## 文档导航

全部开发、使用、参考和规划文档集中在 [docs/](docs/README.md)：

- [使用文档](docs/README.md#使用文档)：安装与日常使用
- [参考文档](docs/README.md#参考文档)：外部参考取舍
- [规划文档](docs/README.md#规划文档)：深度优化方案和会话任务拆解
- [v4 专精化执行方案](docs/planning/V4-FOCUS-IMPROVEMENT-PLAN.md)：执行前契约门定位、核心不变量、架构收敛、W0-W7 波次和量化 Gate
- [v3.2 稳定版执行方案](docs/planning/V3.2-STABLE-IMPROVEMENT-PLAN.md)：单一路由、评测可靠性、远程 evidence 和发布 Gate
- [G0-G6 改进规划](docs/planning/MULTI-AGENT-IMPROVEMENT-PLAN.md)：本次 Alignment Decision runtime 大更新的分波次执行契约
- [G5 评测报告](docs/planning/MULTI-AGENT-G5-EVALUATION-REPORT.md)：确定性语料、盲评、修复回归与证据边界
- [G6 handoff 报告](docs/planning/MULTI-AGENT-G6-MATT-HANDOFF.md)：Matt Pocock Skills envelope、映射与关闭证据

## 参考内容取舍

本项目参考了 AI 自主思维模型、AI 编程开发规则手册和 `mattpocock/skills`。具体吸收了什么、没有照搬什么、为什么这样取舍，见 [REFERENCE-DIGEST.md](docs/reference/REFERENCE-DIGEST.md)。与 OpenSpec、Superpowers、ECC、Matt Pocock Skills 的定位和机制对比见 [ECOSYSTEM-COMPARISON.md](docs/reference/ECOSYSTEM-COMPARISON.md)。

## 项目结构

```text
├── README.md
├── AGENTS.md
├── core/                          # ★ 唯一事实来源（SSOT）
│   ├── protocol/                  # 协议内核 00-07
│   ├── contracts/                 # 公共机器契约、reason registry 与 golden corpus
│   ├── templates/                 # 17 个模板（含 7 个 ALIGN 模板）
│   ├── spec-kit/                  # 规范生成器素材库
│   ├── skills/                    # 三个 skill 的源文件
│   ├── distribution/              # runtime 安装计划与所有权标记
│   └── host/                      # TypeScript runtime 与宿主适配源文件
├── build/                         # 构建脚本
│   ├── build.ps1
│   └── build.sh
├── dist/                          # 构建产物（禁止手改）
│   ├── claude-code/
│   │   ├── optimize-prompt/       # skill 1 + references + agents/
│   │   ├── align-init/            # skill 2 + references + spec-sections/
│   │   ├── hooks/                 # HOOK-REMINDER.txt + settings.fragment.json
│   │   └── CLAUDE.align.md        # 挂载区片段
│   ├── codex/
│   │   ├── optimize-prompt/
│   │   ├── align-init/
│   │   └── AGENTS.align.md
│   ├── cursor/
│   │   ├── rules/align.mdc
│   │   └── references/
│   ├── universal/
│   │   ├── SYSTEM-PROMPT.md       # 可复制 System Prompt
│   │   ├── align-init/
│   │   ├── optimize-prompt-lite/
│   │   └── references/
│   └── runtime/                   # 编译 runtime、doctor、CLI 与 adapters
├── docs/
│   ├── README.md
│   ├── usage/                     # INSTALL + USAGE + MIGRATION
│   ├── reference/
│   └── planning/                  # 基准、G0-G6 报告与方案文档
├── scripts/                       # 安装脚本（三 skill + 卸载 + 版本）
├── tests/                         # 契约、路由、分发、安装与评测回归
└── examples/
```

## 设计原则

1. **先对齐，再执行**：复杂任务先确认理解和边界，不急着输出。
2. **把隐含意图显性化**：用户没说出口但影响结果的信息，要被挖出来。
3. **一问一答澄清**：需要追问时一次只问一个最高价值问题。
4. **最小必要补全**：补齐缺口，不替用户改目标。
5. **任务即契约**：优化后的 prompt 必须包含交付物、范围、约束和验收。
6. **反思和沉淀**：复杂任务结束后，要求 agent 记录项目模式、风险和复用规则。

## License

[MIT](LICENSE)。安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。
